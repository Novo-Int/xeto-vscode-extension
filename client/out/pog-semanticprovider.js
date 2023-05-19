"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class PogSemanticTokenProvider {
    constructor(client) {
        this._client = client;
    }
    async provideDocumentSemanticTokens(document, token) {
        const results = await this._client.sendRequest('textDocument/semanticTokens/full', {
            textDocument: {
                uri: document.uri.toString()
            }
        });
        return results;
    }
}
exports.default = PogSemanticTokenProvider;
//# sourceMappingURL=pog-semanticprovider.js.map