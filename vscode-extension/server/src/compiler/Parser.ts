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

  public constructor(input: string, step: IStep, loc = "input") {
    this.step = step;

    this.fileLoc = new FileLoc(loc);

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
    //  3) <name> only as shortcut for name:Marker (if lowercase name only)
    //  4) unnamed child, auto assign name using "_digits"
    let name = "";
    let type: CType | undefined;
    const optional = false;

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
    } else if (this.cur === Token.ID && this.peek !== Token.COLON && isLower(this.curVal.toString())) {
      // 3) <name> only as shortcut for name:Marker (if lowercase name only)
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

  /*
  <protoType>        :=  <protoTypeOr> | <protoTypeAnd> | <protoTypeMaybe> | <protoTypeSimple>
  <protoTypeOr>      :=  <protoTypeOrPart> ("|" <protoTypeOrPart>)*
  <protoTypeOrPart>  :=  [<protoTypeSimple>] [<protoVal>]  // must have at least one of these productions
  <protoTypeAnd>     :=  <protoTypeSimple> ("&" <protoTypeSimple>)*
  <protoMaybe>       :=  <protoTypeSimple> "?"
  <protoTypeSimple>  :=  <qname>
  */
  private parseProtoType(): CType | undefined {
    // special case for "foo" | "bar"
    if (this.cur === Token.STR && this.peek === Token.PIPE) {
      return this.parseProtoTypeOr(this.parseProtoTypeOrPart());
    }

    // consume simple qname
    const simple = this.parseProtoTypeSimple();
    if (simple === undefined ) return simple;

    // now check for and/or/maybe
    if (this.cur === Token.QUESTION) {
      this.consume();
      return CType.makeMaybe(simple);
    }

    if (this.cur === Token.AMP) {
      return this.parseProtoTypeAnd(simple);
    }
    if (this.cur === Token.PIPE) {
      return this.parseProtoTypeOr(simple);
    }
    if (this.cur === Token.STR && this.peek === Token.PIPE) {
      return this.parseProtoTypeOr(simple);
    }

    return simple;
  }

  private parseProtoTypeOr(first: CType): CType
  {
    // if first item is Str "val"
    if (this.cur === Token.STR) {
      this.consume();
      first = new CType(first.loc, first.name, this.curVal);
    }

    const of = [first];

    while (this.cur === Token.PIPE) {
      this.consume();
      this.skipNewlines();
      of.push(this.parseProtoTypeOrPart());
    }
    return CType.makeOr(of);
  }

  private parseProtoTypeOrPart(): CType {
    const loc = this.curToLoc();

    const name = this.parseProtoTypeSimple()?.name;
    let val = undefined;

    if (this.cur === Token.STR) {
      val = this.curVal;
      this.consume();
    }

    if (name === undefined && (val === null || val === undefined)) {
      this.err("Expecting name or value for or-part", loc);
    }

    return new CType(loc, name ?? "sys.Str", val);
  }

  private parseProtoTypeAnd(first: CType): CType | undefined {
    const of = [first];

    while (this.cur === Token.AMP) {
      this.consume();
      this.skipNewlines();
      const part = this.parseProtoTypeSimple();

      if (!part) {
        throw new Error("Expecting name for and-part");
      }

      of.push(part);
    }
    return CType.makeAnd(of);
  }

  private parseProtoTypeSimple(): CType | undefined {
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
