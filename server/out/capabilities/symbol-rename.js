"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addRenameSymbol = void 0;
const refactor_1 = require("../refactor");
const FindProto_1 = require("../FindProto");
const utils_1 = require("./utils");
exports.addRenameSymbol = (connection, compiledDocs, docs, compilersToLibs) => {
    function onSymbolRename(params) {
        const uri = params.textDocument.uri;
        const compiler = compiledDocs[uri];
        const doc = docs.get(params.textDocument.uri);
        if (!compiler || !doc) {
            return null;
        }
        //  we need this because the selection for renaming may be in the middle of the identifier
        const startCharacter = params.position.character - utils_1.getIdentifierLength(doc, params.position) + 1;
        const protoName = compiler.getQNameByLocation({
            line: params.position.line,
            character: startCharacter,
        });
        //  trying to rename a symbol that's not defined in this compilation unit
        if (protoName === "") {
            return null;
        }
        const proto = (compiler.root && FindProto_1.findProtoByQname(protoName, compiler.root)) || null;
        if (!proto) {
            return null;
        }
        //  bail out if replacing with the same string
        if (proto.name === params.newName) {
            return null;
        }
        const workspaceEdit = {
            changes: {},
        };
        workspaceEdit.changes[uri] = [
            {
                range: {
                    start: {
                        character: startCharacter - 1,
                        line: params.position.line,
                    },
                    end: {
                        character: startCharacter - 1 + proto.name.length,
                        line: params.position.line,
                    },
                },
                newText: params.newName,
            },
            ...refactor_1.renameInDoc(params, protoName, doc, compiler),
        ];
        //  refactor in entire workspace
        Object.keys(compiledDocs).forEach((docUri) => {
            //	skip current doc
            if (docUri === uri) {
                return;
            }
            //  we also want to skip if files are in different libs
            if (compilersToLibs.get(compiledDocs[docUri]) !==
                compilersToLibs.get(compiler)) {
                return;
            }
            const doc = docs.get(docUri);
            if (!doc) {
                return;
            }
            const edits = refactor_1.renameInDoc(params, protoName, doc, compiledDocs[docUri]);
            if (edits.length) {
                workspaceEdit.changes[docUri] = edits;
            }
        });
        //  if proto is part of a lib then we need to add the lib name to it also
        const lib = compilersToLibs.get(compiler);
        if (lib) {
            //  refactor in entire workspace
            Object.keys(compiledDocs).forEach((docUri) => {
                //	skip current doc
                if (docUri === uri) {
                    return;
                }
                const doc = docs.get(docUri);
                if (!doc) {
                    return;
                }
                const edits = refactor_1.renameInDoc(params, lib.name + "." + protoName, doc, compiledDocs[docUri]);
                if (edits.length) {
                    workspaceEdit.changes[docUri] = edits;
                }
            });
        }
        return workspaceEdit;
    }
    connection.onRenameRequest(onSymbolRename);
};
//# sourceMappingURL=symbol-rename.js.map