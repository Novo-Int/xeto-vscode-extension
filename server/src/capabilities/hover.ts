import {
  Connection,
  Hover,
  HoverParams,
  TextDocuments,
} from "vscode-languageserver";
import { getProtoFromFileLoc } from "./utils";
import { ProtoCompiler } from "../compiler/Compiler";
import { TextDocument } from "vscode-languageserver-textdocument";
import { LibraryManager, XetoLib } from "../libraries";

export const addHover = (
  connection: Connection,
  compiledDocs: Record<string, ProtoCompiler>,
  documents: TextDocuments<TextDocument>,
  compilersToLibs: Map<ProtoCompiler, XetoLib>,
  libManager: LibraryManager
) => {
  function handleHover(params: HoverParams): Hover | null {
    const proto = getProtoFromFileLoc({
      uri: params.textDocument.uri,
      pos: params.position,
      compiledDocs,
      documents,
      compilersToLibs,
      libManager,
    });

    if (!proto) {
      return null;
    }

    return {
      contents: proto.doc || "",
    };
  }

  connection.onHover(handleHover);
};
