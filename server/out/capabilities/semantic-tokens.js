"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addSemanticTokens = void 0;
const semantic_tokens_1 = require("../semantic-tokens");
exports.addSemanticTokens = (connection, libManager, compiledDocs) => {
    function handleSemanticTokens(params) {
        const uri = params.textDocument.uri;
        const compiler = compiledDocs[uri];
        if (!compiler || !compiler.root) {
            return {
                data: [],
            };
        }
        const semanticProtos = semantic_tokens_1.extractSemanticProtos(compiler.root, libManager);
        const semanticTokens = semantic_tokens_1.convertProtosToSemanticTokens(semanticProtos);
        return {
            data: semanticTokens,
        };
    }
    connection.languages.semanticTokens.on(handleSemanticTokens);
};
//# sourceMappingURL=semantic-tokens.js.map