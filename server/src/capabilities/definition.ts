import {
  type Connection,
  type Definition,
  type DefinitionParams,
  type TextDocuments,
} from "vscode-languageserver";
import { getProtoFromFileLoc } from "./utils";
import { type ProtoCompiler } from "../compiler/Compiler";
import { type TextDocument } from "vscode-languageserver-textdocument";
import { type LibraryManager, type XetoLib } from "../libraries";

export const addDefinition = (
  connection: Connection,
  compiledDocs: Record<string, ProtoCompiler>,
  documents: TextDocuments<TextDocument>,
  uriToLibs: Map<string, XetoLib>,
  libManager: LibraryManager
): void => {
  function handleDefinition(params: DefinitionParams): Definition | null {
    const proto = getProtoFromFileLoc({
      uri: params.textDocument.uri,
      pos: params.position,
      compiledDocs,
      documents,
      uriToLibs,
      libManager,
    });

    if (proto == null || !proto.loc) {
      return null;
    }

    return {
      uri: proto.loc.file.match(/^file:\/\/\/?[a-zA-Z]:\//)
        ? proto.loc.file.replace("file:/", "")
        : proto.loc.file,
      range: {
        start: {
          line: proto.loc.line,
          character: proto.loc.col,
        },
        end: {
          line: proto.loc.line,
          character: proto.loc.col + 1,
        },
      },
    };
  }

  connection.onDefinition(handleDefinition);
};
