import * as vscode from 'vscode';

import {
	LanguageClient,
} from 'vscode-languageclient/node';

export default class PogSemanticTokenProvider implements vscode.DocumentSemanticTokensProvider {
	private _client: LanguageClient;

	constructor (client: LanguageClient) {
		this._client = client;
	}

	async provideDocumentSemanticTokens(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.SemanticTokens> {
		const results = await this._client.sendRequest('textDocument/semanticTokens/full', {
			textDocument: document
		});

		return results as vscode.SemanticTokens;
	}
}