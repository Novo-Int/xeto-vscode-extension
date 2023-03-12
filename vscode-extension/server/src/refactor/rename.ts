import { RenameParams, TextEdit } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { ProtoCompiler } from "../compiler/Compiler";
import { Proto } from "../compiler/Proto";
import { findRefsToProto } from "../FindProto";

export const renameInDoc = (
  params: RenameParams,
  oldQName: string,
  doc: TextDocument,
  compiler: ProtoCompiler
): TextEdit[] => {
  const edits: TextEdit[] = [];

  const refs =
    (compiler.root && findRefsToProto(oldQName, compiler.root)) || [];

  if (refs) {
    const text = doc.getText();
    const parts = oldQName.split(".");
    parts.pop();
    parts.push(params.newName);

    const newText = parts.join(".");

    //	add the TextEdits
    for (const ref of refs) {
      const startOfReplace = text.indexOf(oldQName, ref.loc.charIndex);

      const edit = {
        range: {
          start: doc.positionAt(startOfReplace),
          end: doc.positionAt(startOfReplace + oldQName.length),
        },
        newText,
      };

      edits.push(edit);
    }
  }

  return edits;
};
