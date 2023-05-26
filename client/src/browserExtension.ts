/* ---------------------------------------------------------------------------------------------
 * Copyright (c) Novo Studio
 *-------------------------------------------------------------------------------------------- */

import {
  type ExtensionContext,
  Uri,
  workspace,
  SemanticTokensLegend,
  languages,
} from "vscode";
import { type LanguageClientOptions } from "vscode-languageclient";

import { LanguageClient } from "vscode-languageclient/browser";

import XetoProvider from "./xeto-contentprovider";
import XetoSemanticTokenProvider from "./xeto-semanticprovider";

// this method is called when vs code is activated
export function activate(context: ExtensionContext): void {
  /*
   * all except the code to create the language client in not browser specific
   * and could be shared with a regular (Node) extension
   */
  const documentSelector = [{ language: "xeto" }];

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    documentSelector,
    synchronize: {},
    initializationOptions: {},
  };

  const client = createWorkerLanguageClient(context, clientOptions);

  const disposable = client.start();
  context.subscriptions.push(disposable);

  workspace.registerTextDocumentContentProvider("xeto", new XetoProvider());
  const legend = (function () {
    const tokenTypesLegend = ["label", "namespace"];

    const tokenModifiersLegend = ["defaultLibrary"];

    return new SemanticTokensLegend(tokenTypesLegend, tokenModifiersLegend);
  })();

  const selector = { language: "xeto" };
  context.subscriptions.push(
    languages.registerDocumentSemanticTokensProvider(
      selector,
      new XetoSemanticTokenProvider(client),
      legend
    )
  );

  client
    .onReady()
    .then(() => {
      console.log("XETO started");
      initFS(client);
    })
    .catch(console.log);
}

interface XFSEvent {
  path: string;
}

function initFS(client: LanguageClient): void {
  client.onRequest("xfs/exists", async (e: XFSEvent) => {
    try {
      await workspace.fs.stat(Uri.parse(e.path));
      return true;
    } catch {
      return false;
    }
  });

  client.onRequest("xfs/readDir", async (e: XFSEvent) => {
    try {
      const results = await workspace.fs.readDirectory(Uri.parse(e.path));
      return results;
    } catch {
      return false;
    }
  });

  client.onRequest("xfs/readFile", async (e: XFSEvent) => {
    try {
      const result = await workspace.fs.readFile(Uri.parse(e.path));
      return fileArrayToString(result);
    } catch {
      return false;
    }
  });
}

function fileArrayToString(bufferArray: Uint8Array): string {
  return Array.from(bufferArray)
    .map((item) => String.fromCharCode(item))
    .join("");
}

function createWorkerLanguageClient(
  context: ExtensionContext,
  clientOptions: LanguageClientOptions
): LanguageClient {
  // Create a worker. The worker main file implements the language server.
  const serverMain = Uri.joinPath(
    context.extensionUri,
    "server/dist/browserServerMain.js"
  );
  const worker = new Worker(serverMain.toString(true));

  // create the language server client to communicate with the server running in the worker
  return new LanguageClient(
    "xeto-extension",
    "Xeto Web Extension",
    clientOptions,
    worker
  );
}
