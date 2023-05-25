export class Token {
  static ID = new Token("identifier");
  static STR = new Token("Str", true);
  static VAL = new Token("value", true);

  // operators
  static DOT = new Token(".");
  static COLON = new Token(":");
  static DOUBLE_COLON = new Token("::");
  static COMMA = new Token(",");
  static LT = new Token("<");
  static GT = new Token(">");
  static LBRACE = new Token("{");
  static RBRACE = new Token("}");
  static LPAREN = new Token("(");
  static RPAREN = new Token(")");
  static LBRACKET = new Token("[");
  static RBRACKET = new Token("]");
  static QUESTION = new Token("?");
  static AMP = new Token("&");
  static PIPE = new Token("|");
  static NL = new Token("newline");

  // misc
  static COMMENT = new Token("comment");
  static EOF = new Token("eof");

  // unknown
  static UNKNOWN = new Token("unknown");

  private readonly dis: string;
  private readonly symbol: string;
  public readonly isVal: boolean;

  private constructor(dis: string, isVal = false) {
    this.dis = dis;
    this.symbol = dis;
    this.isVal = isVal;
  }

  public toString(): string {
    return this.dis;
  }
}
