/* --------------------------------------------------------------------------------------------
 * Copyright (c) Novo Studio
 * ------------------------------------------------------------------------------------------ */

import * as path from "path";
import {
  languages,
  workspace,
  type ExtensionContext,
  SemanticTokensLegend,
} from "vscode";

import {
  LanguageClient,
  type LanguageClientOptions,
  type ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

import XetoProvider from "./xeto-contentprovider";
import XetoSemanticTokenProvider from "./xeto-semanticprovider";

let client: LanguageClient;

export function activate(context: ExtensionContext): void {
  // The server is implemented in node
  const serverModule = context.asAbsolutePath(
    path.join("server", "out", "server.js")
  );
  // The debug options for the server
  // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
  const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    // Register the server for plain text documents
    documentSelector: [{ scheme: "file", language: "xeto" }],
    synchronize: {
      // Notify the server about file changes to '.clientrc files contained in the workspace
      fileEvents: workspace.createFileSystemWatcher("**/.clientrc"),
    },
  };

  // Create the language client and start the client.
  client = new LanguageClient(
    "xetoServer",
    "Xeto Server",
    serverOptions,
    clientOptions
  );

  // Start the client. This will also launch the server
  client.start();

  workspace.registerTextDocumentContentProvider("xeto", new XetoProvider());

  const legend = (function () {
    const tokenTypesLegend = ["label", "namespace"];

    const tokenModifiersLegend = ["defaultLibrary"];

    return new SemanticTokensLegend(tokenTypesLegend, tokenModifiersLegend);
  })();

  const selector = { language: "xeto", scheme: "file" };
  context.subscriptions.push(
    languages.registerDocumentSemanticTokensProvider(
      selector,
      new XetoSemanticTokenProvider(client),
      legend
    )
  );
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
