import { TextDocument, Position } from "vscode-languageserver-textdocument";
import { findProtoByQname } from '../FindProto';
import { Proto } from '../compiler/Proto';
import { ProtoCompiler } from '../compiler/Compiler';
import { TextDocuments } from 'vscode-languageserver';
import { LibraryManager, XetoLib } from '../libraries';

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

type ProtoFromLocInput = {
	uri: string,
	pos: Position,
	compiledDocs: Record<string, ProtoCompiler>,
	documents: TextDocuments<TextDocument>,
	compilersToLibs: Map<ProtoCompiler, XetoLib>
	libManager: LibraryManager
}

export function getProtoFromFileLoc(input: ProtoFromLocInput): Proto | null {
  // let try to find the identifier for this position
  const compiledDocument = input.compiledDocs[input.uri];
  const doc = input.documents.get(input.uri);

  if (!compiledDocument || !doc) {
    return null;
  }

  const identifier = getLargestIdentifierForPosition(doc, input.pos);

  if (!identifier) {
    return null;
  }

  const proto =
    compiledDocument.root &&
    findProtoByQname(identifier.join("."), compiledDocument.root);

  if (proto) {
    return proto;
  } else {
    // 	search in the files lib first
    const lib = input.compilersToLibs.get(compiledDocument);

    if (lib) {
      const proto = findProtoByQname(identifier.join("."), lib.rootProto);

      if (proto) {
        return proto;
      }
    }

    const proto = input.libManager.findProtoByQName(identifier.join("."), lib?.deps);

    return proto;
  }
}
