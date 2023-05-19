"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addSymbols = void 0;
const symbols_1 = require("../symbols");
exports.addSymbols = (connection, compiledDocs) => {
    function onDocumentSymbols(params) {
        const uri = params.textDocument.uri;
        if (!uri) {
            return [];
        }
        const compiler = compiledDocs[uri];
        if (!compiler) {
            return [];
        }
        const root = compiler.root;
        if (!root) {
            return [];
        }
        return symbols_1.generateSymbols(root);
    }
    connection.onDocumentSymbol(onDocumentSymbols);
    function onWorkspaceSymbols(params) {
        const searched = params.query;
        const toRet = [];
        for (const uri in compiledDocs) {
            const root = compiledDocs[uri].root;
            if (!root) {
                continue;
            }
            const symbols = symbols_1.generateSymbols(root).map((symbol) => ({
                ...symbol,
                location: {
                    uri,
                    range: symbol.range
                }
            }));
            toRet.push(...symbols);
        }
        return toRet;
    }
    connection.onWorkspaceSymbol(onWorkspaceSymbols);
};
//# sourceMappingURL=symbols.js.map