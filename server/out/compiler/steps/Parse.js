"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Parse = void 0;
const osPath = require("path");
const fs = require("fs");
const CTypes_1 = require("../CTypes");
const Step_1 = require("./Step");
const Parser_1 = require("../Parser");
const FileLoc_1 = require("../FileLoc");
const Path_1 = require("../Path");
class Parse extends Step_1.Step {
    constructor() {
        super(...arguments);
        this.source = "";
    }
    run(isLibMetaFile = false) {
        this.parseString(this.source, isLibMetaFile);
    }
    parseLib(lib) {
        // lib.src.each |file| { parseFile(lib, file, lib.isLibMetaFile(file)) }
    }
    parseString(toParse = this.source, isLibMetaFile = false) {
        try {
            const pound = toParse.indexOf("#<");
            const loc = new FileLoc_1.FileLoc("memory");
            let path;
            let source = '';
            if (pound !== -1) {
                const name = toParse.substring(0, pound).trim();
                source = toParse.substring(pound).trim();
                path = new Path_1.Path(name);
                isLibMetaFile = true;
            }
            else {
                source = toParse;
                path = new Path_1.Path('unnamed');
                //  check if this is part of a library
                if (fs.existsSync(osPath.join(this.compiler?.sourceUri.replace('file:/', ''), '..', 'lib.pog'))) {
                    const split = this.compiler?.sourceUri.split('/');
                    path = new Path_1.Path(`${split[split.length - 2]}.${split[split.length - 1]}`);
                }
            }
            if (this.compiler?.sourceUri.endsWith('lib.pog')) {
                const split = this.compiler?.sourceUri.split('/');
                path = new Path_1.Path(split[split.length - 2]);
            }
            const lib = new CTypes_1.CLib(loc, path, source, this.initProto(loc, path));
            this.compiler.libs = [lib];
            const parser = new Parser_1.Parser(source, this, this.compiler?.sourceUri);
            parser.parse(lib, isLibMetaFile);
        }
        catch (e) {
            console.log(e);
            throw e;
        }
    }
    initProto(loc, path) {
        // build Lib object itself
        const proto = new CTypes_1.CProto(loc, path.name, undefined, new CTypes_1.CType(loc, "sys.Lib"));
        proto.isLib = true;
        return proto;
    }
}
exports.Parse = Parse;
//# sourceMappingURL=Parse.js.map