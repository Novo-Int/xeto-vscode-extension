"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CType = exports.CPragma = exports.CProto = exports.CLib = void 0;
const Path_1 = require("./Path");
const Errors_1 = require("./Errors");
class CLib {
    //Bool isLibMetaFile(File f) { f === src.first }
    constructor(loc, path, source, proto) {
        this.resolvedNames = false; // ResolveNames
        this.loc = loc;
        this.path = path;
        this.qname = path.toString();
        this.source = source;
        //this.dir   = dir
        //this.src   = src
        this.isSys = this.qname == "sys";
        this.proto = proto;
    }
}
exports.CLib = CLib;
class CProto {
    constructor(loc, name, doc, type, val) {
        this.isLib = false; // Parse.parseLib
        this.nameCounter = 0;
        this.loc = loc;
        this.name = name;
        this.doc = doc;
        this.type = type;
        this.val = val;
        this.children = {};
    }
    get(name, checked = true) {
        const kid = this.children[name];
        if (kid) {
            return kid;
        }
        const typeKid = this.type?.get(name);
        if (typeKid) {
            return kid;
        }
        if (checked)
            throw new Errors_1.UnknownProtoError(`${this.qname}${name}`);
        return undefined;
    }
    getOwn(name, checked = true) {
        const kid = this.children[name];
        if (kid)
            return kid;
        if (checked)
            throw new Errors_1.UnknownProtoError(`${this.qname}.${name}`);
        return null;
    }
    get isRoot() {
        return this.parent === undefined;
    }
    get qname() {
        return this.path.toString();
    }
    get path() {
        return this.isRoot ? Path_1.Path.root : this.parent.path.add(this.name);
    }
    isMeta() { return this.name[0] === '_'; }
    isObj() {
        return this.qname === "sys.Obj";
    }
    isEnum() { return this.qname === "sys.Enum"; }
    isMarker() { return this.qname === "sys.Marker"; }
    isMaybe() { return this.qname === "sys.Maybe"; }
    isAnd() { return this.qname === "sys.And"; }
    isOr() { return this.qname === "sys.Or"; }
    toString() {
        return this.isRoot ? "_root_" : this.path.toString();
    }
    get assignName() {
        return "_" + this.nameCounter++;
    }
}
exports.CProto = CProto;
CProto.noChildren = {};
class CPragma {
    constructor(loc, lib) {
        this.loc = loc;
        this.lib = lib;
    }
}
exports.CPragma = CPragma;
class CType {
    constructor(loc, name, resolved = null) {
        this.resolved = null; // Resolve step
        this.loc = loc;
        this.name = name;
        this.resolved = resolved;
    }
    static makeMaybe(of) {
        const ret = new CType(of.loc, "sys.Maybe");
        ret.of = [of];
        return ret;
    }
    static makeOr(of) {
        const ret = new CType(of[0].loc, "sys.Or");
        ret.of = of;
        return ret;
    }
    static makeAnd(of) {
        const ret = new CType(of[0].loc, "sys.And");
        ret.of = of;
        return ret;
    }
    static makeUnresolved(loc, name) {
        return new CType(loc, name);
    }
    static makeResolved(loc, c) {
        return new CType(loc, c.name, c);
    }
    isResolved() {
        return this.resolved !== null;
    }
    deref() {
        if (this.resolved) {
            return this.resolved;
        }
        throw new Error(`Not resolved yet: ${this.name}`);
    }
    get(name) {
        if (this.of === undefined) {
            return this.deref().get(name, false);
        }
        for (let i = 0; i < this.of.length; i++) {
            const found = this.of[i].get(name);
            if (found) {
                return found;
            }
        }
    }
    toString() {
        return this.name;
    }
}
exports.CType = CType;
//# sourceMappingURL=CTypes.js.map