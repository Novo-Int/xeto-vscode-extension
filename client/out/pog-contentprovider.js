"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const https = require("node:https");
const readUrl = (url) => {
    const pr = new Promise((res, rej) => {
        https.get(url, (resp) => {
            let data = '';
            resp.on('data', chunk => {
                data += chunk;
            });
            resp.on('end', () => {
                res(data);
            });
        });
    });
    return pr;
};
class PogProvider {
    constructor() {
        //	the docs are imutable, as they are taken from a GH commit
        //	as such we don't need to invalidate the cache
        //	we only need to populate it as needed
        //	this is done in provideTextDocumentContent
        this._documents = new Map();
    }
    async provideTextDocumentContent(uri) {
        //	we have it cached
        if (this._documents.get(uri.toString())) {
            return this._documents.get(uri.toString());
        }
        //	we need to retrieve it
        const finalUri = vscode.Uri.from({
            ...uri,
            scheme: 'https',
        });
        return readUrl(finalUri.toString())
            .then(content => {
            this._documents.set(uri.toString(), content);
            return content;
        });
    }
}
exports.default = PogProvider;
//# sourceMappingURL=pog-contentprovider.js.map