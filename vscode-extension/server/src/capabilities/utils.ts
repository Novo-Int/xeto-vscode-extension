import { TextDocument, Position } from "vscode-languageserver-textdocument";

const identifierCharRegexp = /[a-zA-Z0-9_. \t]/;

export function getIdentifierForPosition(doc: TextDocument, pos: Position): string {
  let position = doc.offsetAt(pos) - 1;
  const text = doc.getText();

  // this is naive, but we go backwards until we reach a :
  let identifier = "";

  while (position >= -1 && text.charAt(position).match(identifierCharRegexp)) {
    identifier = text.charAt(position) + identifier;
    position--;
  }

  if (position === -1) {
    return "";
  }

  identifier = identifier.trim().replace(/[\n\t]/g, "");

  return identifier;
}
