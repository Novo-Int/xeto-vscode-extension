import {
  MarkupKind,
  type Connection,
  type Hover,
  type HoverParams,
  type TextDocuments,
} from "vscode-languageserver";
import { getProtoFromFileLoc } from "./utils";
import { type ProtoCompiler } from "../compiler/Compiler";
import { type TextDocument } from "vscode-languageserver-textdocument";
import { type LibraryManager, type XetoLib } from "../libraries";

export const addHover = (
  connection: Connection,
  compiledDocs: Record<string, ProtoCompiler>,
  documents: TextDocuments<TextDocument>,
  uriToLibs: Map<string, XetoLib>,
  libManager: LibraryManager
): void => {
  function handleHover(params: HoverParams): Hover | null {
    const proto = getProtoFromFileLoc({
      uri: params.textDocument.uri,
      pos: params.position,
      compiledDocs,
      documents,
      uriToLibs,
      libManager,
    });

    if (proto == null) {
      return null;
    }

    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: proto.doc ?? "",
      },
    };
  }

  connection.onHover(handleHover);
};
