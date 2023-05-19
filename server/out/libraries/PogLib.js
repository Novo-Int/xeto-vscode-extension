"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PogLib = void 0;
const FileLoc_1 = require("../compiler/FileLoc");
const Proto_1 = require("../compiler/Proto");
class PogLib {
    constructor(name, version, fileUri, doc = "") {
        this._deps = [];
        //	higher priority overrides lower priority
        //	by default we give a high priority to all libs
        //	sys libs have -1
        //	other loaded libs via configs start from 0 and go to the number of entries in the lists
        this._includePriority = 100;
        this.children = {};
        this.name = name;
        this._version = version;
        //	we always want this to point to lib.pog
        if (fileUri.endsWith('lib.pog') === false) {
            fileUri = fileUri.replace(/\/[^/]+$/, '/lib.pog');
        }
        this.rootProto = new Proto_1.Proto(name, 'sys.Root', new FileLoc_1.FileLoc(fileUri), doc);
    }
    get version() {
        return this._version;
    }
    get deps() {
        return this._deps;
    }
    get includePriority() {
        return this._includePriority;
    }
    set includePriority(val) {
        this._includePriority = val;
    }
    addChild(name, proto) {
        this.children[name] = proto;
        this.rootProto.children[name] = proto;
    }
    addMeta(version, doc, deps = []) {
        this.rootProto.doc = doc;
        this._version = version;
        this._deps = [...deps];
    }
}
exports.PogLib = PogLib;
//# sourceMappingURL=PogLib.js.map