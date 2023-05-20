/* --------------------------------------------------------------------------------------------
 * Copyright (c) Novo Studio
 * ------------------------------------------------------------------------------------------ */
import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  type InitializeParams,
  type InitializeResult,
} from "vscode-languageserver/node";

import { VARS } from "./utils";

import { TextDocument } from "vscode-languageserver-textdocument";

import fs from "fs/promises";

import { type ProtoCompiler } from "./compiler/Compiler";
import { type Dirent } from "fs";
import { LibraryManager } from "./libraries/";

import { generateInitResults, onInitialized } from "./init";

import { compilersToLibs, parseDocument } from "./parseDocument";

import {
  addAutoCompletion,
  addRenameSymbol,
  addFormatting,
  addSymbols,
  addSemanticTokens,
  addDefinition,
  addHover,
} from "./capabilities";
VARS.env = "NODE";

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents = new TextDocuments<TextDocument>(TextDocument);

let rootFolders: string[] = [];

const docsToCompilerResults: Record<string, ProtoCompiler> = {};

const libManager: LibraryManager = new LibraryManager();

const getRootFolderFromParams = (params: InitializeParams): string[] => {
  let ret = "";

  if (params.workspaceFolders != null) {
    return params.workspaceFolders.map((folder) =>
      folder.uri.replace("file://", "")
    );
  } else {
    ret = params.rootUri ?? "";
  }

  ret = ret.replace("file://", "");

  return [ret];
};

const addWorkspaceRootToWatch = async (
  uri: string,
  storage: string[] = []
): Promise<string[]> => {
  const files = await fs.readdir(uri, {
    withFileTypes: true,
  });

  await Promise.all(
    files.map(async (dirEntry: Dirent) => {
      if (dirEntry.isDirectory()) {
        return await addWorkspaceRootToWatch(
          `${uri}/${dirEntry.name}`,
          storage
        );
      } else {
        storage.push(`${uri}/${dirEntry.name}`);
      }
    })
  );

  return storage;
};

const parseAllRootFolders = (): void => {
  rootFolders
    .filter((folder) => Boolean(folder))
    .forEach((folderPath) => {
      void addWorkspaceRootToWatch(folderPath).then((files) => {
        const xetoFiles = files.filter((path) => path.endsWith(".xeto"));

        xetoFiles
          .filter((file) => !docsToCompilerResults[`file://${file}`])
          .forEach((file) => {
            void fs.readFile(file).then((content) => {
              const textDocument = TextDocument.create(
                `file://${file}`,
                "xeto",
                1,
                content.toString()
              );

              void parseDocument(
                textDocument,
                connection,
                libManager,
                docsToCompilerResults
              );
            });
          });
      });
    });
};

connection.onInitialize((params: InitializeParams) => {
  rootFolders = getRootFolderFromParams(params);

  parseAllRootFolders();

  return generateInitResults(params);
});

connection.onInitialized((): InitializeResult => {
  void onInitialized(connection, libManager, docsToCompilerResults);

  return {
    capabilities: {},
  };
});

connection.onDidChangeConfiguration((change) => {
  // Revalidate all open text documents
  documents.all().forEach((doc) => {
    void parseDocument(doc, connection, libManager, docsToCompilerResults);
  });
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
  parseAllRootFolders();

  void parseDocument(
    change.document,
    connection,
    libManager,
    docsToCompilerResults
  );
});

connection.onDidChangeWatchedFiles((_change) => {
  // Monitored files have change in VSCode
  connection.console.log("We received an file change event");
});

addAutoCompletion(connection, libManager, docsToCompilerResults, documents);

addHover(
  connection,
  docsToCompilerResults,
  documents,
  compilersToLibs,
  libManager
);

addDefinition(
  connection,
  docsToCompilerResults,
  documents,
  compilersToLibs,
  libManager
);

addSemanticTokens(connection, libManager, docsToCompilerResults);

addSymbols(connection, docsToCompilerResults);

addFormatting(connection, documents, docsToCompilerResults);

addRenameSymbol(connection, docsToCompilerResults, documents, compilersToLibs);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
