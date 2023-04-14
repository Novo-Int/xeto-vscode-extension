import * as vscode from 'vscode';

import * as https from 'node:https';

const readUrl = (url: string): Promise<string> => {
	const pr = new Promise<string>((res, rej) => {
		https.get(url, (resp) => {
			let data = '';
	
			resp.on('data', chunk => {
				data += chunk;
			});
	
			resp.on('end', () => {
				res(data);
			});
		});

	});

	return pr;
};

export default class XetoProvider implements vscode.TextDocumentContentProvider {
	//	the docs are imutable, as they are taken from a GH commit
	//	as such we don't need to invalidate the cache
	//	we only need to populate it as needed
	//	this is done in provideTextDocumentContent
	private _documents = new Map<string, string>();

	async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
		//	we have it cached
		if (this._documents.get(uri.toString())) {
			return this._documents.get(uri.toString());
		}

		//	we need to retrieve it
		const finalUri = vscode.Uri.from({
			...uri,
			scheme: 'https',
		});

		return readUrl(finalUri.toString())
			.then(content => {
				this._documents.set(uri.toString(), content);
				return content;
			});
	}
}