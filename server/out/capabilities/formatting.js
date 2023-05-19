"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addFormatting = void 0;
const formatting_1 = require("../formatting");
exports.addFormatting = (connection, documents, docsToCompilerResults) => {
    function onDocumentFormatting(params) {
        const uri = params.textDocument.uri;
        const compiler = docsToCompilerResults[uri];
        if (!compiler) {
            return [];
        }
        const tokenBag = compiler.tokenBag;
        if (!tokenBag || !tokenBag.length) {
            return [];
        }
        const doc = documents.get(uri);
        if (!doc) {
            return [];
        }
        return formatting_1.formatFile(doc, tokenBag, params.options);
    }
    connection.onDocumentFormatting(onDocumentFormatting);
};
//# sourceMappingURL=formatting.js.map