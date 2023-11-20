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

const dataInstanceIdentifierChar = /[a-zA-Z0-9_~-]/;
const dataInstanceStartChar = "@";

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

  //  take care of instance data
  if (text.charAt(position) === "@") {
    identifier = "@" + identifier;
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

  //  maybe a data instance
  const oldLength = length;

  while (
    position >= -1 &&
    text.charAt(position).match(dataInstanceIdentifierChar) != null
  ) {
    position--;
    length++;
  }

  if (text.charAt(position) !== dataInstanceStartChar) {
    length = oldLength;
  } else {
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

  const initialPos = position;

  identifier = identifier.trim().replace(/[\n\t]/g, "");

  position = doc.offsetAt(pos) + 1;
  while (
    position < text.length &&
    text.charAt(position).match(identifierSegmentCharRegexp) != null
  ) {
    identifier += text.charAt(position);
    position++;
  }

  //  maybe this is a data instance
  //  let's try to go
  const rightMostPosition = position;
  position = initialPos;
  let dataId = identifier;

  while (
    position >= -1 &&
    text.charAt(position).match(dataInstanceIdentifierChar) != null
  ) {
    dataId = text.charAt(position) + dataId;
    position--;
  }

  if (text.charAt(position) === dataInstanceStartChar) {
    identifier = "@" + dataId;

    //  if this is a data instance then we may need to
    //  scan to the right also
    position = rightMostPosition;

    while (
      position < text.length &&
      text.charAt(position).match(dataInstanceIdentifierChar) != null
    ) {
      identifier += text.charAt(position);
      position++;
    }
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
