import {
  type Connection,
  type DocumentSymbol,
  type DocumentSymbolParams,
  type SymbolInformation,
  type WorkspaceSymbolParams,
} from "vscode-languageserver";
import { generateSymbols } from "../symbols";
import { type ProtoCompiler } from "../compiler/Compiler";

export const addSymbols = (
  connection: Connection,
  compiledDocs: Record<string, ProtoCompiler>
): void => {
  function onDocumentSymbols(params: DocumentSymbolParams): DocumentSymbol[] {
    const uri = params.textDocument.uri;

    if (!uri) {
      return [];
    }
    const compiler = compiledDocs[uri];

    if (!compiler) {
      return [];
    }

    const root = compiler.root;

    if (root == null) {
      return [];
    }

    return generateSymbols(root);
  }

  connection.onDocumentSymbol(onDocumentSymbols);

  function onWorkspaceSymbols(
    params: WorkspaceSymbolParams
  ): SymbolInformation[] {
    const toRet: SymbolInformation[] = [];

    for (const uri in compiledDocs) {
      const root = compiledDocs[uri].root;

      if (root == null) {
        continue;
      }

      const symbols = generateSymbols(root).map((symbol) => ({
        ...symbol,
        location: {
          uri,
          range: symbol.range,
        },
      }));

      toRet.push(...symbols);
    }

    return toRet;
  }

  connection.onWorkspaceSymbol(onWorkspaceSymbols);
};
