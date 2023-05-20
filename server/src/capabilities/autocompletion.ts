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
    if (options.length === 0) {
      let lib = null;
      let currentSize = 1;
      const parts = partialIdentifier.split(".");

      //  libraries can contain dots in their names
      do {
        const libName = parts.slice(0, currentSize);

        lib = libManager.getLib(libName.join("."));

        if (lib != null) {
          //	get compilers for files that have this lib
          const identifierWithoutLib = parts.slice(currentSize).join(".");

          options = findChildrenOf(identifierWithoutLib, lib.rootProto);
          if (options.length > 0) {
            break;
          }
        }

        currentSize++;
      } while (currentSize <= parts.length);
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
