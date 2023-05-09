import {
  CompletionItem,
  CompletionItemKind,
  CompletionParams,
  Connection,
  TextDocument,
  TextDocuments,
} from "vscode-languageserver";

import { getIdentifierForPosition } from "./utils";

import { findChildrenOf } from "../FindProto";
import { LibraryManager } from "../libraries";
import { ProtoCompiler } from "../compiler/Compiler";

export const addAutoCompletion = (
  connection: Connection,
  libManager: LibraryManager,
  compiledDocs: Record<string, ProtoCompiler>,
  docs: TextDocuments<TextDocument>
) => {
  function handleAutoCompletion(params: CompletionParams): CompletionItem[] {
    // let try to find the identifier for this position
    const compiledDocument = compiledDocs[params.textDocument.uri];
    const doc = docs.get(params.textDocument.uri);

    if (!compiledDocument || !doc) {
      return [];
    }

    const partialIdentifier = getIdentifierForPosition(doc, params.position);

    if (!partialIdentifier) {
      return [];
    }

    let options =
      (compiledDocument.root &&
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

        if (lib) {
          //	get compilers for files that have this lib
          const identifierWithoutLib = parts.slice(currentSize).join(".");

          options = findChildrenOf(identifierWithoutLib, lib.rootProto);
          if (options.length) {
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
