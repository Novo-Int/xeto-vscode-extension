import {
  Connection,
  DidChangeConfigurationNotification,
  DidChangeWatchedFilesNotification,
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind,
} from "vscode-languageserver";
import {
  ExtLibDef,
  LibraryManager,
  loadExtLibs,
  loadSysLibsFromGH,
} from "./libraries";
import { ProtoCompiler } from './compiler/Compiler';

let hasWorkspaceFolderCapability = false;
let hasConfigurationCapability = false;

export const generateInitResults = (params: InitializeParams) => {
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
  return {
    result,
    hasConfigurationCapability,
  };
};

export const onInitialized = async (
  connection: Connection,
  libManager: LibraryManager,
  compiledDocs: Record<string, ProtoCompiler>
) => {
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

  //  keep the document ref, but delete all the keys
  Object.keys(compiledDocs).forEach((key) => {
    delete compiledDocs[key];
  });

  const settings = await connection.workspace.getConfiguration("xeto");

  loadSysLibsFromGH(settings.libraries.sys, libManager);
  loadExtLibs(
    settings.libraries.external as (string | ExtLibDef)[],
    libManager
  );
};
