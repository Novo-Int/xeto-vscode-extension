/*---------------------------------------------------------------------------------------------
  * Copyright (c) Novi-Studio
 *--------------------------------------------------------------------------------------------*/

import { ExtensionContext, Uri, workspace, SemanticTokensLegend, languages } from 'vscode';
import { LanguageClientOptions } from 'vscode-languageclient';


import { LanguageClient } from 'vscode-languageclient/browser';

import XetoProvider from './xeto-contentprovider';
import XetoSemanticTokenProvider from './xeto-semanticprovider';

// this method is called when vs code is activated
export function activate(context: ExtensionContext) {
	/* 
	 * all except the code to create the language client in not browser specific
	 * and could be shared with a regular (Node) extension
	 */
	const documentSelector = [{ language: 'xeto' }];

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		documentSelector,
		synchronize: {},
		initializationOptions: {}
	};

	const client = createWorkerLanguageClient(context, clientOptions);

	const disposable = client.start();
	context.subscriptions.push(disposable);

	workspace.registerTextDocumentContentProvider('xeto', new XetoProvider());
	const legend = (function() {
		const tokenTypesLegend = [
			'label'
		];

		const tokenModifiersLegend = [
			'defaultLibrary'
		];

		return new SemanticTokensLegend(tokenTypesLegend, tokenModifiersLegend);
	})();

	const selector = { language: 'xeto' };
	context.subscriptions.push(languages.registerDocumentSemanticTokensProvider(selector, new XetoSemanticTokenProvider(client), legend));

	client.onReady().then(() => {
		console.log("XETO started");
	});
}

function createWorkerLanguageClient(context: ExtensionContext, clientOptions: LanguageClientOptions) {
	// Create a worker. The worker main file implements the language server.
	const serverMain = Uri.joinPath(context.extensionUri, 'server/dist/browserServerMain.js');
	const worker = new Worker(serverMain.toString(true));

	// create the language server client to communicate with the server running in the worker
	return new LanguageClient('xeto-extension', 'Xeto Web Extension', clientOptions, worker);
}