"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Proto = void 0;
class Proto {
    constructor(name, doc) {
        this.children = {};
        this.name = name;
        this.doc = doc;
    }
    static fromAST(name, ast) {
        const proto = new Proto(name, ast._doc._val);
        Object
            .keys(ast)
            .filter(key => !key.startsWith("_"))
            .map(key => {
            proto.children[key] = Proto.fromAST(key, proto.children[key]);
        });
        return proto;
    }
}
exports.Proto = Proto;
//# sourceMappingURL=CProtoFactory.js.map