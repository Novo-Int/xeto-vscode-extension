import { type RenameParams, type TextEdit } from "vscode-languageserver";
import { type TextDocument } from "vscode-languageserver-textdocument";
import { type ProtoCompiler } from "../compiler/Compiler";
import { findRefsToProto } from "../FindProto";

export const renameInDoc = (
  params: RenameParams,
  oldQName: string,
  doc: TextDocument,
  compiler: ProtoCompiler
): TextEdit[] => {
  const edits: TextEdit[] = [];

  const refs =
    (compiler.root != null && findRefsToProto(oldQName, compiler.root)) || [];

  if (refs) {
    const text = doc.getText();
    const parts = oldQName.split(".");
    parts.pop();
    parts.push(params.newName);

    const newText = parts.join(".");

    //	add the TextEdits
    for (const ref of refs) {
      if (!ref.loc) {
        continue;
      }

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

  //  consolidate overlapping ranges
  return edits.reduce<TextEdit[]>((acc, current) => {
    if (
      acc.find(
        (c) =>
          c.range.start.character === current.range.start.character &&
          c.range.start.line === current.range.start.line
      ) != null
    ) {
      return acc;
    }

    acc.push(current);
    return acc;
  }, []);
};
