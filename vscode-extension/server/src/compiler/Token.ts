export class Token {
  static ID = new Token("identifier");
  static STR = new Token("Str", true);

  // operators
  static DOT = new Token(".");
  static COLON = new Token(":");
  static COMMA = new Token(",");
  static SEMICOLON = new Token(";");
  static LT = new Token("<");
  static GT = new Token(">");
  static LBRACE = new Token("{");
  static RBRACE = new Token("}");
  static LPAREN = new Token("(");
  static RPAREN = new Token(")");
  static LBRACKET = new Token("[");
  static RBRACKET = new Token("]");
  static POUND = new Token("#");
  static LIB_META = new Token("#<");
  static PRAGMA = new Token("#{");
  static QUESTION = new Token("?");
  static AMP = new Token("&");
  static PIPE = new Token("|");
  static NL = new Token("newline");

  // misc
  static COMMENT = new Token("comment");
  static EOF = new Token("eof");

  // unknown
  static UNKNOWN = new Token("unknown");

  private dis: string;
  public readonly isLiteral: boolean;

  private constructor (dis: string, isLiteral = false) {
    this.dis = dis;
    this.isLiteral = isLiteral;
  }

  public toString(): string {
    return this.dis;
  }
}
