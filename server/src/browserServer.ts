/* --------------------------------------------------------------------------------------------
 * Copyright (c) Novo Studio
 * ------------------------------------------------------------------------------------------ */
import {
  createConnection,
  TextDocuments,
  type InitializeParams,
  type InitializeResult,
  BrowserMessageReader,
  BrowserMessageWriter,
} from "vscode-languageserver/browser";

import { VARS } from "./utils";

import { TextDocument } from "vscode-languageserver-textdocument";

import { type ProtoCompiler } from "./compiler/Compiler";

import { LibraryManager } from "./libraries/";

import { generateInitResults, onInitialized } from "./init";

import { uriToLibs, compilersToLibs, parseDocument } from "./parseDocument";

import {
  addAutoCompletion,
  addRenameSymbol,
  addFormatting,
  addSymbols,
  addSemanticTokens,
  addDefinition,
  addHover,
} from "./capabilities";
import { EVENT_TYPE, eventBus } from "./events";
VARS.env = "BROWSER";

const messageReader = new BrowserMessageReader(self);
const messageWriter = new BrowserMessageWriter(self);

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(messageReader, messageWriter);

// Create a simple text document manager.
const documents = new TextDocuments<TextDocument>(TextDocument);

eventBus.addListener(EVENT_TYPE.WILL_RESOLVE_REFS, () => {
  //  parse again so we resolve refs
  parseAllRootFolders();
});

let rootFolders: string[] = [];

const docsToCompilerResults: Record<string, ProtoCompiler> = {};
const uriToTextDocuments = new Map<string, TextDocument>();

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
  path: string,
  storage: string[] = []
): Promise<string[]> => {
  const files: Array<[string, number]> = await connection.sendRequest(
    "xfs/readDir",
    { path }
  );

  await Promise.all(
    files.map(async (entry) => {
      if (entry[1] === 2) {
        return await addWorkspaceRootToWatch(`${path}/${entry[0]}`, storage);
      } else {
        storage.push(`${path}/${entry[0]}`);
      }
    })
  );

  return storage;
};

const parseAllRootFolders = (): void => {
  let noLoaded = 0;
  let totalToLoad = 0;

  const filesToParsePr = rootFolders
    .filter(Boolean)
    .map(async (fp) => await addWorkspaceRootToWatch(fp));

  void Promise.all(filesToParsePr).then((files) => {
    const xetoFiles = files.flat().filter((path) => path.endsWith(".xeto"));
    totalToLoad = xetoFiles.length;

    xetoFiles.forEach((file) => {
      void (async function (): Promise<void> {
        const textDocument = TextDocument.create(
          file,
          "xeto",
          1,
          await connection.sendRequest("xfs/readFile", { path: file })
        );

        uriToTextDocuments.set(file, textDocument);

        void parseDocument(
          textDocument,
          connection,
          libManager,
          docsToCompilerResults
        ).then(() => {
          noLoaded++;
          if (noLoaded >= totalToLoad) {
            eventBus.fire(EVENT_TYPE.WORKSPACE_SCANNED);
          }
        });
      })();
    });
  });
};

connection.onInitialize((params: InitializeParams) => {
  rootFolders = getRootFolderFromParams(params).map((str) =>
    str.replace(/\/$/, "")
  );

  return generateInitResults(params);
});

connection.onInitialized((): InitializeResult => {
  void onInitialized(connection, libManager, docsToCompilerResults);

  parseAllRootFolders();

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
  uriToTextDocuments.set(change.document.uri, change.document);

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

addAutoCompletion(
  connection,
  libManager,
  docsToCompilerResults,
  documents,
  uriToLibs
);

addHover(connection, docsToCompilerResults, documents, uriToLibs, libManager);

addDefinition(
  connection,
  docsToCompilerResults,
  documents,
  uriToLibs,
  libManager
);

addSemanticTokens(connection, libManager, docsToCompilerResults);

addSymbols(connection, docsToCompilerResults);

addFormatting(connection, documents, docsToCompilerResults);

addRenameSymbol(
  connection,
  docsToCompilerResults,
  uriToTextDocuments,
  compilersToLibs
);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
