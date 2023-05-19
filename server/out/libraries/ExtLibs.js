"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadExtLibs = void 0;
const XetoLib_1 = require("./XetoLib");
const Compiler_1 = require("../compiler/Compiler");
const utils_1 = require("./utils");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const events_1 = require("../events");
const loadExtLib = (root, lm, priority) => {
    try {
        const files = fs.readdirSync(root, { withFileTypes: true });
        const libName = path.basename(root);
        //	parse the lib file first
        const libXetoContents = fs.readFileSync(`${root}/lib.xeto`).toString("utf-8");
        const libInfoCompiler = new Compiler_1.ProtoCompiler(root);
        libInfoCompiler.run(libXetoContents);
        const libVersion = libInfoCompiler.root?.children["pragma"]?.children._version.type ||
            "unknown";
        const libDoc = libInfoCompiler.root?.children["pragma"]?.doc || "";
        const lib = new XetoLib_1.XetoLib(libName, libVersion, root, libDoc);
        lib.includePriority = priority;
        //	parse all files
        files
            .filter((file) => file.isFile() && file.name.endsWith("xeto") && file.name !== "lib.xeto")
            .forEach((file) => {
            const filePath = path.join(root, file.name);
            const fileContent = fs.readFileSync(filePath).toString("utf-8");
            const compiler = new Compiler_1.ProtoCompiler(filePath);
            compiler.run(fileContent);
            if (!compiler.root) {
                return;
            }
            Object.entries(compiler.root.children).forEach(([name, proto]) => {
                lib.addChild(name, proto);
            });
        });
        lm.addLib(lib);
    }
    catch (e) {
        console.log(e);
    }
};
const loadExtLibFromWeb = async (def, lm, priority) => {
    const libInfoUri = def.lib;
    const libXeto = await utils_1.readUrl(libInfoUri);
    const libInfoCompiler = new Compiler_1.ProtoCompiler(libInfoUri.replace("https://", "xeto://"));
    try {
        libInfoCompiler.run(libXeto);
    }
    catch (e) {
        console.log(e);
    }
    const libVersion = libInfoCompiler.root?.children["pragma"]?.children._version.type ||
        "unknown";
    const libDoc = libInfoCompiler.root?.children["pragma"]?.doc || "";
    const lib = new XetoLib_1.XetoLib(def.name, libVersion, libInfoUri.replace("https://", "xeto://"), libDoc);
    lib.includePriority = -1;
    // now that we have the lib read all the files
    const filesPr = def.files.map(async (uri) => {
        const compiler = new Compiler_1.ProtoCompiler(uri.replace("https://", "xeto://"));
        const content = await utils_1.readUrl(uri);
        compiler.run(content + "\0");
        if (!compiler.root) {
            return;
        }
        Object.entries(compiler.root.children).forEach(([name, proto]) => {
            lib.addChild(name, proto);
        });
    });
    await Promise.all(filesPr);
    lm.addLib(lib);
};
const isFolderLib = (path) => fs.existsSync(`${path}/lib.xeto`);
exports.loadExtLibs = (sources, lm) => {
    sources.forEach((root, index) => {
        try {
            if (typeof root === "string") {
                //	check if we have a single lib or this is a repo of multiple libs
                if (isFolderLib(root)) {
                    loadExtLib(root, lm, sources.length - index);
                }
                else {
                    //	it doesn't have a lib.xeto, so check all the folders and check if those are libs
                    const entries = fs.readdirSync(root, { withFileTypes: true });
                    entries
                        .filter((entry) => entry.isDirectory() && isFolderLib(`${root}/${entry.name}`))
                        .map((dir) => loadExtLib(`${root}/${dir.name}`, lm, sources.length - index));
                }
            }
            else {
                loadExtLibFromWeb(root, lm, sources.length - index);
            }
        }
        catch (e) {
            console.log(e);
        }
    });
    events_1.eventBus.fire(2 /* WORKSPACE_SCANNED */);
};
//# sourceMappingURL=ExtLibs.js.map