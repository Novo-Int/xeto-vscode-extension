import {
  Connection,
  DocumentSymbol,
  DocumentSymbolParams,
} from "vscode-languageserver";
import { generateSymbols } from "../symbols";
import { ProtoCompiler } from "../compiler/Compiler";

export const addSymbols = (
  connection: Connection,
  compiledDocs: Record<string, ProtoCompiler>
) => {
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

    if (!root) {
      return [];
    }

    return generateSymbols(root);
  }

  connection.onDocumentSymbol(onDocumentSymbols);
};
