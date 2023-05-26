import {
  type CompletionItem,
  CompletionItemKind,
  type CompletionParams,
  type Connection,
  type TextDocuments,
} from "vscode-languageserver";

import { getIdentifierForPosition } from "./utils";

import { findChildrenOf } from "../FindProto";
import { type LibraryManager } from "../libraries";
import { type ProtoCompiler } from "../compiler/Compiler";
import { type TextDocument } from "vscode-languageserver-textdocument";
import { Token } from "../compiler/Token";

export const addAutoCompletion = (
  connection: Connection,
  libManager: LibraryManager,
  compiledDocs: Record<string, ProtoCompiler>,
  docs: TextDocuments<TextDocument>
): void => {
  function handleAutoCompletion(params: CompletionParams): CompletionItem[] {
    // let try to find the identifier for this position
    const compiledDocument = compiledDocs[params.textDocument.uri];
    const doc = docs.get(params.textDocument.uri);

    if (!compiledDocument || doc == null) {
      return [];
    }

    const partialIdentifier = getIdentifierForPosition(doc, params.position);

    if (!partialIdentifier) {
      return [];
    }

    let options =
      (compiledDocument.root != null &&
        findChildrenOf(partialIdentifier, compiledDocument.root)) ||
      [];

    //	maybe the identifier is from a lib
    if (
      options.length === 0 &&
      partialIdentifier.includes(Token.DOUBLE_COLON.toString())
    ) {
      const parts = partialIdentifier.split(Token.DOUBLE_COLON.toString());
      const libName = parts[0];
      const lib = libManager.getLib(libName);

      if (lib) {
        const identifierWithoutLib = parts[1];

        //  we don't allow drill down after the lib type
        if (identifierWithoutLib === "") {
          options = findChildrenOf(identifierWithoutLib, lib.rootProto);
        }
      }
    }

    return options.map((op) => ({
      label: op.label,
      kind: CompletionItemKind.Field,
      detail: op.parent,
      documentation: op.doc,
    }));
  }
  connection.onCompletion(handleAutoCompletion);

  // This handler resolves additional information for the item selected in
  // the completion list.
  connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    return item;
  });
};
