import { InitializeParams, InitializeResult, TextDocumentSyncKind } from 'vscode-languageserver';

export const generateInitResults = (params: InitializeParams) => {
  const capabilities = params.capabilities;

  // Does the client support the `workspace/configuration` request?
  // If not, we fall back using global settings.
  const hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  const hasWorkspaceFolderCapability = !!(
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
	hasWorkspaceFolderCapability
  };
};
