/* --------------------------------------------------------------------------------------------
 * Copyright (c) Novi-Studio
 * ------------------------------------------------------------------------------------------ */
import {
  createConnection,
  TextDocuments,
  InitializeParams,
  InitializeResult,
  HoverParams,
  Hover,
  DefinitionParams,
  Definition,
  SemanticTokensParams,
  SemanticTokens,
  BrowserMessageReader,
  BrowserMessageWriter
} from "vscode-languageserver/browser";

import { VARS } from './utils';
VARS.env = "BROWSER";

import { Position, TextDocument } from "vscode-languageserver-textdocument";

import { ProtoCompiler } from "./compiler/Compiler";
import { Proto } from "./compiler/Proto";
import { findProtoByQname } from "./FindProto";
import {
  LibraryManager,
} from "./libraries/";
import {
  extractSemanticProtos,
  convertProtosToSemanticTokens,
} from "./semantic-tokens";

import { generateInitResults, onInitialized } from "./init";

import {
  getLargestIdentifierForPosition
} from "./capabilities/utils";

import {
  compilersToLibs,
  parseDocument
} from "./parseDocument";

import {
  addAutoCompletion,
  addRenameSymbol,
  addFormatting,
  addSymbols
} from "./capabilities";

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
        });
    });
};


connection.onInitialize((params: InitializeParams) => {
  rootFolders = getRootFolderFromParams(params);

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

function getProtoFromFileLoc(uri: string, pos: Position): Proto | null {
  // let try to find the identifier for this position
  const compiledDocument = docsToCompilerResults[uri];
  const doc = documents.get(uri);

  if (!compiledDocument || !doc) {
    return null;
  }

  const identifier = getLargestIdentifierForPosition(doc, pos);

  if (!identifier) {
    return null;
  }

  const proto =
    compiledDocument.root &&
    findProtoByQname(identifier.join("."), compiledDocument.root);

  if (proto) {
    return proto;
  } else {
    // 	search in the files lib first
    const lib = compilersToLibs.get(compiledDocument);

    if (lib) {
      const proto = findProtoByQname(identifier.join("."), lib.rootProto);

      if (proto) {
        return proto;
      }
    }

    const proto = libManager.findProtoByQName(identifier.join("."), lib?.deps);

    return proto;
  }
}

function handleHover(params: HoverParams): Hover | null {
  const proto = getProtoFromFileLoc(params.textDocument.uri, params.position);

  if (!proto) {
    return null;
  }

  return {
    contents: proto.doc || "",
  };
}

connection.onHover(handleHover);

function handleDefinition(params: DefinitionParams): Definition | null {
  const proto = getProtoFromFileLoc(params.textDocument.uri, params.position);

  if (!proto || !proto.loc) {
    return null;
  }

  return {
    uri: proto.loc.file,
    range: {
      start: {
        line: proto.loc.line,
        character: proto.loc.col,
      },
      end: {
        line: proto.loc.line,
        character: proto.loc.col + 1,
      },
    },
  };
}

connection.onDefinition(handleDefinition);

function handleSemanticTokens(params: SemanticTokensParams): SemanticTokens {
  const uri = params.textDocument.uri;

  const compiler = docsToCompilerResults[uri];

  if (!compiler || !compiler.root) {
    return {
      data: [],
    };
  }

  const semanticProtos = extractSemanticProtos(compiler.root, libManager);
  const semanticTokens = convertProtosToSemanticTokens(semanticProtos);

  return {
    data: semanticTokens,
  };
}

connection.languages.semanticTokens.on(handleSemanticTokens);

addSymbols(connection, docsToCompilerResults);

addFormatting(connection, documents, docsToCompilerResults);

addRenameSymbol(connection, docsToCompilerResults, documents, compilersToLibs);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
