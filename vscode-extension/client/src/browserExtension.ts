/*---------------------------------------------------------------------------------------------
  * Copyright (c) Novi-Studio
 *--------------------------------------------------------------------------------------------*/

import { ExtensionContext, Uri } from 'vscode';
import { LanguageClientOptions } from 'vscode-languageclient';

import { LanguageClient } from 'vscode-languageclient/browser';

// this method is called when vs code is activated
export function activate(context: ExtensionContext) {
	/* 
	 * all except the code to create the language client in not browser specific
	 * and could be shared with a regular (Node) extension
	 */
	const documentSelector = [{ scheme: 'file', language: 'xeto' }];

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		documentSelector,
		synchronize: {},
		initializationOptions: {}
	};

	const client = createWorkerLanguageClient(context, clientOptions);

	const disposable = client.start();
	context.subscriptions.push(disposable);

	client.onReady().then(() => {
		console.log("XETO started");
	});
}

function createWorkerLanguageClient(context: ExtensionContext, clientOptions: LanguageClientOptions) {
	// Create a worker. The worker main file implements the language server.
	const serverMain = Uri.joinPath(context.extensionUri, 'server/dist/browserServerMain.js');
	const worker = new Worker(serverMain.toString(true));

	// create the language server client to communicate with the server running in the worker
	return new LanguageClient('lsp-web-extension-sample', 'LSP Web Extension Sample', clientOptions, worker);
}