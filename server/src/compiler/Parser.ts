import { Token } from "./Token";
import { Tokenizer } from "./Tokenizer";
import { FileLoc } from "./FileLoc";
import { isLower, trimToNull } from "./StringUtils";

import { CompilerError, ErrorTypes } from "./Errors";
import { type CompilerLogFunction } from "./CompilerErrorType";

class ParsedProto {
  readonly loc: FileLoc;
  readonly isData: boolean;
  public doc: string | null;
  public docLoc: FileLoc | null;
  public name: string | null;
  public traits: Record<string, unknown> = {};

  constructor(loc: FileLoc, isData = false) {
    this.loc = loc;
    this.isData = isData;
    this.doc = null;
    this.docLoc = null;
    this.name = null;
  }
}

export interface TokenWithPosition {
  token: Token;
  val: string;
  indexInInput: number;
  line: number;
  col: number;
}

interface ProtoOf {
  children: unknown[];
}

export class Parser {
  private readonly fileLoc: FileLoc;
  private readonly logErrCB: CompilerLogFunction;
  private readonly tokenizer: Tokenizer;

  private prevLoc: FileLoc;

  private cur: Token; // current token
  private curVal: any; // current token value
  private curLine = 0; // current token line number
  private curCol = 0; // current token col number
  private curCharIndex = 0; // current char index in the stream

  private peek: Token; // next token
  private peekVal: any; // next token value
  private peekLine = 0; // next token line number
  private peekCol = 0; // next token col number
  private peekCharIndex = 0; // next char index in the stream

  private readonly _tokenBag: TokenWithPosition[] = [];

  public constructor(
    input: string,
    logErrCB: CompilerLogFunction,
    loc = "input"
  ) {
    this.prevLoc = new FileLoc(loc);
    this.fileLoc = new FileLoc(loc);
    this.logErrCB = logErrCB;

    this.tokenizer = new Tokenizer(input);

    this.cur = this.peek = Token.EOF;
    this.consume();
    this.consume();
  }

  public get tokenBag(): TokenWithPosition[] {
    return this._tokenBag;
  }

  public parse(
    root: Record<string, unknown>
  ): Record<string, unknown> | undefined {
    try {
      const rootProto = new ParsedProto(this.curToLoc());
      rootProto.traits = root;

      this.parseProtos(rootProto, false);
      this.verify(Token.EOF);

      return root;
    } catch (e: any) {
      this.err(e.message);
    }
  }

  // Protos

  private parseProtos(parent: ParsedProto, isMeta: boolean): void {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const child = this.parseProto();
      if (child === null) break;
      this.parseEndOfProto();
      this.addToParent(parent, child, isMeta);
    }
  }

  private parseCodeFences(): void {
    if (
      this.cur !== Token.TRIPLE_DASH &&
      this.cur === Token.NL &&
      this.peek !== Token.TRIPLE_DASH
    ) {
      return;
    }

    do {
      if (this.cur === Token.NL) {
        this.skipNewlines();
      }

      if (this.cur !== Token.TRIPLE_DASH) {
        return;
      }

      this.parseCodeFence();
    } while (true);
  }

  private parseCodeFence(): void {
    //  we know we have a triple dash, so let's parse all of them
    this.consume();
    while (this.cur !== Token.TRIPLE_DASH) {
      this.consume();
    }
    this.consume();
  }

  private parseEndOfProto(): void {
    if (this.cur === Token.COMMA) {
      this.consume();
      this.skipNewlines();
      return;
    }

    if (this.cur === Token.NL) {
      this.skipNewlines();
      return;
    }

    if (this.cur === Token.RBRACE) return;
    if (this.cur === Token.GT) return;
    if (this.cur === Token.EOF) return;
    if (this.cur === Token.REF) return;

    this.err(
      `Expecting end of proto: comma or newline, not ${this.cur.toString()}`
    );

    // consume the char
    this.consume();
  }

  private parseProto(): ParsedProto | null {
    // leading comment
    const docInfo = this.parseLeadingDoc();

    // end of file or closing symbols
    if (this.cur === Token.EOF) return null;
    if (this.cur === Token.RBRACE) return null;
    if (this.cur === Token.GT) return null;

    // this token is start of our proto production
    const proto = new ParsedProto(this.curToLoc(), this.cur === Token.REF);
    if (docInfo) {
      proto.doc = docInfo.doc;
      proto.docLoc = docInfo.loc;
    }

    if (this.cur === Token.REF) {
      proto.name = "@" + this.consumeDataName();
      this.parseLibData(proto);
      return proto;
    }

    // <markerOnly> | <named> | <unnamed>
    if (this.cur === Token.ID && this.peek === Token.COLON) {
      proto.name = this.consumeName();
      this.consume(Token.COLON);
      this.parseBody(proto);
    } else if (
      this.cur === Token.ID &&
      isLower(this.curVal.toString()) &&
      this.peek !== Token.DOT
    ) {
      proto.name = this.consumeName();
      proto.traits = {
        _is: "sys.Marker",
      };
      //  maybe has specs
      if (this.cur === Token.LT) {
        this.parseMeta(proto);
      }
    } else {
      this.parseBody(proto);
    }

    this.parseCodeFences();
    this.parseTrailingDoc(proto);

    return proto;
  }

  private parseBody(proto: ParsedProto): void {
    const a = this.parseIs(proto);
    const meta = this.parseMeta(proto);
    const childrenOrVal = this.parseChildrenOrVal(proto);

    if (!a && !meta && !childrenOrVal) {
      this.err(`Expecting proto body:`, this.curToLoc());
    }
  }

  private parseMeta(proto: ParsedProto): boolean {
    if (this.cur !== Token.LT) {
      return false;
    }

    this.parseProtoChildren(proto, Token.LT, Token.GT, true);

    if (this.cur === Token.QUESTION) {
      this.consume(Token.QUESTION);

      if (proto.traits._of) {
        const oldTraits = {
          _of: proto.traits._of,
          _is: proto.traits._is,
        };

        proto.traits._is = "sys.Maybe";
        proto.traits._of = oldTraits;
      } else {
        proto.traits._of = proto.traits._is;
        proto.traits._is = "sys.Maybe";
      }
    }

    return true;
  }

  private parseChildrenOrVal(proto: ParsedProto): boolean {
    if (this.cur === Token.LBRACE) {
      return this.parseProtoChildren(proto, Token.LBRACE, Token.RBRACE, false);
    }

    if (this.cur.isVal) {
      return this.parseVal(proto);
    }

    return false;
  }

  private parseVal(proto: ParsedProto): boolean {
    proto.traits._val = this.curVal;
    this.consume();
    return true;
  }

  private parseIs(p: ParsedProto): boolean {
    if (this.cur === Token.STR && this.peek === Token.PIPE) {
      return this.parseIsOr(p, undefined, this.consumeVal());
    }

    if (this.cur !== Token.ID) return false;

    // const qnameLoc = this.curCharIndex - 1;
    const qnameLoc = new FileLoc(
      this.fileLoc.file,
      this.curLine,
      this.curCol - 1,
      this.curCharIndex - 1
    );
    const qname = this.consumeQName();

    if (this.cur === Token.AMP) return this.parseIsAnd(p, qname);
    if (this.cur === Token.PIPE) return this.parseIsOr(p, qname);
    if (this.cur === Token.QUESTION) return this.parseIsMaybe(p, qname);

    p.traits._is = qname;
    p.traits._type = "sys.Ref";
    p.traits._qnameLoc = qnameLoc;

    return true;
  }

  private parseIsAnd(p: ParsedProto, qname: string): boolean {
    const of = {
      children: [],
    };

    this.addToOf(of, qname, undefined, this.prevLoc);

    while (this.cur === Token.AMP) {
      this.consume();
      this.skipNewlines();
      const qname = this.parseIsSimple(
        "Expecting next proto name after '&' and symbol"
      );
      this.addToOf(of, qname, undefined, this.prevLoc);
    }

    p.traits._is = "sys.And";
    p.traits._of = of;

    return true;
  }

  private parseIsOr(
    p: ParsedProto,
    qname: string | undefined = undefined,
    val: string | undefined = undefined
  ): boolean {
    const of = {
      children: [],
    };

    this.addToOf(of, qname, val, this.prevLoc);

    while (this.cur === Token.PIPE) {
      this.consume();
      this.skipNewlines();

      if (this.cur.isVal) {
        this.addToOf(of, undefined, this.consumeVal(), this.prevLoc);
      } else {
        const qname = this.parseIsSimple(
          "Expecting next proto name after '|' or symbol"
        );
        this.addToOf(of, qname, undefined, this.prevLoc);
      }
    }

    p.traits._is = "sys.Or";
    p.traits._of = of;

    return true;
  }

  private parseIsMaybe(p: ParsedProto, qname: string): boolean {
    this.consume(Token.QUESTION);
    p.traits._is = "sys.Maybe";
    p.traits._of = { _is: qname };
    return true;
  }

  private parseIsSimple(errMsg: string): string {
    if (this.cur !== Token.ID) {
      this.err(errMsg, this.curToLoc());
    }

    return this.consumeQName();
  }

  private addToOf(
    of: ProtoOf,
    qname: string | undefined = undefined,
    val: string | undefined = undefined,
    loc: FileLoc | undefined = undefined
  ): void {
    const child: Record<string, any> = {};

    of.children.push(child);

    if (qname) {
      child._is = qname;
    }

    if (val) {
      child._val = val;
    }

    if (loc != null) {
      child._loc = {
        _is: "sys.Str",
        _val: loc,
      };
    }
  }

  private parseProtoChildren(
    proto: ParsedProto,
    open: Token,
    close: Token,
    isMeta: boolean
  ): boolean {
    const loc = this.curToLoc();
    this.consume(open);
    this.skipNewlines();

    this.parseProtos(proto, isMeta);
    this.parseProtos(proto, isMeta);

    if (this.cur !== close) {
      this.err(`Unmatched closing ${close.toString()}`, loc);
    }

    this.consume(close);

    return true;
  }

  /// ///////////////////////////////////////////////////////////////////////
  // Data
  /// ///////////////////////////////////////////////////////////////////////

  private parseLibData(proto: ParsedProto): void {
    proto.traits._is = "sys.Data";

    if (this.cur !== Token.COLON) {
      throw new Error("Expecting colon after instance id");
    }

    this.consume();

    const qnameLoc = new FileLoc(
      this.fileLoc.file,
      this.curLine,
      this.curCol - 1,
      this.curCharIndex - 1
    );

    if (this.cur !== Token.LBRACE) {
      const qname = this.consumeQName();
      proto.traits._is = qname;
      proto.traits._type = "sys.Ref";
    }

    proto.traits._qnameLoc = qnameLoc;

    if (this.cur !== Token.LBRACE) {
      this.err("Expecting '{' to start named instance dict", this.curToLoc());
    }

    this.parseDict(proto, Token.LBRACE, Token.RBRACE);
  }

  private parseDict(
    parent: ParsedProto,
    openToken: Token,
    closeToken: Token
  ): void {
    this.consume(openToken);
    this.skipNewlines();

    while (this.cur !== closeToken) {
      this.skipComments();

      const child = new ParsedProto(this.curToLoc());

      if (this.cur === Token.ID) {
        child.name = this.consumeName();

        if (this.cur !== Token.COLON) {
          child.traits = {
            _is: "sys.Marker",
          };
        } else {
          this.consume();

          this.parseData(child);
        }
      } else {
        this.parseData(child);
      }

      this.addToParent(parent, child, false);

      this.parseCommaOrNewline("Expecting end of dict tag", closeToken);
    }

    this.consume(closeToken);
  }

  private parseData(parent: ParsedProto): void {
    if (this.cur === Token.REF) {
      this.parseDataRef(parent);
      return;
    }

    if (this.cur === Token.STR || this.cur === Token.VAL) {
      this.parseScalar(parent);
      return;
    }

    if (this.cur === Token.LBRACE) {
      this.parseDict(parent, Token.LBRACE, Token.RBRACE);
    }

    /*
    if (name !== null) {
      this.parseDataSpec()
    }
    */
  }

  private parseDataRef(parent: ParsedProto): void {
    const child: ParsedProto = new ParsedProto(
      this.curToLoc(this.curCharIndex - 1),
      true
    );
    child.name = "@" + (this.curVal as string);
    child.traits._is = child.name;

    this.addToParent(parent, child, false);
    this.consume();
  }

  private parseScalar(parent: ParsedProto): void {
    const child: ParsedProto = new ParsedProto(this.curToLoc());
    child.name = this.curVal;

    this.addToParent(parent, child, false);
    this.consume();
  }

  /// ///////////////////////////////////////////////////////////////////////
  // AST Manipulation
  /// ///////////////////////////////////////////////////////////////////////
  private addToParent(
    parent: ParsedProto,
    child: ParsedProto,
    isMeta: boolean
  ): void {
    this.addDoc(child);
    this.addLoc(child);

    let name = child.name;

    if (child.isData) {
      child.traits["#isData"] = true;
    }

    if (name === null) {
      name = this.autoName(parent);
    } else {
      if (isMeta) {
        if (name === "is") this.err("Proto name 'is' is reserved", child.loc);
        if (name === "val") this.err("Proto name 'val' is reserved", child.loc);
        name = "_" + name;
        //  this may seem like a hack, because it is,
        //  but there is no change of collision with user provided names
        child.traits["#isMeta"] = {};
      }
      //  we may have an optional with meta
      if (parent.traits[name] && name !== "_of") {
        this.generateDuplicateDefErr(parent, child);
      }
    }

    if (name === "_of" && parent.traits[name]) {
      (parent.traits[name] as Record<string, any>)._of = child.traits;
    } else {
      parent.traits[name] = child.traits;
    }
  }

  private generateDuplicateDefErr(
    parent: ParsedProto,
    child: ParsedProto
  ): void {
    if (!child.name) {
      return;
    }

    const length = child.name.length;

    const existingLoc = (parent.traits[child.name] as any)._loc._val as FileLoc;
    const newLoc = child.loc;

    const firstError = new CompilerError(
      `Duplicate slot name ${child.name} at ${FileLoc.newWithOffset(
        newLoc,
        1
      ).toString()}`,
      ErrorTypes.DUPLICATED_SYMBOL,
      existingLoc,
      { ...existingLoc, col: existingLoc.col + length }
    );

    const secondError = new CompilerError(
      `Duplicate slot name ${child.name} at ${FileLoc.newWithOffset(
        existingLoc,
        1
      ).toString()}`,
      ErrorTypes.DUPLICATED_SYMBOL,
      newLoc,
      { ...newLoc, col: newLoc.col + length }
    );

    this.logErrCB(firstError);
    this.logErrCB(secondError);
  }

  private addDoc(p: ParsedProto): void {
    if (p.doc == null) return;

    p.traits._doc = {
      _is: "sys.Str",
      _val: p.doc,
      _loc: p.docLoc,
    };
  }

  private addLoc(p: ParsedProto): void {
    if (this.fileLoc === FileLoc.unknown) return;

    p.traits._loc = {
      _is: "sys.Str",
      _val: p.loc,
    };
  }

  private autoName(parent: ParsedProto): string {
    for (let i = 0; i < 1_000_000; ++i) {
      const name = `_${i}`;

      if (parent.traits[name] == null) {
        return name;
      }
    }

    throw new Error("To many children");
  }

  /// ///////////////////////////////////////////////////////////////////////
  // Doc
  /// ///////////////////////////////////////////////////////////////////////

  private parseLeadingDoc(): { doc: string; loc: FileLoc } | null {
    let doc: string | null = null;
    let loc: FileLoc | null = null;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      // skip leading blank lines
      this.skipNewlines();

      // if not a comment, then return null
      if (this.cur !== Token.COMMENT) return null;

      // parse one or more lines of comments
      doc = "";
      loc = this.curToLoc();
      while (this.cur === Token.COMMENT) {
        doc += `${this.curVal.toString() as string}\n`;
        this.consume();
        this.consume(Token.NL);
      }

      // if there is a blank line after comments, then
      // this comment does not apply to next production
      if (this.cur === Token.NL) continue;

      // use this comment as our doc
      doc = trimToNull(doc);
      break;
    }
    if (!doc || !loc) {
      return null;
    }

    return {
      doc,
      loc,
    };
  }

  private parseTrailingDoc(proto: ParsedProto): void {
    if (this.cur === Token.COMMENT) {
      const doc = trimToNull(this.curVal.toString());
      if (doc != null && proto.doc == null) proto.doc = doc;
      this.consume();
    }
  }

  /// ///////////////////////////////////////////////////////////////////////
  // Char Reads
  /// ///////////////////////////////////////////////////////////////////////

  private parseCommaOrNewline(errMsg: string, close: Token): void {
    if (this.cur === Token.COMMA) {
      this.consume();
      this.skipNewlines();
      return;
    }

    if (this.cur === Token.NL) {
      this.skipNewlines();
      return;
    }

    if (this.cur === close) {
      return;
    }

    this.err(
      `${errMsg} comma or newline, no ${this.cur.toString()}`,
      this.curToLoc()
    );
  }

  private skipComments(): void {
    while (this.cur === Token.COMMENT || this.cur === Token.NL) {
      this.consume();
    }
  }

  private skipNewlines(): boolean {
    if (this.cur !== Token.NL) return false;
    while (this.cur === Token.NL) this.consume();
    return true;
  }

  private verify(expected: Token): void {
    if (this.cur !== expected)
      throw new Error(
        `Expected ${expected.toString()} not ${this.cur.toString()}`
      );
  }

  private curToLoc(charIndex: number = -1): FileLoc {
    return new FileLoc(
      this.fileLoc.file,
      this.curLine,
      this.curCol,
      charIndex !== -1 ? charIndex : this.tokenizer.charIndex
    );
  }

  private consumeQName(): string {
    let qname = this.consumeName();

    while (this.cur === Token.DOT) {
      this.consume();
      qname += "." + this.consumeName();
    }

    if (this.cur === Token.DOUBLE_COLON) {
      this.consume();
      qname += "::" + this.consumeName();
    }

    return qname;
  }

  private consumeName(): string {
    this.verify(Token.ID);
    const name = this.curVal.toString();
    this.consume();
    return name;
  }

  private consumeDataName(): string {
    this.verify(Token.REF);
    const name = this.curVal.toString();
    this.consume();

    return name;
  }

  private consumeVal(): string {
    this.verify(Token.STR);
    const val = this.curVal;
    this.consume();

    return val;
  }

  private consume(expected: Token | undefined = undefined): void {
    if (expected !== undefined) this.verify(expected);

    this.prevLoc = new FileLoc(
      this.fileLoc.file,
      this.curLine,
      this.curCol,
      this.curCharIndex
    );

    this.cur = this.peek;
    this.curVal = this.peekVal;
    this.curLine = this.peekLine;
    this.curCol = this.peekCol;
    this.curCharIndex = this.peekCharIndex;

    this._tokenBag.push({
      token: this.peek,
      val: this.tokenizer.val,
      indexInInput: this.curCharIndex,
      col: this.curCol,
      line: this.curLine,
    });

    try {
      this.peek = this.tokenizer.next();
      this.peekVal = this.tokenizer.val;
      this.peekLine = this.tokenizer.line;
      this.peekCol = this.tokenizer.col;
      this.peekCharIndex = this.tokenizer.charIndex;

      if (this.tokenizer.currentError != null) {
        this.logErrCB(this.tokenizer.currentError);
      }
    } catch (e: any) {
      // we have a CompilerError
      if (e.type) {
        this.err(e, e.loc);
      }
    }
  }

  private err(msg: string, loc: FileLoc = this.curToLoc()): void {
    this.logErrCB(`${msg}`, ErrorTypes.MISSING_TOKEN, loc);
  }
}
