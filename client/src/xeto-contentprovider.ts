import * as vscode from "vscode";

import * as https from "node:https";

const readUrl = async (url: string): Promise<string> => {
  const pr = new Promise<string>((resolve, _reject) => {
    https.get(url, (resp) => {
      let data = "";

      resp.on("data", (chunk: string) => {
        data += chunk;
      });

      resp.on("end", () => {
        resolve(data);
      });
    });
  });

  return await pr;
};

export default class XetoProvider
  implements vscode.TextDocumentContentProvider
{
  //	the docs are imutable, as they are taken from a GH commit
  //	as such we don't need to invalidate the cache
  //	we only need to populate it as needed
  //	this is done in provideTextDocumentContent
  private readonly _documents = new Map<string, string>();

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    //	we have it cached
    if (this._documents.get(uri.toString())) {
      return this._documents.get(uri.toString()) ?? "";
    }

    //	we need to retrieve it
    const finalUri = vscode.Uri.from({
      ...uri,
      scheme: "https",
    });

    return await readUrl(finalUri.toString()).then((content) => {
      this._documents.set(uri.toString(), content);
      return content;
    });
  }
}
