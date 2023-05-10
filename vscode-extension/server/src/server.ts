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
  DidChangeConfigurationNotification,
  TextDocumentSyncKind,
  InitializeResult,
  DidChangeWatchedFilesNotification,
  HoverParams,
  Hover,
  DefinitionParams,
  Definition,
  SemanticTokensParams,
  SemanticTokens,
  DocumentFormattingParams,
} from "vscode-languageserver/node";

import { Position, TextDocument } from "vscode-languageserver-textdocument";

import fs from "fs/promises";
import osPath = require("path");

import { ProtoCompiler } from "./compiler/Compiler";
import { CompilerError } from "./compiler/Errors";
import { FileLoc } from "./compiler/FileLoc";
import { Dirent } from "fs";
import { Proto } from "./compiler/Proto";
import { findProtoByQname } from "./FindProto";
import {
  LibraryManager,
  XetoLib,
  loadSysLibsFromGH,
  loadExtLibs,
  ExtLibDef,
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

import {
  getLargestIdentifierForPosition
} from "./capabilities/utils";

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
let hasWorkspaceFolderCapability = false;
let rootFolders: string[] = [];

let docsToCompilerResults: Record<string, ProtoCompiler> = {};
const compilersToLibs: Map<ProtoCompiler, XetoLib> = new Map();

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

  const capabilities = params.capabilities;

  // Does the client support the `workspace/configuration` request?
  // If not, we fall back using global settings.
  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      hoverProvider: true,
      definitionProvider: true,
      documentFormattingProvider: true,
      documentSymbolProvider: true,
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
});

connection.onInitialized(async (): Promise<InitializeResult> => {
  if (hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client.register(
      DidChangeConfigurationNotification.type,
      undefined
    );
    connection.client.register(
      DidChangeWatchedFilesNotification.type,
      undefined
    );
  }
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders((_event) => {
      connection.console.log("Workspace folder change event received.");
    });
  }

  docsToCompilerResults = {};

  const settings = await connection.workspace.getConfiguration("xeto");

  loadSysLibsFromGH(settings.libraries.sys, libManager);
  loadExtLibs(
    settings.libraries.external as (string | ExtLibDef)[],
    libManager
  );

  return {
    capabilities: {},
  };
});

// Xeto settings
type ExtLibSetting = {
  name: string;
  files: string[];
};
interface XetoSettings {
  libs: {
    external: ExtLibSetting[];
    system: string;
  };
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: XetoSettings = {
  libs: {
    external: [],
    system: "",
  },
};

let globalSettings: XetoSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<XetoSettings>> = new Map();

connection.onDidChangeConfiguration((change) => {
  if (hasConfigurationCapability) {
    // Reset all cached document settings
    documentSettings.clear();
  } else {
    globalSettings = <XetoSettings>(
      (change.settings.languageServerExample || defaultSettings)
    );
  }

  // Revalidate all open text documents
  documents.all().forEach(parseDocument);
});

// Only keep settings for open documents
documents.onDidClose((e) => {
  documentSettings.delete(e.document.uri);
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

async function populateLibraryManager(compiler: ProtoCompiler) {
  if (!compiler.root) {
    return;
  }

  const split = compiler.sourceUri.split("/");
  let hasLib = false;

  try {
    const stat = await fs.stat(
      osPath.join(compiler.sourceUri.replace("file:/", ""), "..", "lib.xeto")
    );
    if (stat.isFile()) {
      hasLib = true;
    }
  } catch {
    return;
  }

  let libName: string | undefined = undefined;
  let libVersion = "";
  let libDoc = "";
  const deps: string[] = [];

  if (hasLib) {
    libName = split[split.length - 2];
  }

  const isLibMeta = compiler.sourceUri.endsWith("lib.xeto");

  if (isLibMeta) {
    const pragma = compiler.root?.children["pragma"];

    libName = split[split.length - 2];
    libVersion = pragma?.children._version.type;
    libDoc = pragma?.doc || "";

    const protoDeps = pragma?.children._depends?.children;

    protoDeps &&
      Object.keys(protoDeps).forEach((key) => {
        if (key.startsWith("#")) {
          return;
        }

        deps.push(protoDeps[key].children.lib.type);
      });
  }

  if (!libName) {
    return;
  }

  if (!libManager.getLib(libName)) {
    libManager.addLib(
      new XetoLib(libName, libVersion, compiler.sourceUri, libDoc)
    );
  }

  const xetoLib = libManager.getLib(libName);

  if (!xetoLib) {
    return;
  }

  compilersToLibs.set(compiler, xetoLib);

  if (libVersion) {
    xetoLib.addMeta(libVersion, libDoc, deps);
  }

  if (!isLibMeta) {
    Object.entries(compiler.root.children).forEach(([name, proto]) => {
      xetoLib.addChild(name, proto);
    });
  }
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
    populateLibraryManager(compiler);

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
