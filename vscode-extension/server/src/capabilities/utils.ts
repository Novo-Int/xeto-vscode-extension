import { TextDocument, Position } from "vscode-languageserver-textdocument";

const identifierCharRegexp = /[a-zA-Z0-9_. \t]/;
const identifierSegmentCharRegexp = /[a-zA-Z0-9_]/;

export function getIdentifierForPosition(
  doc: TextDocument,
  pos: Position
): string {
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

export function getIdentifierLength(doc: TextDocument, pos: Position): number {
  let position = doc.offsetAt(pos) - 1;
  let length = 0;
  const text = doc.getText();

  while (
    position >= -1 &&
    text.charAt(position).match(identifierSegmentCharRegexp)
  ) {
    position--;
    length++;
  }

  return length;
}

export function getLargestIdentifierForPosition(
  doc: TextDocument,
  pos: Position
): string[] {
  let position = doc.offsetAt(pos);
  const text = doc.getText();

  // this is naive, but we go backwards until we reach a :
  let identifier = "";

  //  eat up \n
  while (position >= -1 && text.charAt(position) === "\n") {
    position--;
  }

  while (position >= -1 && text.charAt(position).match(identifierCharRegexp)) {
    identifier = text.charAt(position) + identifier;
    position--;
  }

  identifier = identifier.trim().replace(/[\n\t]/g, "");

  position = doc.offsetAt(pos) + 1;
  while (
    position < text.length &&
    text.charAt(position).match(identifierSegmentCharRegexp)
  ) {
    identifier += text.charAt(position);
    position++;
  }

  identifier = identifier.trim().replace(/[\n\t]/g, "");

  return identifier.split(".");
}
