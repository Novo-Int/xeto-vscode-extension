/* --------------------------------------------------------------------------------------------
 * Copyright (c) Novi-Studio
 * ------------------------------------------------------------------------------------------ */
import {
  createConnection,
  TextDocuments,
  InitializeParams,
  InitializeResult,
  BrowserMessageReader,
  BrowserMessageWriter
} from "vscode-languageserver/browser";

import { VARS } from './utils';
VARS.env = "BROWSER";

import { TextDocument } from "vscode-languageserver-textdocument";

import { ProtoCompiler } from "./compiler/Compiler";

import {
  LibraryManager,
} from "./libraries/";

import { generateInitResults, onInitialized } from "./init";

import {
  compilersToLibs,
  parseDocument
} from "./parseDocument";

import {
  addAutoCompletion,
  addRenameSymbol,
  addFormatting,
  addSymbols,
  addSemanticTokens,
  addDefinition,
  addHover
} from "./capabilities";
import { EVENT_TYPE, eventBus } from './events';

const messageReader = new BrowserMessageReader(self);
const messageWriter = new BrowserMessageWriter(self);

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(messageReader, messageWriter);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let rootFolders: string[] = [];

const docsToCompilerResults: Record<string, ProtoCompiler> = {};

const libManager: LibraryManager = new LibraryManager();

const getRootFolderFromParams = (params: InitializeParams): string[] => {
  let ret = "";

  if (params.workspaceFolders) {
    return params.workspaceFolders.map((folder) =>
      folder.uri.replace("file://", "")
    );
  } else {
    ret = params.rootUri || "";
  }

  ret = ret.replace("file://", "");

  return [ret];
};

const addWorkspaceRootToWatch = async (path: string, storage: string[] = []) => {
  const files: [] = await connection.sendRequest('xfs/readDir', { path });

  await Promise.all(
    files.map((entry) => {
      if (entry[1] === 2) {
        return addWorkspaceRootToWatch(`${path}/${entry[0]}`, storage);
      } else {
        storage.push(`${path}/${entry[0]}`);
      }
    })
  );

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
          const textDocument = TextDocument.create(
            file,
            "xeto",
            1,
            (await connection.sendRequest('xfs/readFile', {path: file}))
          );

          parseDocument(textDocument, connection, libManager, docsToCompilerResults);

          noLoaded ++;
          if (noLoaded >= rootFolders.filter(Boolean).length) {
            eventBus.fire(EVENT_TYPE.WORKSPACE_SCANNED);
          }
        });
    });
};


connection.onInitialize((params: InitializeParams) => {
  rootFolders = getRootFolderFromParams(params).map(str => str.replace(/\/$/,""));

  parseAllRootFolders();

  return generateInitResults(params);
});

connection.onInitialized(async (): Promise<InitializeResult> => {
  onInitialized(connection, libManager, docsToCompilerResults);

  return {
    capabilities: {},
  };
});

connection.onDidChangeConfiguration((change) => {
  // Revalidate all open text documents
  documents.all().forEach((doc) => parseDocument(doc, connection, libManager, docsToCompilerResults));
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
  parseAllRootFolders();

  parseDocument(change.document, connection, libManager, docsToCompilerResults);
});

connection.onDidChangeWatchedFiles((_change) => {
  // Monitored files have change in VSCode
  connection.console.log("We received an file change event");
});

addAutoCompletion(connection, libManager, docsToCompilerResults, documents);

addHover(connection, docsToCompilerResults, documents, compilersToLibs, libManager);

addDefinition(connection, docsToCompilerResults, documents, compilersToLibs, libManager);

addSemanticTokens(connection, libManager, docsToCompilerResults);

addSymbols(connection, docsToCompilerResults);

addFormatting(connection, documents, docsToCompilerResults);

addRenameSymbol(connection, docsToCompilerResults, documents, compilersToLibs);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
