"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Token = void 0;
class Token {
    constructor(dis, isVal = false) {
        this.dis = dis;
        this.symbol = dis;
        this.isVal = isVal;
    }
    toString() {
        return this.dis;
    }
}
exports.Token = Token;
Token.ID = new Token("identifier");
Token.STR = new Token("Str", true);
Token.VAL = new Token("value", true);
// operators
Token.DOT = new Token(".");
Token.COLON = new Token(":");
Token.COMMA = new Token(",");
Token.LT = new Token("<");
Token.GT = new Token(">");
Token.LBRACE = new Token("{");
Token.RBRACE = new Token("}");
Token.LPAREN = new Token("(");
Token.RPAREN = new Token(")");
Token.LBRACKET = new Token("[");
Token.RBRACKET = new Token("]");
Token.QUESTION = new Token("?");
Token.AMP = new Token("&");
Token.PIPE = new Token("|");
Token.NL = new Token("newline");
// misc
Token.COMMENT = new Token("comment");
Token.EOF = new Token("eof");
// unknown
Token.UNKNOWN = new Token("unknown");
//# sourceMappingURL=Token.js.map