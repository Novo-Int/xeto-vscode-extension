"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class PogSymbolProvider {
    constructor(client) {
        this._client = client;
    }
    async provideDocumentSymbols(document, token) {
        const res = await this._client.sendRequest("textDocument/documentSymbol", {
            textDocument: {
                uri: document.uri.toString(),
            },
        });
        return res;
    }
}
exports.default = PogSymbolProvider;
//# sourceMappingURL=pog-symbolprovider.js.map