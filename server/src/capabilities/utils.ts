import {
  type TextDocument,
  type Position,
} from "vscode-languageserver-textdocument";
import { findProtoByQname } from "../FindProto";
import { type Proto } from "../compiler/Proto";
import { type ProtoCompiler } from "../compiler/Compiler";
import { type TextDocuments } from "vscode-languageserver";
import { type LibraryManager, type XetoLib } from "../libraries";

const identifierCharRegexp = /[a-zA-Z0-9_. :\t]/;
const identifierSegmentCharRegexp = /[a-zA-Z0-9_]/;

export function getIdentifierForPosition(
  doc: TextDocument,
  pos: Position
): string {
  let position = doc.offsetAt(pos) - 1;
  const text = doc.getText();

  // this is naive, but we go backwards until we reach a :
  let identifier = "";

  while (
    position >= -1 &&
    text.charAt(position).match(identifierCharRegexp) != null
  ) {
    //  need to take special care about ::
    if (text.charAt(position) === ":") {
      if (text.charAt(position - 1) !== ":") {
        break;
      } else {
        identifier = ":" + identifier;
        position--;
      }
    }

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
    text.charAt(position).match(identifierSegmentCharRegexp) != null
  ) {
    position--;
    length++;
  }

  return length;
}

export function getLargestIdentifierForPosition(
  doc: TextDocument,
  pos: Position
): string {
  let position = doc.offsetAt(pos);
  const text = doc.getText();

  // this is naive, but we go backwards until we reach a :
  let identifier = "";

  //  eat up \n
  while (position >= -1 && text.charAt(position) === "\n") {
    position--;
  }

  while (
    position >= -1 &&
    text.charAt(position).match(identifierCharRegexp) != null
  ) {
    //  need to take special care about ::
    if (text.charAt(position) === ":") {
      if (text.charAt(position - 1) !== ":") {
        break;
      } else {
        identifier = ":" + identifier;
        position--;
      }
    }

    identifier = text.charAt(position) + identifier;
    position--;
  }

  identifier = identifier.trim().replace(/[\n\t]/g, "");

  position = doc.offsetAt(pos) + 1;
  while (
    position < text.length &&
    text.charAt(position).match(identifierSegmentCharRegexp) != null
  ) {
    identifier += text.charAt(position);
    position++;
  }

  identifier = identifier.trim().replace(/[\n\t]/g, "");

  return identifier;
}

interface ProtoFromLocInput {
  uri: string;
  pos: Position;
  compiledDocs: Record<string, ProtoCompiler>;
  documents: TextDocuments<TextDocument>;
  uriToLibs: Map<string, XetoLib>;
  libManager: LibraryManager;
}

export function getProtoFromFileLoc(input: ProtoFromLocInput): Proto | null {
  // let try to find the identifier for this position
  const compiledDocument = input.compiledDocs[input.uri];
  const doc = input.documents.get(input.uri);

  if (!compiledDocument || doc === undefined) {
    return null;
  }

  const identifier = getLargestIdentifierForPosition(doc, input.pos);

  if (!identifier) {
    return null;
  }

  const proto =
    compiledDocument.root &&
    findProtoByQname(identifier, compiledDocument.root);

  if (proto != null) {
    return proto;
  } else {
    // 	search in the files lib first
    const lib = input.uriToLibs.get(compiledDocument.sourceUri);

    if (lib != null) {
      const proto = findProtoByQname(identifier, lib.rootProto);

      if (proto != null) {
        return proto;
      }
    }

    const proto = input.libManager.findProtoByQName(identifier, lib?.deps);

    return proto;
  }
}
