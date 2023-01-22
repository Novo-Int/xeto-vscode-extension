import { Token } from "./Token";
import { Tokenizer } from "./Tokenizer";
import { FileLoc } from "./FileLoc";
import { isLower, trimToNull } from "./StringUtils";

import { IStep } from "./steps/IStep";
import { ErrorTypes } from './Errors';

class ParsedProto {
  readonly loc: FileLoc;
  public doc: string | null;
  public name: string | null;
  public traits: Record<string, unknown> = {};
 
  constructor (loc: FileLoc) {
    this.loc = loc;
    this.doc = null;
    this.name = null;
  }
}

export class Parser {
  private step: IStep;
  private fileLoc: FileLoc;
  private tokenizer: Tokenizer;

  private cur: Token; // current token
  private curVal: any; // current token value
  private curLine = 0; // current token line number
  private curCol = 0; // current token col number

  private peek: Token; // next token
  private peekVal: any; // next token value
  private peekLine = 0; // next token line number
  private peekCol = 0; // next token col number

  public constructor(input: string, step: IStep) {
    this.step = step;

    this.fileLoc = new FileLoc("input");

    this.tokenizer = new Tokenizer(input);

    this.cur = this.peek = Token.EOF;
    this.consume();
    this.consume();
  }

  public parse(root: Record<string, unknown>) {
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

  //Protos

  private parseProtos(parent: ParsedProto, isMeta: boolean) {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const child = this.parseProto();
      if (child === null) break;
      this.parseEndOfProto();
      this.addToParent(parent, child, isMeta);
    }
  }

  private parseEndOfProto() {
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

    this.err(
      `Expecting end of proto: comma or newline, not ${this.cur.toString()}`
    );

    // consume the char
    this.consume();
  }

  private parseProto(): ParsedProto | null {
    // leading comment
    const doc = this.parseLeadingDoc();

    // end of file or closing symbols
    if (this.cur === Token.EOF) return null;
    if (this.cur === Token.RBRACE) return null;
    if (this.cur === Token.GT) return null;

    // this token is start of our proto production
    const proto = new ParsedProto(this.curToLoc());
    proto.doc = doc;

    // <markerOnly> | <named> | <unnamed>
    if (this.cur === Token.ID && this.peek === Token.COLON) {
      proto.name = this.consumeName();
      this.consume(Token.COLON);
      this.parseBody(proto);
    }
    else if (this.cur === Token.ID && isLower(this.curVal.toString()) && this.peek !== Token.DOT) {
      proto.name = this.consumeName();
      proto.traits = {
        "_is": "sys.Marker"
      };
    } else {
      this.parseBody(proto);
    }
    
    this.parseTrailingDoc(proto);

    return proto;
  }

  private parseBody(proto: ParsedProto) {
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
    proto.traits["_val"] = this.curVal;
    this.consume();
    return true;
  }

  private parseIs(p: ParsedProto): boolean {
    if (this.cur === Token.STR && this.peek === Token.PIPE) {
      return this.parseIsOr(p, undefined, this.consumeVal());
    }

    if (this.cur !== Token.ID) return false;

    const qname = this.consumeQName();

    if (this.cur === Token.AMP)      return this.parseIsAnd(p, qname);
    if (this.cur === Token.PIPE)     return this.parseIsOr(p, qname);
    if (this.cur === Token.QUESTION) return this.parseIsMaybe(p, qname);

    p.traits["_is"] = qname;

    return true;
  }

  private parseIsAnd(p: ParsedProto, qname: string): boolean{
    const of = {};
    this.addToOf(of, qname, undefined);

    while (this.cur === Token.AMP) {
      this.consume();
      this.skipNewlines();
      this.addToOf(of, this.parseIsSimple("Expecting next proto name after '&' and symbol"));
    }

    p.traits["_is"] = "sys.And";
    p.traits["_of"] = of;

    return true;
  }

  private parseIsOr(p: ParsedProto, qname: string | undefined = undefined, val: string | undefined = undefined): boolean {
    const of = {};

    this.addToOf(of, qname, val);

    while (this.cur === Token.PIPE) {
      this.consume();
      this.skipNewlines();

      if (this.cur.isVal) {
        this.addToOf(of, undefined, this.consumeVal());
      } else {
        this.addToOf(of, this.parseIsSimple("Expecting next proto name after '|' or symbol"));
      }
    }

    p.traits["_is"] = "sys.Or";
    p.traits["_of"] = of;

    return true;
  }

  private parseIsMaybe(p: ParsedProto, qname: string): boolean {
    this.consume(Token.QUESTION);
    p.traits["_is"] = "sys.Maybe";
    p.traits["_of"] = {"_is": qname};
    return true;
  }

  private parseIsSimple(errMsg: string): string {
    if (this.cur !== Token.ID) {
      this.err(errMsg, this.curToLoc());
    }

    return this.consumeQName();
  }

  private addToOf(of: Record<string, unknown>, qname: string | undefined = undefined, val: string | undefined = undefined) {
    of["_" + Object.keys(of).length] = {};

    if (qname) {
      of["_is"] = qname;
    }

    if (val) {
      of["_val"] = val;
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
      this.err(`Unmatched closing ${close}`, loc);
    }

    this.consume(close);

    return true;
  }

  //////////////////////////////////////////////////////////////////////////
  // AST Manipulation
  //////////////////////////////////////////////////////////////////////////
  private addToParent(parent: ParsedProto, child: ParsedProto, isMeta: boolean) {
    this.addDoc(child);
    this.addLoc(child);

    let name = child.name;

    if (name === null) {
      name = this.autoName(parent);
    } else {
      if (isMeta) {
        if (name === "is") this.err("Proto name 'is' is reserved", child.loc);
        if (name === "val") this.err("Proto name 'val' is reserved", child.loc);
        name = "_" + name;
      }
      if (parent.traits[name]) {
        this.err("Duplicate names '$name'", child.loc);
      }
    }

    parent.traits[name] = child.traits;
  }

  private addDoc(p: ParsedProto) {
    if (p.doc == null) return;

    p.traits["_doc"] = {
      "_is": "sys.Str",
      "_val": p.doc
    };
  }

  private addLoc(p: ParsedProto) {
    if (this.fileLoc === FileLoc.unknown) return;

    p.traits["_loc"] = {
      "_is": "sys.Str",
      "_val": p.loc
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

  //////////////////////////////////////////////////////////////////////////
  // Doc
  //////////////////////////////////////////////////////////////////////////

  private parseLeadingDoc(): string | null {
    let doc: string | null = null;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      // skip leading blank lines
      this.skipNewlines();

      // if not a comment, then return null
      if (this.cur !== Token.COMMENT) return null;

      // parse one or more lines of comments
      doc = "";
      while (this.cur === Token.COMMENT) {
        doc += `${this.curVal.toString()}\n`;
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
    return doc;
  }

  private parseTrailingDoc(proto: ParsedProto) {
    if (this.cur === Token.COMMENT) {
      const doc = trimToNull(this.curVal.toString());
      if (doc != null && proto.doc == null) proto.doc = doc;
      this.consume();
    }
  }

  //////////////////////////////////////////////////////////////////////////
  // Char Reads
  //////////////////////////////////////////////////////////////////////////

  private skipNewlines(): boolean {
    if (this.cur !== Token.NL) return false;
    while (this.cur === Token.NL) this.consume();
    return true;
  }

  private verify(expected: Token) {
    if (this.cur !== expected)
      throw new Error(`Expected ${expected} not ${this.cur.toString()}`);
  }

  private curToLoc(): FileLoc {
    return new FileLoc(this.fileLoc.file, this.curLine, this.curCol, this.tokenizer.charIndex);
  }

  private consumeQName(): string {
    let qname = this.consumeName();

    while (this.cur === Token.DOT) {
      this.consume();
      qname += "." + this.consumeName();
    }

    return qname;
  }

  private consumeName(): string {
    this.verify(Token.ID);
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

  private consume(expected: Token | undefined = undefined) {
    if (expected !== undefined) this.verify(expected);

    this.cur = this.peek;
    this.curVal = this.peekVal;
    this.curLine = this.peekLine;
    this.curCol = this.peekCol;

    try {
      this.peek = this.tokenizer.next();
      this.peekVal = this.tokenizer.val;
      this.peekLine = this.tokenizer.line;
      this.peekCol = this.tokenizer.col;

      if (this.tokenizer.currentError) {
        this.step.compiler.logErr(this.tokenizer.currentError);
      }
    } catch (e: any) {
      // we have a CompilerError
      if (e.type) {
        this.err(e, e.loc);
      }
    }
  }

  private err(msg: string, loc: FileLoc = this.curToLoc()): void {
    this.step.compiler.logErr(`${msg}`, ErrorTypes.MISSING_TOKEN, loc);
  }
}
