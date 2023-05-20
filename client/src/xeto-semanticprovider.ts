import type * as vscode from "vscode";

import { type LanguageClient } from "vscode-languageclient/node";

import { type LanguageClient as BrowserLanguageClient } from "vscode-languageclient/browser";

export default class XetoSemanticTokenProvider
  implements vscode.DocumentSemanticTokensProvider
{
  private readonly _client: LanguageClient | BrowserLanguageClient;

  constructor(client: LanguageClient | BrowserLanguageClient) {
    this._client = client;
  }

  async provideDocumentSemanticTokens(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.SemanticTokens> {
    const results = await this._client.sendRequest(
      "textDocument/semanticTokens/full",
      {
        textDocument: {
          uri: document.uri.toString(),
        },
      }
    );

    return results as vscode.SemanticTokens;
  }
}
