"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LibraryManager = void 0;
const FindProto_1 = require("../FindProto");
const NAME_SEPARATOR = "#";
class LibraryManager {
    constructor() {
        this.libs = {};
    }
    getLibHash(lib) {
        return `${lib.name}${NAME_SEPARATOR}${lib.includePriority}`;
    }
    addLib(lib) {
        if (this.libs[lib.name] === undefined) {
            this.libs[lib.name] = {};
        }
        const key = this.getLibHash(lib);
        this.libs[lib.name][key] = lib;
    }
    getLib(name) {
        const libs = this.libs[name];
        if (!libs) {
            return undefined;
        }
        const registeredLibs = Object.keys(libs);
        //	get the one with the highest number
        const highestKey = Math.max(...registeredLibs.map(key => parseInt(key.split(NAME_SEPARATOR)[1])));
        return libs[`${name}${NAME_SEPARATOR}${highestKey}`];
    }
    findProtoByQName(qname, desiredLibs = []) {
        //	if we have desiredLibs let's look there first
        if (desiredLibs) {
            for (let i = 0; i < desiredLibs.length; i++) {
                const libName = desiredLibs[i];
                const lib = this.getLib(libName);
                if (!lib) {
                    continue;
                }
                const found = FindProto_1.findProtoByQname(qname, lib.rootProto);
                if (found) {
                    return found;
                }
            }
        }
        const split = qname.split('.');
        let currentSize = 1;
        //	libs can contain dot(.)
        do {
            const libName = split.slice(0, currentSize).join(".");
            const lib = this.getLib(libName);
            if (!lib) {
                currentSize++;
                continue;
            }
            const proto = FindProto_1.findProtoByQname(split.slice(currentSize).join('.'), lib.rootProto);
            if (proto) {
                return proto;
            }
            currentSize++;
        } while (currentSize <= split.length);
        //	mayber this is a sys proto
        const sysLib = this.getLib('sys');
        if (!sysLib) {
            return null;
        }
        return FindProto_1.findProtoByQname(qname, sysLib.rootProto);
    }
}
exports.LibraryManager = LibraryManager;
//# sourceMappingURL=LibManager.js.map