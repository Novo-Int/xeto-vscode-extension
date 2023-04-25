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
  CompletionItem,
  CompletionItemKind,
  TextDocumentSyncKind,
  InitializeResult,
  CompletionParams,
  DidChangeWatchedFilesNotification,
  HoverParams,
  Hover,
  DefinitionParams,
  Definition,
  SemanticTokensParams,
  SemanticTokens,
  DocumentFormattingParams,
  BrowserMessageReader,
  BrowserMessageWriter
} from "vscode-languageserver/browser";

import { Position, TextDocument } from "vscode-languageserver-textdocument";

import { ProtoCompiler } from "./compiler/Compiler";
import { CompilerError } from "./compiler/Errors";
import { FileLoc } from "./compiler/FileLoc";
import { Proto } from "./compiler/Proto";
import { findChildrenOf, findProtoByQname } from "./FindProto";
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
import { renameInDoc } from "./refactor";
import {
  DocumentSymbol,
  DocumentSymbolParams,
  RenameParams,
  TextEdit,
  WorkspaceEdit,
} from "vscode-languageserver";
import { formatFile } from "./formatting";
import { generateSymbols } from "./symbols";

const messageReader = new BrowserMessageReader(self);
const messageWriter = new BrowserMessageWriter(self);

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(messageReader, messageWriter);

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

  connection.workspace.getWorkspaceFolders();

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

/*
const addWorkspaceRootToWatch = async (uri: vscode.Uri, storage: string[] = []) => {
  const files = await vscode.workspace.fs.readDirectory(uri);

  await Promise.all(
    files.map((entry) => {
      if (entry[1] === vscode.FileType.Directory) {
        return addWorkspaceRootToWatch(vscode.Uri.joinPath(uri, entry[0]), storage);
      } else {
        storage.push(`${uri}/${entry[0]}`);
      }
    })
  );

  return storage;
};

const parseAllRootFolders = () => {
  rootFolders
    .filter((folder) => Boolean(folder))
    .forEach(async (folderPath) => {
      const files = await addWorkspaceRootToWatch(vscode.Uri.parse(folderPath));

      const xetoFiles = files.filter((path) => path.endsWith(".xeto"));

      xetoFiles
        .filter((file) => !docsToCompilerResults[file])
        .forEach(async (file) => {
          const textDocument = TextDocument.create(
            file,
            "xeto",
            1,
            (await vscode.workspace.fs.readFile(vscode.Uri.parse(file))).toString()
          );

          parseDocument(textDocument);
        });
    });
};
*/

connection.onInitialize((params: InitializeParams) => {
  rootFolders = getRootFolderFromParams(params);

  console.log(rootFolders);

  // parseAllRootFolders();

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

function getDocumentSettings(resource: string): Thenable<XetoSettings> {
  if (!hasConfigurationCapability) {
    return Promise.resolve(globalSettings);
  }
  let result = documentSettings.get(resource);
  if (!result) {
    result = connection.workspace.getConfiguration({
      scopeUri: resource,
      section: "xeto",
    });
    documentSettings.set(resource, result);
  }
  return result;
}

// Only keep settings for open documents
documents.onDidClose((e) => {
  documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
  // parseAllRootFolders();

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
    const splitCopy = [...split];
    splitCopy.pop();
    splitCopy.push("lib.xeto");
    const libUrl = splitCopy.join("/");

    if (docsToCompilerResults[libUrl]) {
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

const identifierCharRegexp = /[a-zA-Z0-9_. \t]/;
const identifierSegmentCharRegexp = /[a-zA-Z0-9_]/;

function getIdentifierForPosition(doc: TextDocument, pos: Position): string {
  let position = doc.offsetAt(pos) - 1;
  const text = doc.getText();

  // this is naive, but we go backwards until we reach a :
  let identifier = "";

  while (position >= -1 && text.charAt(position).match(identifierCharRegexp)) {
    identifier = text.charAt(position) + identifier;
    position--;
  }

  if (position === -1) {
    return "";
  }

  identifier = identifier.trim().replace(/[\n\t]/g, "");

  return identifier;
}

function getIdentifierLength(doc: TextDocument, pos: Position): number {
  let position = doc.offsetAt(pos) - 1;
  let length = 0;
  const text = doc.getText();

  while (
    position >= -1 &&
    text.charAt(position).match(identifierSegmentCharRegexp)
  ) {
    position--;
    length++;
  }

  return length;
}

function getLargestIdentifierForPosition(
  doc: TextDocument,
  pos: Position
): string[] {
  let position = doc.offsetAt(pos);
  const text = doc.getText();

  // this is naive, but we go backwards until we reach a :
  let identifier = "";

  //  eat up \n
  while (position >= -1 && text.charAt(position) === "\n") {
    position--;
  }

  while (position >= -1 && text.charAt(position).match(identifierCharRegexp)) {
    identifier = text.charAt(position) + identifier;
    position--;
  }

  identifier = identifier.trim().replace(/[\n\t]/g, "");

  position = doc.offsetAt(pos) + 1;
  while (
    position < text.length &&
    text.charAt(position).match(identifierSegmentCharRegexp)
  ) {
    identifier += text.charAt(position);
    position++;
  }

  identifier = identifier.trim().replace(/[\n\t]/g, "");

  return identifier.split(".");
}

function handleAutoCompletion(params: CompletionParams): CompletionItem[] {
  // let try to find the identifier for this position
  const compiledDocument = docsToCompilerResults[params.textDocument.uri];
  const doc = documents.get(params.textDocument.uri);

  if (!compiledDocument || !doc) {
    return [];
  }

  const partialIdentifier = getIdentifierForPosition(doc, params.position);

  if (!partialIdentifier) {
    return [];
  }

  let options =
    (compiledDocument.root &&
      findChildrenOf(partialIdentifier, compiledDocument.root)) ||
    [];

  //	maybe the identifier is from a lib
  if (options.length === 0) {
    const libName = partialIdentifier.split(".")[0];
    const lib = libManager.getLib(libName);

    if (!lib) {
      return [];
    }

    //	get compilers for files that have this lib
    const identifierWithoutLib = partialIdentifier
      .split(".")
      .slice(1)
      .join(".");

    options = findChildrenOf(identifierWithoutLib, lib.rootProto);
  }

  return options.map((op) => ({
    label: op.label,
    kind: CompletionItemKind.Field,
    detail: op.parent,
    documentation: op.doc,
  }));
}

// This handler provides the initial list of the completion items.
connection.onCompletion(handleAutoCompletion);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  return item;
});

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

function onSymbolRename(params: RenameParams): WorkspaceEdit | null {
  const uri = params.textDocument.uri;

  const compiler = docsToCompilerResults[uri];
  const doc = documents.get(params.textDocument.uri);

  if (!compiler || !doc) {
    return null;
  }

  //  we need this because the selection for renaming may be in the middle of the identifier
  const startCharacter =
    params.position.character - getIdentifierLength(doc, params.position) + 1;

  const protoName = compiler.getQNameByLocation({
    line: params.position.line,
    character: startCharacter,
  });

  //  trying to rename a symbol that's not defined in this compilation unit
  if (protoName === "") {
    return null;
  }

  const proto =
    (compiler.root && findProtoByQname(protoName, compiler.root)) || null;

  if (!proto) {
    return null;
  }

  //  bail out if replacing with the same string
  if (proto.name === params.newName) {
    return null;
  }

  const workspaceEdit = {
    changes: {},
  } as {
    changes: Record<string, TextEdit[]>;
  };

  workspaceEdit.changes[uri] = [
    {
      range: {
        start: {
          character: startCharacter - 1,
          line: params.position.line,
        },
        end: {
          character: startCharacter - 1 + proto.name.length,
          line: params.position.line,
        },
      },
      newText: params.newName,
    },
    ...renameInDoc(params, protoName, doc, compiler),
  ];

  //  refactor in entire workspace
  Object.keys(docsToCompilerResults).forEach((docUri) => {
    //	skip current doc
    if (docUri === uri) {
      return;
    }

    //  we also want to skip if files are in different libs
    if (
      compilersToLibs.get(docsToCompilerResults[docUri]) !==
      compilersToLibs.get(compiler)
    ) {
      return;
    }

    const doc = documents.get(docUri);

    if (!doc) {
      return;
    }

    const edits = renameInDoc(
      params,
      protoName,
      doc,
      docsToCompilerResults[docUri]
    );

    if (edits.length) {
      workspaceEdit.changes[docUri] = edits;
    }
  });

  //  if proto is part of a lib then we need to add the lib name to it also
  const lib = compilersToLibs.get(compiler);
  if (lib) {
    //  refactor in entire workspace
    Object.keys(docsToCompilerResults).forEach((docUri) => {
      //	skip current doc
      if (docUri === uri) {
        return;
      }

      const doc = documents.get(docUri);

      if (!doc) {
        return;
      }

      const edits = renameInDoc(
        params,
        lib.name + "." + protoName,
        doc,
        docsToCompilerResults[docUri]
      );

      if (edits.length) {
        workspaceEdit.changes[docUri] = edits;
      }
    });
  }

  return workspaceEdit;
}

connection.onRenameRequest(onSymbolRename);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
