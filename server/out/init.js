"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onInitialized = exports.generateInitResults = void 0;
const vscode_languageserver_1 = require("vscode-languageserver");
const libraries_1 = require("./libraries");
let hasWorkspaceFolderCapability = false;
let hasConfigurationCapability = false;
exports.generateInitResults = (params) => {
    const capabilities = params.capabilities;
    // Does the client support the `workspace/configuration` request?
    // If not, we fall back using global settings.
    hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
    hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
    const result = {
        capabilities: {
            textDocumentSync: vscode_languageserver_1.TextDocumentSyncKind.Incremental,
            hoverProvider: true,
            definitionProvider: true,
            documentFormattingProvider: true,
            documentSymbolProvider: true,
            workspaceSymbolProvider: true,
            renameProvider: true,
            // Tell the client that this server supports code completion.
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: ["."],
            },
        },
    };
    if (hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true,
            },
        };
    }
    return result;
};
exports.onInitialized = async (connection, libManager, compiledDocs) => {
    if (hasConfigurationCapability) {
        // Register for all configuration changes.
        connection.client.register(vscode_languageserver_1.DidChangeConfigurationNotification.type, undefined);
        connection.client.register(vscode_languageserver_1.DidChangeWatchedFilesNotification.type, undefined);
    }
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders((_event) => {
            connection.console.log("Workspace folder change event received.");
        });
    }
    //  keep the document ref, but delete all the keys
    Object.keys(compiledDocs).forEach((key) => {
        delete compiledDocs[key];
    });
    const settings = await connection.workspace.getConfiguration("xeto");
    libraries_1.loadSysLibsFromGH(settings.libraries.sys, libManager);
    libraries_1.loadExtLibs(settings.libraries.external, libManager);
};
//# sourceMappingURL=init.js.map