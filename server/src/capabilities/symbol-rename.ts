import {
  type Connection,
  type RenameParams,
  type TextDocuments,
  type TextEdit,
  type WorkspaceEdit,
} from "vscode-languageserver";
import { type ProtoCompiler } from "../compiler/Compiler";
import { renameInDoc } from "../refactor";
import { type TextDocument } from "vscode-languageserver-textdocument";
import { findProtoByQname } from "../FindProto";
import { type XetoLib } from "../libraries";
import { getIdentifierLength } from "./utils";
import { type Proto } from "../compiler/Proto";

export const addRenameSymbol = (
  connection: Connection,
  compiledDocs: Record<string, ProtoCompiler>,
  docs: TextDocuments<TextDocument>,
  compilersToLibs: Map<ProtoCompiler, XetoLib>
): void => {
  function onSymbolRename(params: RenameParams): WorkspaceEdit | null {
    const uri = params.textDocument.uri;

    const compiler = compiledDocs[uri];
    const doc = docs.get(params.textDocument.uri);

    if (!compiler || doc == null) {
      return null;
    }

    //  we need this because the selection for renaming may be in the middle of the identifier
    const startCharacter =
      params.position.character - getIdentifierLength(doc, params.position) + 1;

    const protoName = compiler.getQNameByLocation({
      line: params.position.line,
      character: startCharacter,
    });

    //  trying to rename a symbol that's not defined in this compilation unit
    if (protoName === "") {
      return null;
    }

    const proto: Proto | null = compiler.root
      ? findProtoByQname(protoName, compiler.root)
      : null;

    if (proto == null) {
      return null;
    }

    //  bail out if replacing with the same string
    if (proto.name === params.newName) {
      return null;
    }

    const workspaceEdit: {
      changes: Record<string, TextEdit[]>;
    } = {
      changes: {},
    };

    workspaceEdit.changes[uri] = [
      {
        range: {
          start: {
            character: startCharacter - 1,
            line: params.position.line,
          },
          end: {
            character: startCharacter - 1 + proto.name.length,
            line: params.position.line,
          },
        },
        newText: params.newName,
      },
      ...renameInDoc(params, protoName, doc, compiler),
    ];

    //  refactor in entire workspace
    Object.keys(compiledDocs).forEach((docUri) => {
      //	skip current doc
      if (docUri === uri) {
        return;
      }

      //  we also want to skip if files are in different libs
      if (
        compilersToLibs.get(compiledDocs[docUri]) !==
        compilersToLibs.get(compiler)
      ) {
        return;
      }

      const doc = docs.get(docUri);

      if (doc == null) {
        return;
      }

      const edits = renameInDoc(params, protoName, doc, compiledDocs[docUri]);

      if (edits.length > 0) {
        workspaceEdit.changes[docUri] = edits;
      }
    });

    //  if proto is part of a lib then we need to add the lib name to it also
    const lib = compilersToLibs.get(compiler);
    if (lib != null) {
      //  refactor in entire workspace
      Object.keys(compiledDocs).forEach((docUri) => {
        //	skip current doc
        if (docUri === uri) {
          return;
        }

        const doc = docs.get(docUri);

        if (doc == null) {
          return;
        }

        const edits = renameInDoc(
          params,
          lib.name + "." + protoName,
          doc,
          compiledDocs[docUri]
        );

        if (edits.length > 0) {
          workspaceEdit.changes[docUri] = edits;
        }
      });
    }

    return workspaceEdit;
  }

  connection.onRenameRequest(onSymbolRename);
};
