"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* --------------------------------------------------------------------------------------------
 * Copyright (c) Novi-Studio
 * ------------------------------------------------------------------------------------------ */
const browser_1 = require("vscode-languageserver/browser");
const utils_1 = require("./utils");
utils_1.VARS.env = "BROWSER";
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const libraries_1 = require("./libraries/");
const init_1 = require("./init");
const parseDocument_1 = require("./parseDocument");
const capabilities_1 = require("./capabilities");
const events_1 = require("./events");
const messageReader = new browser_1.BrowserMessageReader(self);
const messageWriter = new browser_1.BrowserMessageWriter(self);
// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = browser_1.createConnection(messageReader, messageWriter);
// Create a simple text document manager.
const documents = new browser_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
let rootFolders = [];
const docsToCompilerResults = {};
const libManager = new libraries_1.LibraryManager();
const getRootFolderFromParams = (params) => {
    let ret = "";
    if (params.workspaceFolders) {
        return params.workspaceFolders.map((folder) => folder.uri.replace("file://", ""));
    }
    else {
        ret = params.rootUri || "";
    }
    ret = ret.replace("file://", "");
    return [ret];
};
const addWorkspaceRootToWatch = async (path, storage = []) => {
    const files = await connection.sendRequest('xfs/readDir', { path });
    await Promise.all(files.map((entry) => {
        if (entry[1] === 2) {
            return addWorkspaceRootToWatch(`${path}/${entry[0]}`, storage);
        }
        else {
            storage.push(`${path}/${entry[0]}`);
        }
    }));
    return storage;
};
const parseAllRootFolders = () => {
    let noLoaded = 0;
    rootFolders
        .filter((folder) => Boolean(folder))
        .forEach(async (folderPath) => {
        const files = await addWorkspaceRootToWatch(folderPath);
        const xetoFiles = files.filter((path) => path.endsWith(".xeto"));
        xetoFiles
            .filter((file) => !docsToCompilerResults[file])
            .forEach(async (file) => {
            const textDocument = vscode_languageserver_textdocument_1.TextDocument.create(file, "xeto", 1, (await connection.sendRequest('xfs/readFile', { path: file })));
            parseDocument_1.parseDocument(textDocument, connection, libManager, docsToCompilerResults);
            noLoaded++;
            if (noLoaded >= rootFolders.filter(Boolean).length) {
                events_1.eventBus.fire(2 /* WORKSPACE_SCANNED */);
            }
        });
    });
};
connection.onInitialize((params) => {
    rootFolders = getRootFolderFromParams(params).map(str => str.replace(/\/$/, ""));
    parseAllRootFolders();
    return init_1.generateInitResults(params);
});
connection.onInitialized(async () => {
    init_1.onInitialized(connection, libManager, docsToCompilerResults);
    return {
        capabilities: {},
    };
});
connection.onDidChangeConfiguration((change) => {
    // Revalidate all open text documents
    documents.all().forEach((doc) => parseDocument_1.parseDocument(doc, connection, libManager, docsToCompilerResults));
});
// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
    parseAllRootFolders();
    parseDocument_1.parseDocument(change.document, connection, libManager, docsToCompilerResults);
});
connection.onDidChangeWatchedFiles((_change) => {
    // Monitored files have change in VSCode
    connection.console.log("We received an file change event");
});
capabilities_1.addAutoCompletion(connection, libManager, docsToCompilerResults, documents);
capabilities_1.addHover(connection, docsToCompilerResults, documents, parseDocument_1.compilersToLibs, libManager);
capabilities_1.addDefinition(connection, docsToCompilerResults, documents, parseDocument_1.compilersToLibs, libManager);
capabilities_1.addSemanticTokens(connection, libManager, docsToCompilerResults);
capabilities_1.addSymbols(connection, docsToCompilerResults);
capabilities_1.addFormatting(connection, documents, docsToCompilerResults);
capabilities_1.addRenameSymbol(connection, docsToCompilerResults, documents, parseDocument_1.compilersToLibs);
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);
// Listen on the connection
connection.listen();
//# sourceMappingURL=browserServer.js.map