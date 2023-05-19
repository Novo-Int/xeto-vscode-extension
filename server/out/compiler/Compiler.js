"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProtoCompiler = void 0;
const Errors_1 = require("./Errors");
const Parser_1 = require("./Parser");
const Proto_1 = require("./Proto");
class ProtoCompiler {
    constructor(sourceUri) {
        this.errs = [];
        this.tokenBag = [];
        this.ast = {};
        this.sourceUri = sourceUri;
    }
    isCompilerError(err) {
        return err.type;
    }
    logErr(msg, type, where) {
        if (this.isCompilerError(msg)) {
            this.errs.push(msg);
        }
        else {
            this.errs.push(new Errors_1.CompilerError(msg, type, where));
        }
    }
    run(input) {
        if (!input.endsWith("\0")) {
            input += "\0";
        }
        const parseStep = new Parser_1.Parser(input, this.logErr.bind(this), this.sourceUri);
        parseStep.parse(this.ast);
        this.root = Proto_1.Proto.fromAST(this.ast);
        this.tokenBag = [...parseStep.tokenBag];
    }
    getQNameByLocation(location, root = this.root) {
        if (!root) {
            return "";
        }
        const childrenNames = Object.keys(root.children);
        for (let i = 0; i < childrenNames.length; i++) {
            const proto = root.children[childrenNames[i]];
            if (proto?.loc?.line === location.line &&
                proto?.loc?.col === location.character) {
                return proto.name;
            }
            const depthName = this.getQNameByLocation(location, proto);
            if (depthName) {
                return proto.name + "." + depthName;
            }
        }
        return "";
    }
}
exports.ProtoCompiler = ProtoCompiler;
//# sourceMappingURL=Compiler.js.map