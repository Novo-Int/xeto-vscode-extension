"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Parser = void 0;
const Token_1 = require("./Token");
const Tokenizer_1 = require("./Tokenizer");
const FileLoc_1 = require("./FileLoc");
const StringUtils_1 = require("./StringUtils");
const Errors_1 = require("./Errors");
class ParsedProto {
    constructor(loc) {
        this.traits = {};
        this.loc = loc;
        this.doc = null;
        this.name = null;
    }
}
class Parser {
    constructor(input, logErrCB, loc = "input") {
        this.curLine = 0; // current token line number
        this.curCol = 0; // current token col number
        this.curCharIndex = 0; // current char index in the stream
        this.peekLine = 0; // next token line number
        this.peekCol = 0; // next token col number
        this.peekCharIndex = 0; // next char index in the stream
        this._tokenBag = [];
        this.prevLoc = new FileLoc_1.FileLoc(loc);
        this.fileLoc = new FileLoc_1.FileLoc(loc);
        this.logErrCB = logErrCB;
        this.tokenizer = new Tokenizer_1.Tokenizer(input);
        this.cur = this.peek = Token_1.Token.EOF;
        this.consume();
        this.consume();
    }
    get tokenBag() {
        return this._tokenBag;
    }
    parse(root) {
        try {
            const rootProto = new ParsedProto(this.curToLoc());
            rootProto.traits = root;
            this.parseProtos(rootProto, false);
            this.verify(Token_1.Token.EOF);
            return root;
        }
        catch (e) {
            this.err(e.message);
        }
    }
    //Protos
    parseProtos(parent, isMeta) {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const child = this.parseProto();
            if (child === null)
                break;
            this.parseEndOfProto();
            this.addToParent(parent, child, isMeta);
        }
    }
    parseEndOfProto() {
        if (this.cur === Token_1.Token.COMMA) {
            this.consume();
            this.skipNewlines();
            return;
        }
        if (this.cur === Token_1.Token.NL) {
            this.skipNewlines();
            return;
        }
        if (this.cur === Token_1.Token.RBRACE)
            return;
        if (this.cur === Token_1.Token.GT)
            return;
        if (this.cur === Token_1.Token.EOF)
            return;
        this.err(`Expecting end of proto: comma or newline, not ${this.cur.toString()}`);
        // consume the char
        this.consume();
    }
    parseProto() {
        // leading comment
        const doc = this.parseLeadingDoc();
        // end of file or closing symbols
        if (this.cur === Token_1.Token.EOF)
            return null;
        if (this.cur === Token_1.Token.RBRACE)
            return null;
        if (this.cur === Token_1.Token.GT)
            return null;
        // this token is start of our proto production
        const proto = new ParsedProto(this.curToLoc());
        proto.doc = doc;
        // <markerOnly> | <named> | <unnamed>
        if (this.cur === Token_1.Token.ID && this.peek === Token_1.Token.COLON) {
            proto.name = this.consumeName();
            this.consume(Token_1.Token.COLON);
            this.parseBody(proto);
        }
        else if (this.cur === Token_1.Token.ID && StringUtils_1.isLower(this.curVal.toString()) && this.peek !== Token_1.Token.DOT) {
            proto.name = this.consumeName();
            proto.traits = {
                "_is": "sys.Marker"
            };
        }
        else {
            this.parseBody(proto);
        }
        this.parseTrailingDoc(proto);
        return proto;
    }
    parseBody(proto) {
        const a = this.parseIs(proto);
        const meta = this.parseMeta(proto);
        const childrenOrVal = this.parseChildrenOrVal(proto);
        if (!a && !meta && !childrenOrVal) {
            this.err(`Expecting proto body:`, this.curToLoc());
        }
    }
    parseMeta(proto) {
        if (this.cur !== Token_1.Token.LT) {
            return false;
        }
        this.parseProtoChildren(proto, Token_1.Token.LT, Token_1.Token.GT, true);
        if (this.cur === Token_1.Token.QUESTION) {
            this.consume(Token_1.Token.QUESTION);
            if (proto.traits['_of']) {
                const oldTraits = {
                    _of: proto.traits['_of'],
                    _is: proto.traits['_is']
                };
                proto.traits['_is'] = 'sys.Maybe';
                proto.traits['_of'] = oldTraits;
            }
            else {
                proto.traits['_of'] = proto.traits['_is'];
                proto.traits['_is'] = 'sys.Maybe';
            }
        }
        return true;
    }
    parseChildrenOrVal(proto) {
        if (this.cur === Token_1.Token.LBRACE) {
            return this.parseProtoChildren(proto, Token_1.Token.LBRACE, Token_1.Token.RBRACE, false);
        }
        if (this.cur.isVal) {
            return this.parseVal(proto);
        }
        return false;
    }
    parseVal(proto) {
        proto.traits["_val"] = this.curVal;
        this.consume();
        return true;
    }
    parseIs(p) {
        if (this.cur === Token_1.Token.STR && this.peek === Token_1.Token.PIPE) {
            return this.parseIsOr(p, undefined, this.consumeVal());
        }
        if (this.cur !== Token_1.Token.ID)
            return false;
        const qnameLoc = this.curCharIndex - 1;
        const qname = this.consumeQName();
        if (this.cur === Token_1.Token.AMP)
            return this.parseIsAnd(p, qname);
        if (this.cur === Token_1.Token.PIPE)
            return this.parseIsOr(p, qname);
        if (this.cur === Token_1.Token.QUESTION)
            return this.parseIsMaybe(p, qname);
        p.traits["_is"] = qname;
        p.traits["_type"] = "sys.Ref";
        p.traits["_qnameLoc"] = qnameLoc;
        return true;
    }
    parseIsAnd(p, qname) {
        const of = {
            children: []
        };
        this.addToOf(of, qname, undefined, this.prevLoc);
        while (this.cur === Token_1.Token.AMP) {
            this.consume();
            this.skipNewlines();
            const qname = this.parseIsSimple("Expecting next proto name after '&' and symbol");
            this.addToOf(of, qname, undefined, this.prevLoc);
        }
        p.traits["_is"] = "sys.And";
        p.traits["_of"] = of;
        return true;
    }
    parseIsOr(p, qname = undefined, val = undefined) {
        const of = {
            children: []
        };
        this.addToOf(of, qname, val, this.prevLoc);
        while (this.cur === Token_1.Token.PIPE) {
            this.consume();
            this.skipNewlines();
            if (this.cur.isVal) {
                this.addToOf(of, undefined, this.consumeVal(), this.prevLoc);
            }
            else {
                const qname = this.parseIsSimple("Expecting next proto name after '|' or symbol");
                this.addToOf(of, qname, undefined, this.prevLoc);
            }
        }
        p.traits["_is"] = "sys.Or";
        p.traits["_of"] = of;
        return true;
    }
    parseIsMaybe(p, qname) {
        this.consume(Token_1.Token.QUESTION);
        p.traits["_is"] = "sys.Maybe";
        p.traits["_of"] = { "_is": qname };
        return true;
    }
    parseIsSimple(errMsg) {
        if (this.cur !== Token_1.Token.ID) {
            this.err(errMsg, this.curToLoc());
        }
        return this.consumeQName();
    }
    addToOf(of, qname = undefined, val = undefined, loc = undefined) {
        const child = {};
        of.children.push(child);
        if (qname) {
            child["_is"] = qname;
        }
        if (val) {
            child["_val"] = val;
        }
        if (loc) {
            child["_loc"] = {
                "_is": "sys.Str",
                "_val": loc
            };
        }
    }
    parseProtoChildren(proto, open, close, isMeta) {
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
    addToParent(parent, child, isMeta) {
        this.addDoc(child);
        this.addLoc(child);
        let name = child.name;
        if (name === null) {
            name = this.autoName(parent);
        }
        else {
            if (isMeta) {
                if (name === "is")
                    this.err("Proto name 'is' is reserved", child.loc);
                if (name === "val")
                    this.err("Proto name 'val' is reserved", child.loc);
                name = "_" + name;
                //  this may seem like a hack, because it is,
                //  but there is no change of collision with user provided names
                child.traits['#isMeta'] = {};
            }
            //  we may have an optional with meta
            if (parent.traits[name] && name !== "_of") {
                this.generateDuplicateDefErr(parent, child);
            }
        }
        if (name === "_of" && parent.traits[name]) {
            parent.traits[name]["_of"] = child.traits;
        }
        else {
            parent.traits[name] = child.traits;
        }
    }
    generateDuplicateDefErr(parent, child) {
        if (!child.name) {
            return;
        }
        const length = child.name.length;
        const existingLoc = parent.traits[child.name]._loc._val;
        const newLoc = child.loc;
        const firstError = new Errors_1.CompilerError(`Duplicate slot name ${child.name} at ${FileLoc_1.FileLoc.newWithOffset(newLoc, 1).toString()}`, Errors_1.ErrorTypes.DUPLICATED_SYMBOL, existingLoc, { ...existingLoc, col: existingLoc.col + length });
        const secondError = new Errors_1.CompilerError(`Duplicate slot name ${child.name} at ${FileLoc_1.FileLoc.newWithOffset(existingLoc, 1).toString()}`, Errors_1.ErrorTypes.DUPLICATED_SYMBOL, newLoc, { ...newLoc, col: newLoc.col + length });
        this.logErrCB(firstError);
        this.logErrCB(secondError);
    }
    addDoc(p) {
        if (p.doc == null)
            return;
        p.traits["_doc"] = {
            "_is": "sys.Str",
            "_val": p.doc
        };
    }
    addLoc(p) {
        if (this.fileLoc === FileLoc_1.FileLoc.unknown)
            return;
        p.traits["_loc"] = {
            "_is": "sys.Str",
            "_val": p.loc
        };
    }
    autoName(parent) {
        for (let i = 0; i < 1000000; ++i) {
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
    parseLeadingDoc() {
        let doc = null;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            // skip leading blank lines
            this.skipNewlines();
            // if not a comment, then return null
            if (this.cur !== Token_1.Token.COMMENT)
                return null;
            // parse one or more lines of comments
            doc = "";
            while (this.cur === Token_1.Token.COMMENT) {
                doc += `${this.curVal.toString()}\n`;
                this.consume();
                this.consume(Token_1.Token.NL);
            }
            // if there is a blank line after comments, then
            // this comment does not apply to next production
            if (this.cur === Token_1.Token.NL)
                continue;
            // use this comment as our doc
            doc = StringUtils_1.trimToNull(doc);
            break;
        }
        return doc;
    }
    parseTrailingDoc(proto) {
        if (this.cur === Token_1.Token.COMMENT) {
            const doc = StringUtils_1.trimToNull(this.curVal.toString());
            if (doc != null && proto.doc == null)
                proto.doc = doc;
            this.consume();
        }
    }
    //////////////////////////////////////////////////////////////////////////
    // Char Reads
    //////////////////////////////////////////////////////////////////////////
    skipNewlines() {
        if (this.cur !== Token_1.Token.NL)
            return false;
        while (this.cur === Token_1.Token.NL)
            this.consume();
        return true;
    }
    verify(expected) {
        if (this.cur !== expected)
            throw new Error(`Expected ${expected} not ${this.cur.toString()}`);
    }
    curToLoc() {
        return new FileLoc_1.FileLoc(this.fileLoc.file, this.curLine, this.curCol, this.tokenizer.charIndex);
    }
    consumeQName() {
        let qname = this.consumeName();
        while (this.cur === Token_1.Token.DOT) {
            this.consume();
            qname += "." + this.consumeName();
        }
        return qname;
    }
    consumeName() {
        this.verify(Token_1.Token.ID);
        const name = this.curVal.toString();
        this.consume();
        return name;
    }
    consumeVal() {
        this.verify(Token_1.Token.STR);
        const val = this.curVal;
        this.consume();
        return val;
    }
    consume(expected = undefined) {
        if (expected !== undefined)
            this.verify(expected);
        this.prevLoc = new FileLoc_1.FileLoc(this.fileLoc.file, this.curLine, this.curCol, this.curCharIndex);
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
            if (this.tokenizer.currentError) {
                this.logErrCB(this.tokenizer.currentError);
            }
        }
        catch (e) {
            // we have a CompilerError
            if (e.type) {
                this.err(e, e.loc);
            }
        }
    }
    err(msg, loc = this.curToLoc()) {
        this.logErrCB(`${msg}`, Errors_1.ErrorTypes.MISSING_TOKEN, loc);
    }
}
exports.Parser = Parser;
//# sourceMappingURL=Parser.js.map