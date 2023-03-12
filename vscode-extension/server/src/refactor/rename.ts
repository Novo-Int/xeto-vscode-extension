import { RenameParams, TextEdit } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { ProtoCompiler } from "../compiler/Compiler";
import { Proto } from "../compiler/Proto";
import { findRefsToProto } from "../FindProto";

export const renameInDoc = (
  params: RenameParams,
  proto: Proto,
  doc: TextDocument,
  compiler: ProtoCompiler
): TextEdit[] => {
  const edits: TextEdit[] = [];

  const refs =
    (compiler.root && findRefsToProto(proto.name, compiler.root)) || [];

  if (refs) {
    const text = doc.getText();

    //	add the TextEdits
    for (const ref of refs) {
      const startOfReplace = text.indexOf(proto.name, ref.loc.charIndex);

      const edit = {
        range: {
          start: doc.positionAt(startOfReplace),
          end: doc.positionAt(startOfReplace + proto.name.length),
        },
        newText: params.newName,
      };

      edits.push(edit);
    }
  }

  return edits;
};
