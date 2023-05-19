"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tokenizer = void 0;
const Errors_1 = require("./Errors");
const FileLoc_1 = require("./FileLoc");
const StringUtils_1 = require("./StringUtils");
const Token_1 = require("./Token");
class Tokenizer {
    constructor(input) {
        this.cur = "";
        this.peek = "";
        this.peekLine = 0;
        this.peekCol = 0;
        this.curLine = 1;
        this.curCol = 0;
        this.curCharIndex = 0;
        this.col = 1;
        this.line = 1;
        this.charIndex = 0;
        this.val = null;
        this.currentIndexInInput = 0;
        this.keepComments = true;
        this.input = input;
        this.tok = Token_1.Token.EOF;
        this.consume();
        this.consume();
    }
    next() {
        // reset
        this.val = null;
        this.currentError = undefined;
        // skip non-meaningful whitespace and comments
        // eslint-disable-next-line no-constant-condition
        while (true) {
            // treat space, tab, non-breaking space as whitespace
            if (this.cur === " " ||
                this.cur === "\t" ||
                this.cur.charCodeAt(0) === 0xa0) {
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
            this.tok = Token_1.Token.NL;
            this.val = '\n';
            return this.tok;
        }
        // handle various starting chars
        if (StringUtils_1.isAlpha(this.cur)) {
            this.tok = this.id();
            return this.tok;
        }
        if (this.cur === '"') {
            this.tok = this.str();
            return this.tok;
        }
        if (StringUtils_1.isNumeric(this.cur)) {
            this.tok = this.num();
            return this.tok;
        }
        if (this.cur === '-' && StringUtils_1.isNumeric(this.peek)) {
            this.tok = this.num();
            return this.tok;
        }
        // operator
        this.tok = this.operator();
        return this.tok;
    }
    lockLoc() {
        this.col = this.curCol;
        this.line = this.curLine;
        this.charIndex = this.curCharIndex;
    }
    // Token Productions
    id() {
        let s = "";
        while (StringUtils_1.isAlphaNumeric(this.cur) || this.cur === "_") {
            s += this.cur;
            this.consume();
        }
        // normal id
        this.val = s;
        return Token_1.Token.ID;
    }
    str() {
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
                this.currentError = new Errors_1.CompilerError("Unexpected end of str", Errors_1.ErrorTypes.UNCLOSED_STRING, new FileLoc_1.FileLoc("", this.line, this.col, this.charIndex), new FileLoc_1.FileLoc("", this.curLine, this.curCol));
                this.val = s;
                return Token_1.Token.STR;
            }
            if (ch === "\\") {
                s += this.escape();
                continue;
            }
            this.consume();
            s += ch;
        }
        this.val = s;
        return Token_1.Token.STR;
    }
    escape() {
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
    num() {
        let s = "";
        while (this.isNum(this.cur)) {
            s += this.cur;
            this.consume();
        }
        this.val = s;
        return Token_1.Token.VAL;
    }
    isNum(c) {
        return StringUtils_1.isAlphaNumeric(c) || c === '-' || c == '.' || c == '$' || c == ':' || c == '/' || c == '%' || c.charCodeAt(0) > 128;
    }
    operator() {
        const c = this.cur;
        this.consume();
        switch (c) {
            case ",":
                return Token_1.Token.COMMA;
            case ":":
                return Token_1.Token.COLON;
            case "[":
                return Token_1.Token.LBRACKET;
            case "]":
                return Token_1.Token.RBRACKET;
            case "{":
                return Token_1.Token.LBRACE;
            case "}":
                return Token_1.Token.RBRACE;
            case "(":
                return Token_1.Token.LPAREN;
            case ")":
                return Token_1.Token.RPAREN;
            case "<":
                return Token_1.Token.LT;
            case ">":
                return Token_1.Token.GT;
            case ".":
                return Token_1.Token.DOT;
            case "?":
                return Token_1.Token.QUESTION;
            case "&":
                return Token_1.Token.AMP;
            case "|":
                return Token_1.Token.PIPE;
            case "\0":
                return Token_1.Token.EOF;
        }
        if (c === "\0")
            return Token_1.Token.EOF;
        if (c === '') {
            return Token_1.Token.UNKNOWN;
        }
        throw new Errors_1.CompilerError(`Unexpected symbol: ${StringUtils_1.toCode(c, "'")} (0x${StringUtils_1.toHex(c)})`, Errors_1.ErrorTypes.UNCLOSED_STRING, new FileLoc_1.FileLoc("", this.line, this.col, this.charIndex), new FileLoc_1.FileLoc("", this.curLine, this.curCol));
    }
    // Comments
    parseComment() {
        let comment = "";
        this.consume(); // first slash
        this.consume(); // next slash
        if (this.cur === " ")
            this.consume(); // first space
        // eslint-disable-next-line no-constant-condition
        while (true) {
            if (this.cur === "\n" || this.cur === "\0")
                break;
            comment += this.cur;
            this.consume();
        }
        this.val = comment;
        return Token_1.Token.COMMENT;
    }
    skipCommentSL() {
        this.consume(); // first slash
        this.consume(); // next slash
        // eslint-disable-next-line no-constant-condition
        while (true) {
            if (this.cur === "\n" || this.cur == "\0")
                break;
            this.consume();
        }
    }
    skipCommentML() {
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
    consume() {
        this.cur = this.peek;
        this.curLine = this.peekLine;
        this.curCol = this.peekCol;
        this.curCharIndex = this.currentIndexInInput;
        this.peek = this.input.charAt(this.currentIndexInInput);
        if (this.peek === "\n") {
            this.peekLine++;
            this.peekCol = 0;
        }
        else {
            this.peekCol++;
        }
        this.currentIndexInInput++;
    }
}
exports.Tokenizer = Tokenizer;
//# sourceMappingURL=Tokenizer.js.map