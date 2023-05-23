import {
  type Connection,
  type DocumentFormattingParams,
  type TextDocuments,
} from "vscode-languageserver";
import {
  type TextDocument,
  type TextEdit,
} from "vscode-languageserver-textdocument";
import { formatFile } from "../formatting";
import { type ProtoCompiler } from "../compiler/Compiler";

export const addFormatting = (
  connection: Connection,
  documents: TextDocuments<TextDocument>,
  docsToCompilerResults: Record<string, ProtoCompiler>
): void => {
  function onDocumentFormatting(params: DocumentFormattingParams): TextEdit[] {
    const uri = params.textDocument.uri;

    const compiler = docsToCompilerResults[uri];

    if (!compiler) {
      return [];
    }

    const tokenBag = compiler.tokenBag;

    if (!tokenBag || tokenBag.length === 0) {
      return [];
    }

    const doc = documents.get(uri);

    if (doc == null) {
      return [];
    }

    return formatFile(doc, tokenBag, params.options);
  }

  connection.onDocumentFormatting(onDocumentFormatting);
};
