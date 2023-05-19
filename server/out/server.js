"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* --------------------------------------------------------------------------------------------
 * Copyright (c) Novi-Studio
 * ------------------------------------------------------------------------------------------ */
const node_1 = require("vscode-languageserver/node");
const utils_1 = require("./utils");
utils_1.VARS.env = "NODE";
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const promises_1 = __importDefault(require("fs/promises"));
const libraries_1 = require("./libraries/");
const init_1 = require("./init");
const parseDocument_1 = require("./parseDocument");
const capabilities_1 = require("./capabilities");
// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = node_1.createConnection(node_1.ProposedFeatures.all);
// Create a simple text document manager.
const documents = new node_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
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
const addWorkspaceRootToWatch = async (uri, storage = []) => {
    const files = await promises_1.default.readdir(uri, {
        withFileTypes: true,
    });
    await Promise.all(files.map((dirEntry) => {
        if (dirEntry.isDirectory()) {
            return addWorkspaceRootToWatch(`${uri}/${dirEntry.name}`, storage);
        }
        else {
            storage.push(`${uri}/${dirEntry.name}`);
        }
    }));
    return storage;
};
const parseAllRootFolders = () => {
    rootFolders
        .filter((folder) => Boolean(folder))
        .forEach(async (folderPath) => {
        const files = await addWorkspaceRootToWatch(folderPath);
        const xetoFiles = files.filter((path) => path.endsWith(".xeto"));
        xetoFiles
            .filter((file) => !docsToCompilerResults[`file://${file}`])
            .forEach(async (file) => {
            const textDocument = vscode_languageserver_textdocument_1.TextDocument.create(`file://${file}`, "xeto", 1, await (await promises_1.default.readFile(file)).toString());
            parseDocument_1.parseDocument(textDocument, connection, libManager, docsToCompilerResults);
        });
    });
};
connection.onInitialize((params) => {
    rootFolders = getRootFolderFromParams(params);
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
//# sourceMappingURL=server.js.map