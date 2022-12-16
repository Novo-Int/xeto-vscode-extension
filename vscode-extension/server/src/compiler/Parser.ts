import { Token } from "./Token";
import { Tokenizer } from "./Tokenizer";
import { FileLoc } from "./FileLoc";
import { toCode, isLower, trimToNull } from "./StringUtils";

import { CPragma, CType, CLib, CProto } from "./CTypes";
import { IStep } from "./steps/IStep";
import { CompilerError, ErrorTypes } from './Errors';

export class Parser {
  private step: IStep;
  private fileLoc: FileLoc;
  private tokenizer: Tokenizer;
  private pragma?: CPragma;

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

  public parse(lib: CLib, isLibMetaFile: boolean) {
    try {
      this.parsePragma(lib, isLibMetaFile);
      this.parseProtos(lib.proto!, false);
      this.verify(Token.EOF);
    } catch (e: any) {
      this.err(e.message);
    }
  }
  private parsePragma(lib: CLib, isLibMetaFile: boolean) {
    this.pragma = new CPragma(this.fileLoc, lib);

    if (isLibMetaFile) {
      this.parseLibMeta(lib);
      lib.proto!.pragma = new CPragma(this.fileLoc, lib);
    }
  }

  private parseLibMeta(lib: CLib) {
    const doc = this.parseLeadingDoc();

    if (this.cur !== Token.LIB_META) {
      this.err(`Expecting #<> lib meta, not ${this.curToStr()}`);
    }

    this.parseProtoChildren(lib.proto!, Token.LIB_META, Token.GT, true);
  }

  //Protos

  private parseProtos(parent: CProto, isMeta: boolean) {
    while (true) {
      const proto = this.parseProto(parent, isMeta);
      if (proto === null) break;
      this.addProto(parent, proto);
      this.parseEndOfProto();
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

  private parseProto(parent: CProto, isMeta: boolean): CProto | null {
    let p = this.parseUnion(parent, isMeta);
    if (p === null || this.cur !== Token.AMP) return p;

    const intersection = this.hoistCompound(p, "sys.Intersection");
    const of = intersection.getOwn("_of");

    if (!of) {
      throw this.err(`Expecting to have _of in ${intersection.name}`);
    }

    while (this.cur === Token.AMP) {
      const ampLoc = this.curToLoc();
      this.consume(Token.AMP);
      this.skipNewlines();
      p = this.parseSimple(of, false);
      if (p === null)
        this.err(
          `Expecting proto after & in intersection type, not ${this.curToStr()} at ${ampLoc}`
        );
      if (p !== null) this.addProto(of, p);
    }

    return intersection;
  }

  private parseUnion(parent: CProto, isMeta: boolean): CProto | null {
    let p = this.parseSimple(parent, isMeta);
    if (p === null || this.cur !== Token.PIPE) return p;

    const union = this.hoistCompound(p, "sys.Union");
    const of = union.getOwn("_of");

    if (!of) {
      throw this.err(`Expecting to have _of in ${union.name}`);
    }

    while (this.cur === Token.PIPE) {
      const pipeLoc = this.curToLoc();
      this.consume(Token.PIPE);
      this.skipNewlines();
      p = this.parseSimple(of, false);
      if (p === null)
        this.err(
          `Expecting proto after | in union type, not ${this.curToStr()}`
        );
      if (p !== null) this.addProto(of, p);
    }
    return union;
  }

  private parseSimple(parent: CProto, isMeta: boolean): CProto | null {
    // leading comment
    const doc = this.parseLeadingDoc();

    // end of file or closing symbols
    if (this.cur === Token.EOF) return null;
    if (this.cur === Token.RBRACE) return null;
    if (this.cur === Token.GT) return null;

    // this token is start of our proto production
    const loc = this.curToLoc();

    // parse name+type productions as one of three cases:
    //  1) <name> ":" for named child
    //  2) <name> "." for qnamed child
    //  3) <name> "? :" for optional named child
    //  4) <name> only as shortcut for name:Marker (if lowercase name only)
    //  5) unnamed child, auto assign name using "_digits"
    let name = "";
    let type: CType | undefined;
    let optional = false;

    if (this.cur === Token.ID && this.peek === Token.COLON) {
      // 1) <name> ":" for named child
      name = this.parseProtoName(isMeta);
      this.consume(Token.COLON);
      this.skipNewlines();
      type = this.parseProtoType();
    } else if (this.cur === Token.ID && this.peek === Token.DOT) {
      // 2) <name> "." for qnamed child
      name = this.parseProtoName(isMeta);
      while (this.cur === Token.DOT) {
        this.consume();
        name = `${name}.${this.consumeName()}`;
      }

      if (this.cur === Token.COLON) {
        // name: ....
        this.consume(Token.COLON);
        this.skipNewlines();
        type = this.parseProtoType();
      } else {
        // no colon is unnamed, and name is the qualified type
        type = new CType(loc, name);
        name = parent.assignName;
      }
    } else if (this.cur === Token.ID && this.peek === Token.QUESTION) {
      // 3) <name> "? :" for optional named child
      name = this.parseProtoName(isMeta);
      optional = true;
      this.consume(Token.QUESTION);
      this.consume(Token.COLON);
      this.skipNewlines();
      type = this.parseProtoType();
    } else if (
      this.cur === Token.ID &&
      this.peek !== Token.COLON &&
      isLower(this.curVal.toString())
    ) {
      // 4) <name> only as shortcut for name:Marker (if lowercase name only)
      name = this.parseProtoName(isMeta);
      type = new CType(loc, "sys.Marker");
    } else {
      // 5) unnamed child, auto assign name using "_digits"
      name = parent.assignName;
      type = this.parseProtoType();
    }

    // create the proto
    const proto = this.makeProto(loc, name, doc, type);
    if (optional) this.addMarker(proto, "_optional");

    // proto body <meta> {data} "val"
    const hasType = proto.type !== undefined;
    const hasMeta = this.parseProtoMeta(proto);
    const hasData = this.parseProtoData(proto);
    const hasVal = this.parseProtoVal(proto);
    this.parseTrailingDoc(parent);

    // verify we had one production: type |meta | data | val
    if (!(hasType || hasMeta || hasData || hasVal)) {
      //throw new Error(`Expecting proto body: ${loc}`);
      this.err(`Expecting proto body: ${loc}`);
    }

    return proto;
  }

  private parseProtoName(isMeta: boolean): string {
    let name = this.consumeName();
    if (isMeta) name = "_" + name;
    return name;
  }

  private parseProtoType(): CType | undefined {
    if (this.cur !== Token.ID) return undefined;
    const loc = this.curToLoc();
    let name = this.consumeName();

    while (this.cur === Token.DOT) {
      this.consume();
      name += "." + this.consumeName();
    }
    return new CType(loc, name);
  }

  private parseProtoMeta(parent: CProto): boolean {
    return this.parseProtoChildren(parent, Token.LT, Token.GT, true);
  }

  private parseProtoData(parent: CProto): boolean {
    return this.parseProtoChildren(parent, Token.LBRACE, Token.RBRACE, false);
  }

  private parseProtoChildren(
    parent: CProto,
    open: Token,
    close: Token,
    isMeta: boolean
  ): boolean {
    if (this.cur !== open) return false;
    this.consume();
    this.skipNewlines();
    this.parseProtos(parent, isMeta);
    //while (cur !== close) parseProto(parent, isMeta)
    this.consume(close);
    return true;
  }

  private parseProtoVal(proto: CProto): boolean {
    if (!this.cur.isLiteral) return false;
    proto.val = this.curVal;
    this.consume();
    return true;
  }

  //////////////////////////////////////////////////////////////////////////
  // AST Manipulation
  //////////////////////////////////////////////////////////////////////////

  private makeProto(
    loc: FileLoc,
    name: string,
    doc?: string,
    type?: CType
  ): CProto {
    const proto = new CProto(loc, name, doc, type);
    proto.pragma = this.pragma;
    return proto;
  }

  private addMarker(parent: CProto, name: string) {
    const loc = parent.loc;
    this.addProto(
      parent,
      this.makeProto(loc, name, undefined, new CType(loc, "sys.Marker"))
    );
  }

  private addProto(parent: CProto, child: CProto) {
    this.step.addSlot(parent, child);
  }

  private hoistCompound(p: CProto, type: string): CProto {
    // this method hoists P to Union <of:List { _0: P }>

    // allocate new sys.Union/Intersection object to replace proto we just parsed
    const loc = p.loc;
    const compound = this.makeProto(loc, p.name, p.doc, new CType(loc, type));

    // allocate <of> object
    const of = this.makeProto(
      loc,
      "_of",
      undefined,
      new CType(loc, "sys.List")
    );
    this.addProto(compound, of);

    // now re-create the proto we just parsed as _0 as first item of <of>
    const first = this.makeProto(loc, of.assignName, undefined, p.type);
    first.children = p.children;
    first.val = p.val;
    this.addProto(of, first);

    return compound;
  }

  //////////////////////////////////////////////////////////////////////////
  // Doc
  //////////////////////////////////////////////////////////////////////////

  private parseLeadingDoc(): string | undefined {
    let doc: string | undefined = undefined;

    while (true) {
      // skip leading blank lines
      this.skipNewlines();

      // if not a comment, then return null
      if (this.cur !== Token.COMMENT) return undefined;

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

  private parseTrailingDoc(proto: CProto) {
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

  private curToStr(): string {
    return this.curVal !== null
      ? `${this.cur} ${toCode(this.curVal.toString())}`
      : this.cur.toString();
  }

  private consumeName(): string {
    this.verify(Token.ID);
    const name = this.curVal.toString();
    this.consume();
    return name;
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
        this.err(e);
      }
    }
  }

  private err(msg: string, loc: FileLoc = this.curToLoc()): void {
    this.step.compiler.logErr(`${msg}`, ErrorTypes.MISSING_TOKEN, loc);
  }
}
