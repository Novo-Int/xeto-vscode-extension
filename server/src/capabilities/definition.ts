import {
  Connection,
  Definition,
  DefinitionParams,
  TextDocuments,
} from "vscode-languageserver";
import { getProtoFromFileLoc } from "./utils";
import { ProtoCompiler } from "../compiler/Compiler";
import { TextDocument } from 'vscode-languageserver-textdocument';
import { LibraryManager, XetoLib } from '../libraries';

export const addDefinition = (
  connection: Connection,
  compiledDocs: Record<string, ProtoCompiler>,
  documents: TextDocuments<TextDocument>,
  compilersToLibs: Map<ProtoCompiler, XetoLib>,
  libManager: LibraryManager
) => {
  function handleDefinition(params: DefinitionParams): Definition | null {
    const proto = getProtoFromFileLoc({
      uri: params.textDocument.uri,
      pos: params.position,
      compiledDocs,
      documents,
      compilersToLibs,
      libManager,
    });

    if (!proto || !proto.loc) {
      return null;
    }

    return {
      uri: proto.loc.file,
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
