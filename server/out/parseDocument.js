"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compilersToLibs = exports.parseDocument = exports.populateLibraryManager = void 0;
const vscode_languageserver_1 = require("vscode-languageserver");
const events_1 = require("./events");
const utils_1 = require("./utils");
const Compiler_1 = require("./compiler/Compiler");
const libraries_1 = require("./libraries");
let ARE_LIBS_LOADED = false;
let noLoaded = 0;
const libsLoadedCallback = () => {
    noLoaded++;
    if (noLoaded === 3) {
        ARE_LIBS_LOADED = true;
    }
};
events_1.eventBus.addListener(1 /* EXTERNAL_LIBS_LOADED */, libsLoadedCallback);
events_1.eventBus.addListener(0 /* SYS_LIBS_LOADED */, libsLoadedCallback);
events_1.eventBus.addListener(2 /* WORKSPACE_SCANNED */, libsLoadedCallback);
function fileLocToDiagPosition(loc) {
    return {
        line: loc.line,
        character: loc.col > 0 ? loc.col - 1 : loc.col,
    };
}
exports.populateLibraryManager = async (compiler, connection, libManager) => {
    if (!compiler.root) {
        return;
    }
    const split = compiler.sourceUri.split("/");
    const hasLib = await utils_1.isPartOfLib(compiler.sourceUri, connection);
    let libName = undefined;
    let libVersion = "";
    let libDoc = "";
    const deps = [];
    if (hasLib) {
        libName = split[split.length - 2];
    }
    const isLibMeta = compiler.sourceUri.endsWith("lib.xeto");
    if (isLibMeta) {
        const pragma = compiler.root?.children["pragma"];
        libName = split[split.length - 2];
        libVersion = pragma?.children._version.type;
        libDoc = pragma?.doc || "";
        const protoDeps = pragma?.children._depends?.children;
        protoDeps &&
            Object.keys(protoDeps).forEach((key) => {
                if (key.startsWith("#")) {
                    return;
                }
                deps.push(protoDeps[key].children.lib.type);
            });
    }
    if (!libName) {
        return;
    }
    if (!libManager.getLib(libName)) {
        libManager.addLib(new libraries_1.XetoLib(libName, libVersion, compiler.sourceUri, libDoc));
    }
    const xetoLib = libManager.getLib(libName);
    if (!xetoLib) {
        return;
    }
    exports.compilersToLibs.set(compiler, xetoLib);
    if (libVersion) {
        xetoLib.addMeta(libVersion, libDoc, deps);
    }
    if (!isLibMeta) {
        Object.entries(compiler.root.children).forEach(([name, proto]) => {
            xetoLib.addChild(name, proto);
        });
    }
};
exports.parseDocument = async (textDocument, connection, libManager, compiledDocs) => {
    const diagnostics = [];
    const compiler = new Compiler_1.ProtoCompiler(textDocument.uri);
    const text = textDocument.getText();
    // if no compiler is saved then save one
    if (!compiledDocs[textDocument.uri]) {
        compiledDocs[textDocument.uri] = compiler;
    }
    else {
        // if a compiler is already present
        // only add a compiler if no errors are availabe
        // TO DO - remove this logic and always add the current compiler when we have a resilient compiler
        if (compiler.errs.length === 0) {
            compiledDocs[textDocument.uri] = compiler;
        }
    }
    try {
        compiler.run(text + "\0");
        compiler.errs.forEach((err) => {
            const diagnostic = {
                severity: vscode_languageserver_1.DiagnosticSeverity.Error,
                range: {
                    start: fileLocToDiagPosition(err.loc),
                    end: fileLocToDiagPosition(err.endLoc),
                },
                message: err.message,
            };
            diagnostics.push(diagnostic);
        });
    }
    catch (e) {
        if (utils_1.isCompilerError(e)) {
            const diagnostic = {
                severity: vscode_languageserver_1.DiagnosticSeverity.Error,
                range: {
                    start: textDocument.positionAt(e.loc.charIndex),
                    end: textDocument.positionAt(text.length),
                },
                message: e.message,
            };
            diagnostics.push(diagnostic);
        }
    }
    finally {
        if (ARE_LIBS_LOADED) {
            // resolve refs
            const missingRefs = [];
            compiler.root?.resolveRefTypes(compiler.root, libManager, missingRefs);
            const missingRefsDiagnostics = missingRefs.map(proto => ({
                severity: vscode_languageserver_1.DiagnosticSeverity.Error,
                range: {
                    start: textDocument.positionAt(proto.qnameLoc || proto.loc.charIndex),
                    end: textDocument.positionAt((proto.qnameLoc || proto.loc.charIndex) + proto.type.length)
                },
                message: 'No available definition for this proto'
            }));
            diagnostics.push(...missingRefsDiagnostics);
        }
        connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
        // time to add it to the library manager
        exports.populateLibraryManager(compiler, connection, libManager);
    }
    return;
};
exports.compilersToLibs = new Map();
//# sourceMappingURL=parseDocument.js.map