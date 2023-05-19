"use strict";
/*---------------------------------------------------------------------------------------------
  * Copyright (c) Novi-Studio
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = void 0;
const vscode_1 = require("vscode");
const browser_1 = require("vscode-languageclient/browser");
const xeto_contentprovider_1 = require("./xeto-contentprovider");
const xeto_semanticprovider_1 = require("./xeto-semanticprovider");
// this method is called when vs code is activated
function activate(context) {
    /*
     * all except the code to create the language client in not browser specific
     * and could be shared with a regular (Node) extension
     */
    const documentSelector = [{ language: 'xeto' }];
    // Options to control the language client
    const clientOptions = {
        documentSelector,
        synchronize: {},
        initializationOptions: {}
    };
    const client = createWorkerLanguageClient(context, clientOptions);
    const disposable = client.start();
    context.subscriptions.push(disposable);
    vscode_1.workspace.registerTextDocumentContentProvider('xeto', new xeto_contentprovider_1.default());
    const legend = (function () {
        const tokenTypesLegend = [
            'label'
        ];
        const tokenModifiersLegend = [
            'defaultLibrary'
        ];
        return new vscode_1.SemanticTokensLegend(tokenTypesLegend, tokenModifiersLegend);
    })();
    const selector = { language: 'xeto' };
    context.subscriptions.push(vscode_1.languages.registerDocumentSemanticTokensProvider(selector, new xeto_semanticprovider_1.default(client), legend));
    client.onReady().then(() => {
        console.log("XETO started");
        initFS(client);
    });
}
exports.activate = activate;
function initFS(client) {
    client.onRequest('xfs/exists', async (e) => {
        try {
            await vscode_1.workspace.fs.stat(vscode_1.Uri.parse(e.path));
            return true;
        }
        catch {
            return false;
        }
    });
    client.onRequest('xfs/readDir', async (e) => {
        try {
            const results = await vscode_1.workspace.fs.readDirectory(vscode_1.Uri.parse(e.path));
            return results;
        }
        catch {
            return false;
        }
    });
    client.onRequest('xfs/readFile', async (e) => {
        try {
            const result = await vscode_1.workspace.fs.readFile(vscode_1.Uri.parse(e.path));
            return fileArrayToString(result);
        }
        catch {
            return false;
        }
    });
}
function fileArrayToString(bufferArray) {
    return Array.from(bufferArray)
        .map((item) => String.fromCharCode(item))
        .join("");
}
function createWorkerLanguageClient(context, clientOptions) {
    // Create a worker. The worker main file implements the language server.
    const serverMain = vscode_1.Uri.joinPath(context.extensionUri, 'server/dist/browserServerMain.js');
    const worker = new Worker(serverMain.toString(true));
    // create the language server client to communicate with the server running in the worker
    return new browser_1.LanguageClient('xeto-extension', 'Xeto Web Extension', clientOptions, worker);
}
//# sourceMappingURL=browserExtension.js.map