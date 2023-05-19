"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addAutoCompletion = void 0;
const vscode_languageserver_1 = require("vscode-languageserver");
const utils_1 = require("./utils");
const FindProto_1 = require("../FindProto");
exports.addAutoCompletion = (connection, libManager, compiledDocs, docs) => {
    function handleAutoCompletion(params) {
        // let try to find the identifier for this position
        const compiledDocument = compiledDocs[params.textDocument.uri];
        const doc = docs.get(params.textDocument.uri);
        if (!compiledDocument || !doc) {
            return [];
        }
        const partialIdentifier = utils_1.getIdentifierForPosition(doc, params.position);
        if (!partialIdentifier) {
            return [];
        }
        let options = (compiledDocument.root &&
            FindProto_1.findChildrenOf(partialIdentifier, compiledDocument.root)) ||
            [];
        //	maybe the identifier is from a lib
        if (options.length === 0) {
            let lib = null;
            let currentSize = 1;
            const parts = partialIdentifier.split(".");
            //  libraries can contain dots in their names
            do {
                const libName = parts.slice(0, currentSize);
                lib = libManager.getLib(libName.join("."));
                if (lib) {
                    //	get compilers for files that have this lib
                    const identifierWithoutLib = parts.slice(currentSize).join(".");
                    options = FindProto_1.findChildrenOf(identifierWithoutLib, lib.rootProto);
                    if (options.length) {
                        break;
                    }
                }
                currentSize++;
            } while (currentSize <= parts.length);
        }
        return options.map((op) => ({
            label: op.label,
            kind: vscode_languageserver_1.CompletionItemKind.Field,
            detail: op.parent,
            documentation: op.doc,
        }));
    }
    connection.onCompletion(handleAutoCompletion);
    // This handler resolves additional information for the item selected in
    // the completion list.
    connection.onCompletionResolve((item) => {
        return item;
    });
};
//# sourceMappingURL=autocompletion.js.map