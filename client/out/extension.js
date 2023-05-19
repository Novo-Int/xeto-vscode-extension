"use strict";
/* --------------------------------------------------------------------------------------------
 * Copyright (c) Novi-Studio
 * ------------------------------------------------------------------------------------------ */
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const path = require("path");
const vscode_1 = require("vscode");
const node_1 = require("vscode-languageclient/node");
const xeto_contentprovider_1 = require("./xeto-contentprovider");
const xeto_semanticprovider_1 = require("./xeto-semanticprovider");
let client;
function activate(context) {
    // The server is implemented in node
    const serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));
    // The debug options for the server
    // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
    const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const serverOptions = {
        run: { module: serverModule, transport: node_1.TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: node_1.TransportKind.ipc,
            options: debugOptions
        }
    };
    // Options to control the language client
    const clientOptions = {
        // Register the server for plain text documents
        documentSelector: [{ scheme: 'file', language: 'xeto' }],
        synchronize: {
            // Notify the server about file changes to '.clientrc files contained in the workspace
            fileEvents: vscode_1.workspace.createFileSystemWatcher('**/.clientrc')
        }
    };
    // Create the language client and start the client.
    client = new node_1.LanguageClient('xetoServer', 'Xeto Server', serverOptions, clientOptions);
    // Start the client. This will also launch the server
    client.start();
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
    const selector = { language: 'xeto', scheme: 'file' };
    context.subscriptions.push(vscode_1.languages.registerDocumentSemanticTokensProvider(selector, new xeto_semanticprovider_1.default(client), legend));
}
exports.activate = activate;
function deactivate() {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map