import { Connection, DocumentFormattingParams, TextDocuments } from "vscode-languageserver";
import { TextDocument, TextEdit } from "vscode-languageserver-textdocument";
import { formatFile } from "../formatting";
import { ProtoCompiler } from '../compiler/Compiler';

export const addFormatting = (
  connection: Connection,
  documents: TextDocuments<TextDocument>,
  docsToCompilerResults: Record<string, ProtoCompiler>
) => {
  function onDocumentFormatting(params: DocumentFormattingParams): TextEdit[] {
    const uri = params.textDocument.uri;

    const compiler = docsToCompilerResults[uri];

    if (!compiler) {
      return [];
    }

    const tokenBag = compiler.tokenBag;

    if (!tokenBag || !tokenBag.length) {
      return [];
    }

    const doc = documents.get(uri);

    if (!doc) {
      return [];
    }

    return formatFile(doc, tokenBag, params.options);
  }

  connection.onDocumentFormatting(onDocumentFormatting);
};
