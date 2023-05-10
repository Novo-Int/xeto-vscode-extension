/* --------------------------------------------------------------------------------------------
 * Copyright (c) Novi-Studio
 * ------------------------------------------------------------------------------------------ */
import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  HoverParams,
  Hover,
  DefinitionParams,
  Definition,
  SemanticTokensParams,
  SemanticTokens,
  DocumentFormattingParams,
} from "vscode-languageserver/node";

import { VARS } from './utils';
VARS.env = "NODE";

import { Position, TextDocument } from "vscode-languageserver-textdocument";

import fs from "fs/promises";

import { ProtoCompiler } from "./compiler/Compiler";
import { CompilerError } from "./compiler/Errors";
import { FileLoc } from "./compiler/FileLoc";
import { Dirent } from "fs";
import { Proto } from "./compiler/Proto";
import { findProtoByQname } from "./FindProto";
import {
  LibraryManager,
} from "./libraries/";
import {
  extractSemanticProtos,
  convertProtosToSemanticTokens,
} from "./semantic-tokens";
import {
  DocumentSymbol,
  DocumentSymbolParams,
  TextEdit,
} from "vscode-languageserver";
import { formatFile } from "./formatting";
import { generateSymbols } from "./symbols";

import { generateInitResults, onInitialized } from "./init";

import {
  getLargestIdentifierForPosition
} from "./capabilities/utils";

import {
  populateLibraryManager,
  compilersToLibs
} from "./parseDocument";

import {
  addAutoCompletion,
  addRenameSymbol
} from "./capabilities";

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
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

const addWorkspaceRootToWatch = async (uri: string, storage: string[] = []) => {
  const files = await fs.readdir(uri, {
    withFileTypes: true,
  });

  await Promise.all(
    files.map((dirEntry: Dirent) => {
      if (dirEntry.isDirectory()) {
        return addWorkspaceRootToWatch(`${uri}/${dirEntry.name}`, storage);
      } else {
        storage.push(`${uri}/${dirEntry.name}`);
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
        .filter((file) => !docsToCompilerResults[`file://${file}`])
        .forEach(async (file) => {
          const textDocument = TextDocument.create(
            `file://${file}`,
            "xeto",
            1,
            await (await fs.readFile(file)).toString()
          );

          parseDocument(textDocument);
        });
    });
};

connection.onInitialize((params: InitializeParams) => {
  rootFolders = getRootFolderFromParams(params);

  parseAllRootFolders();

  let result;

  ({ hasConfigurationCapability, result } = generateInitResults(params));

  return result;
});

connection.onInitialized(async (): Promise<InitializeResult> => {
  onInitialized(connection, libManager, docsToCompilerResults);

  return {
    capabilities: {},
  };
});

connection.onDidChangeConfiguration((change) => {
  // Revalidate all open text documents
  documents.all().forEach(parseDocument);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
  parseAllRootFolders();

  parseDocument(change.document);
});

function isCompilerError(error: any): error is CompilerError {
  return "type" in error;
}

function fileLocToDiagPosition(loc: FileLoc): Position {
  return {
    line: loc.line,
    character: loc.col > 0 ? loc.col - 1 : loc.col,
  };
}

async function parseDocument(textDocument: TextDocument): Promise<void> {
  const diagnostics: Diagnostic[] = [];
  const compiler = new ProtoCompiler(textDocument.uri);
  const text = textDocument.getText();

  // if no compiler is saved then save one
  if (!docsToCompilerResults[textDocument.uri]) {
    docsToCompilerResults[textDocument.uri] = compiler;
  } else {
    // if a compiler is already present
    // only add a compiler if no errors are availabe
    // TO DO - remove this logic and always add the current compiler when we have a resilient compiler
    if (compiler.errs.length === 0) {
      docsToCompilerResults[textDocument.uri] = compiler;
    }
  }

  try {
    compiler.run(text + "\0");
    compiler.errs.forEach((err) => {
      const diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Error,
        range: {
          start: fileLocToDiagPosition(err.loc),
          end: fileLocToDiagPosition(err.endLoc),
        },
        message: err.message,
        //source: 'ex'
      };

      diagnostics.push(diagnostic);
    });
  } catch (e: unknown) {
    if (isCompilerError(e)) {
      const diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Error,
        range: {
          start: textDocument.positionAt(e.loc.charIndex),
          end: textDocument.positionAt(text.length),
        },
        message: e.message,
        //source: 'ex'
      };

      diagnostics.push(diagnostic);
    }
  } finally {
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
    // time to add it to the library manager
    populateLibraryManager(compiler, connection, libManager);

    // resolve refs
    compiler.root?.resolveRefTypes(compiler.root, libManager);
  }
  return;
}

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

function onDocumentSymbols(params: DocumentSymbolParams): DocumentSymbol[] {
  const uri = params.textDocument.uri;

  if (!uri) {
    return [];
  }
  const compiler = docsToCompilerResults[uri];

  if (!compiler) {
    return [];
  }

  const root = compiler.root;

  if (!root) {
    return [];
  }

  return generateSymbols(root);
}

connection.onDocumentSymbol(onDocumentSymbols);

function onDocumentFormatting(params: DocumentFormattingParams): TextEdit[] {
  const uri = params.textDocument.uri;

  const compiler = docsToCompilerResults[uri];

  if (!compiler) {
    return [];
  }

  const tokenBag = compiler.tokenBag;

  if (!tokenBag || !tokenBag.length) {
    return [];
  }

  const doc = documents.get(uri);

  if (!doc) {
    return [];
  }

  return formatFile(doc, tokenBag, params.options);
}

connection.onDocumentFormatting(onDocumentFormatting);

addRenameSymbol(connection, docsToCompilerResults, documents, compilersToLibs);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
