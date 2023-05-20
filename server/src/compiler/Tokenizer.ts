import { CompilerError, ErrorTypes } from "./Errors";
import { FileLoc } from "./FileLoc";
import {
  isAlpha,
  isAlphaNumeric,
  isNumeric,
  toHex,
  toCode,
} from "./StringUtils";
import { Token } from "./Token";

export class Tokenizer {
  private tok: Token;
  private readonly input: string;

  public currentError?: CompilerError;

  private cur = "";
  private peek = "";
  private peekLine = 0;
  private peekCol = 0;
  private curLine = 1;
  private curCol = 0;
  private curCharIndex = 0;

  public col = 1;
  public line = 1;
  public charIndex = 0;
  public val: any = null;

  private currentIndexInInput = 0;

  public keepComments = true;

  public constructor(input: string) {
    this.input = input;
    this.tok = Token.EOF;

    this.consume();
    this.consume();
  }

  public next(): Token {
    // reset
    this.val = null;
    this.currentError = undefined;

    // skip non-meaningful whitespace and comments
    // eslint-disable-next-line no-constant-condition
    while (true) {
      // treat space, tab, non-breaking space as whitespace
      if (
        this.cur === " " ||
        this.cur === "\t" ||
        this.cur.charCodeAt(0) === 0xa0
      ) {
        this.consume();
        continue;
      }

      // comments
      if (this.cur === "/") {
        if (this.peek === "/" && this.keepComments) {
          this.lockLoc();
          this.tok = this.parseComment();
          return this.tok;
        }
        if (this.peek === "/") {
          this.skipCommentSL();
          continue;
        }
        if (this.peek === "*") {
          this.skipCommentML();
          continue;
        }
      }

      break;
    }

    // lock in location
    this.lockLoc();

    // newlines
    if (this.cur === "\n" || this.cur === "\r") {
      if (this.cur === "\r" && this.peek === "\n") {
        this.consume();
      }
      this.consume();
      this.tok = Token.NL;
      this.val = "\n";
      return this.tok;
    }

    // handle various starting chars
    if (isAlpha(this.cur)) {
      this.tok = this.id();
      return this.tok;
    }

    if (this.cur === '"') {
      this.tok = this.str();
      return this.tok;
    }

    if (isNumeric(this.cur)) {
      this.tok = this.num();
      return this.tok;
    }

    if (this.cur === "-" && isNumeric(this.peek)) {
      this.tok = this.num();
      return this.tok;
    }

    // operator
    this.tok = this.operator();

    return this.tok;
  }

  private lockLoc(): void {
    this.col = this.curCol;
    this.line = this.curLine;
    this.charIndex = this.curCharIndex;
  }

  // Token Productions
  private id(): Token {
    let s = "";

    while (isAlphaNumeric(this.cur) || this.cur === "_") {
      s += this.cur;
      this.consume();
    }

    // normal id
    this.val = s;
    return Token.ID;
  }

  private str(): Token {
    this.consume(); // opening quote
    const isTriple = this.cur === '"' && this.peek === '"';

    if (isTriple) {
      this.consume();
      this.consume();
    }

    let s = "";

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const ch = this.cur;
      if (ch === '"') {
        this.consume();
        if (isTriple) {
          if (this.cur !== '"' || this.peek !== '"') {
            s += '"';
            continue;
          }

          this.consume();
          this.consume();
        }

        break;
      }

      if (ch === "\0") {
        this.currentError = new CompilerError(
          "Unexpected end of str",
          ErrorTypes.UNCLOSED_STRING,
          new FileLoc("", this.line, this.col, this.charIndex),
          new FileLoc("", this.curLine, this.curCol)
        );
        this.val = s;
        return Token.STR;
      }

      if (ch === "\\") {
        s += this.escape();
        continue;
      }

      this.consume();
      s += ch;
    }

    this.val = s;
    return Token.STR;
  }

  private escape(): string {
    // consume slash
    this.consume();

    // check basics
    switch (this.cur) {
      case "b":
        this.consume();
        return "\b";
      case "f":
        this.consume();
        return "\f";
      case "n":
        this.consume();
        return "\n";
      case "r":
        this.consume();
        return "\r";
      case "t":
        this.consume();
        return "\t";
      case '"':
        this.consume();
        return '"';
      case "$":
        this.consume();
        return "$";
      case "'":
        this.consume();
        return "'";
      case "`":
        this.consume();
        return "`";
      case "\\":
        this.consume();
        return "\\";
    }

    // check for uxxxx
    if (this.cur === "u") {
      this.consume();

      const n3 = parseInt(this.cur, 16);
      this.consume();
      const n2 = parseInt(this.cur, 16);
      this.consume();
      const n1 = parseInt(this.cur, 16);
      this.consume();
      const n0 = parseInt(this.cur, 16);
      this.consume();

      if (isNaN(n3) || isNaN(n2) || isNaN(n1) || isNaN(n0)) {
        throw new Error("Invalid hex value for \\uxxxx");
      }

      return String.fromCharCode((n3 << 12) | (n2 << 8) | (n1 << 4) | n0);
    }

    throw new Error("Invalid escape sequence");
  }

  private num(): Token {
    let s = "";
    while (this.isNum(this.cur)) {
      s += this.cur;
      this.consume();
    }
    this.val = s;
    return Token.VAL;
  }

  private isNum(c: string): boolean {
    return (
      isAlphaNumeric(c) ||
      c === "-" ||
      c === "." ||
      c === "$" ||
      c === ":" ||
      c === "/" ||
      c === "%" ||
      c.charCodeAt(0) > 128
    );
  }

  private operator(): Token {
    const c = this.cur;
    this.consume();

    switch (c) {
      case ",":
        return Token.COMMA;
      case ":":
        return Token.COLON;
      case "[":
        return Token.LBRACKET;
      case "]":
        return Token.RBRACKET;
      case "{":
        return Token.LBRACE;
      case "}":
        return Token.RBRACE;
      case "(":
        return Token.LPAREN;
      case ")":
        return Token.RPAREN;
      case "<":
        return Token.LT;
      case ">":
        return Token.GT;
      case ".":
        return Token.DOT;
      case "?":
        return Token.QUESTION;
      case "&":
        return Token.AMP;
      case "|":
        return Token.PIPE;
      case "\0":
        return Token.EOF;
    }

    if (c === "\0") return Token.EOF;

    if (c === "") {
      return Token.UNKNOWN;
    }

    throw new CompilerError(
      `Unexpected symbol: ${toCode(c, "'")} (0x${toHex(c)})`,
      ErrorTypes.UNCLOSED_STRING,
      new FileLoc("", this.line, this.col, this.charIndex),
      new FileLoc("", this.curLine, this.curCol)
    );
  }

  // Comments
  private parseComment(): Token {
    let comment = "";

    this.consume(); // first slash
    this.consume(); // next slash
    if (this.cur === " ") this.consume(); // first space

    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (this.cur === "\n" || this.cur === "\0") break;
      comment += this.cur;

      this.consume();
    }

    this.val = comment;

    return Token.COMMENT;
  }

  private skipCommentSL(): void {
    this.consume(); // first slash
    this.consume(); // next slash

    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (this.cur === "\n" || this.cur === "\0") break;
      this.consume();
    }
  }

  private skipCommentML(): void {
    this.consume(); // first slash
    this.consume(); // next slash
    let depth = 1;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (this.cur === "*" && this.peek === "/") {
        this.consume();
        this.consume();
        depth--;
        if (depth <= 0) {
          break;
        }
      }

      if (this.cur === "/" && this.peek === "*") {
        this.consume();
        this.consume();
        depth++;
        continue;
      }

      if (this.cur === "\0") {
        break;
      }

      this.consume();
    }
  }

  private consume(): void {
    this.cur = this.peek;
    this.curLine = this.peekLine;
    this.curCol = this.peekCol;
    this.curCharIndex = this.currentIndexInInput;

    this.peek = this.input.charAt(this.currentIndexInInput);

    if (this.peek === "\n") {
      this.peekLine++;
      this.peekCol = 0;
    } else {
      this.peekCol++;
    }

    this.currentIndexInInput++;
  }
}
