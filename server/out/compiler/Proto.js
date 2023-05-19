"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Proto = void 0;
const FindProto_1 = require("../FindProto");
const metaPropsNotToParse = {
    '_is': true,
    '_loc': true,
    '_doc': true,
    '_val': true,
    '_qnameLoc': true,
};
class Proto {
    constructor(name, type, loc, doc) {
        this.qnameLoc = 0;
        this.initialType = "";
        this.children = {};
        this.name = name;
        this._doc = doc;
        this.type = type;
        this.loc = loc;
    }
    get doc() {
        return this._doc;
    }
    set doc(doc) {
        this._doc = doc;
    }
    //	alias link to another Proto
    get refType() {
        return this._refType;
    }
    get hasRefType() {
        return this.type !== undefined && this.type !== 'sys.And' && this.type !== 'sys.Or' && this.type !== 'sys.Maybe';
    }
    resolveRefTypes(root, libManager, missingRefs) {
        if (this.hasRefType) {
            let currentAlias = FindProto_1.findProtoByQname(this.type, root);
            //	maybe it's from a lib
            if (!currentAlias) {
                currentAlias = libManager.findProtoByQName(this.type);
            }
            this._refType = currentAlias || undefined;
            if (this._refType?.name === undefined && this.initialType === "sys.Ref") {
                missingRefs.push(this);
            }
        }
        // go deep
        Object
            .values(this.children)
            .forEach(proto => proto.resolveRefTypes(root, libManager, missingRefs));
    }
    static fromPartialAST(name, ast) {
        //	we add _ for meta names so we'll remove it here
        const originalName = name.startsWith('_') ? name.substring(1) : name;
        const proto = new Proto(originalName, ast._is || ast._val, ast._loc?._val, ast._doc?._val);
        proto.initialType = ast._type;
        //	it we have the start of the qname
        if (ast._qnameLoc) {
            proto.qnameLoc = ast._qnameLoc;
        }
        Object.keys(ast)
            .filter(key => !metaPropsNotToParse[key] && typeof ast[key] !== 'string')
            .forEach(key => {
            const childProto = Proto.fromPartialAST(key, ast[key]);
            proto.children[key] = childProto;
        });
        return proto;
    }
    static fromAST(ast) {
        const root = new Proto('root', 'sys.Root', ast._loc);
        Object.keys(ast)
            .filter(key => !metaPropsNotToParse[key])
            .forEach(key => {
            const childProto = Proto.fromPartialAST(key, ast[key]);
            root.children[key] = childProto;
        });
        return root;
    }
}
exports.Proto = Proto;
//# sourceMappingURL=Proto.js.map