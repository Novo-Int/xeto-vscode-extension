import {
  type CompletionItem,
  CompletionItemKind,
  type CompletionParams,
  type Connection,
  type TextDocuments,
} from "vscode-languageserver";

import { getIdentifierForPosition } from "./utils";

import { findChildrenOf, findDataInstances } from "../FindProto";
import { type XetoLib, type LibraryManager } from "../libraries";
import { type ProtoCompiler } from "../compiler/Compiler";
import { type TextDocument } from "vscode-languageserver-textdocument";
import { Token } from "../compiler/Token";

export const addAutoCompletion = (
  connection: Connection,
  libManager: LibraryManager,
  compiledDocs: Record<string, ProtoCompiler>,
  docs: TextDocuments<TextDocument>,
  uriToLib: Map<string, XetoLib>
): void => {
  function handleAutoCompletion(params: CompletionParams): CompletionItem[] {
    // let try to find the identifier for this position
    const compiledDocument = compiledDocs[params.textDocument.uri];
    const doc = docs.get(params.textDocument.uri);

    if (!compiledDocument || doc == null) {
      return [];
    }

    //  maybe is trigger by @ - data instance
    if (params.context?.triggerCharacter === "@") {
      const dataInstaces =
        compiledDocument.root && findDataInstances(compiledDocument.root);

      const suggestions: CompletionItem[] = [];

      // it may also want to refer to a lib
      const lib = uriToLib.get(params.textDocument.uri);

      if (lib) {
        suggestions.push(
          ...lib.deps.map((dep) => ({
            label: dep,
            kind: CompletionItemKind.Folder,
            detail: "",
            documentation: "",
          }))
        );
      }

      if (dataInstaces) {
        suggestions.push(
          ...dataInstaces.map((op) => ({
            label: op.label.substring(1),
            kind: CompletionItemKind.Field,
            detail: op.parent,
            documentation: op.doc,
          }))
        );
      }

      if (suggestions.length) {
        return suggestions;
      }
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
      const isDataInstance = parts[0].startsWith("@");
      const libName = isDataInstance ? parts[0].slice(1) : parts[0];
      const lib = libManager.getLib(libName);

      if (lib) {
        const identifierWithoutLib = isDataInstance ? "@" + parts[1] : parts[1];

        //  we don't allow drill down after the lib type
        if (identifierWithoutLib === "") {
          options = findChildrenOf(identifierWithoutLib, lib.rootProto);
        }

        if (identifierWithoutLib === "@") {
          options = findDataInstances(lib.rootProto).map((o) => ({
            ...o,
            label: o.label.slice(1),
          }));
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
