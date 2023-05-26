import { type Proto } from "../compiler/Proto";
import { Token } from "../compiler/Token";
import { findProtoByQname } from "../FindProto";
import { type LibraryManager } from "../libraries";

interface Pos {
  line: number;
  col: number;
  length: number;
}

enum SemanticType {
  MARKER,
  REFERENCE,
}

interface SemanticToken {
  proto: Proto;
  type: SemanticType;
}

const extractSemanticProtos = (
  root: Proto,
  libManager?: LibraryManager
): SemanticToken[] => {
  const bag: SemanticToken[] = [];

  extractSemanticProtosRecursive(root, root, bag, libManager);

  return bag;
};

const isLibRef = (proto: Proto): boolean => {
  if (proto.initialType !== "sys.Ref") {
    return false;
  }

  return proto.type.includes(Token.DOUBLE_COLON.toString());
};

const isMarker = (
  root: Proto,
  proto: Proto,
  libManager?: LibraryManager
): boolean => {
  if (!proto.type) {
    return false;
  }

  if (proto.children["#isMeta"]) {
    return false;
  }

  if (
    proto.type === "Marker" ||
    proto.type === "sys.Marker" ||
    proto.refType?.type === "Marker" ||
    proto.refType?.type === "sys.Marker"
  ) {
    return true;
  }

  //	TO DO - we should be able to replace all this logic and use proto.refType
  //	to check if this points to a Marker or not

  //	maybe we have a type so we should resolve that
  const alias = findProtoByQname(proto.type, root);

  if (alias != null) {
    if (alias.type === "Marker" || alias.type === "sys.Marker") {
      return true;
    }

    return false;
  }

  if (libManager == null) {
    return false;
  }

  //	check in the libs
  const libAlias = libManager.findProtoByQName(proto.type);

  if (libAlias != null) {
    if (libAlias.type === "Marker" || libAlias.type === "sys.Marker") {
      return true;
    }

    return false;
  }

  return false;
};

const extractSemanticProtosRecursive = (
  root: Proto,
  proto: Proto,
  bag: SemanticToken[],
  libManager?: LibraryManager
): void => {
  if (isMarker(root, proto, libManager)) {
    bag.push({
      proto,
      type: SemanticType.MARKER,
    });
    return;
  }

  if (isLibRef(proto)) {
    bag.push({
      proto,
      type: SemanticType.REFERENCE,
    });
    return;
  }

  Object.values(proto.children).forEach((proto) => {
    extractSemanticProtosRecursive(root, proto, bag, libManager);
  });
};

const extractPosFromProto = (proto: Proto): Pos => {
  return {
    line: proto.loc.line,
    col: proto.loc.col - 1,
    length: proto.name.length,
  };
};

const extractPosFromToken = (token: SemanticToken): Pos => {
  switch (token.type) {
    case SemanticType.MARKER:
      return extractPosFromProto(token.proto);
    case SemanticType.REFERENCE: {
      const parts = token.proto.type.split(Token.DOUBLE_COLON.toString());

      return {
        line: token.proto.qnameLoc?.line ?? token.proto.loc.line,
        col: token.proto.qnameLoc?.col ?? token.proto.loc.col,
        length: parts[0].length,
      };
    }
  }
};

const semanticTokenToLegendIndex = (type: SemanticType): number => {
  return type === SemanticType.MARKER ? 0 : 1;
};

const convertProtosToSemanticTokens = (protos: SemanticToken[]): number[] => {
  //	sort them based on the position on the doc
  const sortedProtos = protos
    .filter((p) => p.proto.loc)
    .sort((a, b) => a.proto.loc.charIndex - b.proto.loc.charIndex);

  if (sortedProtos.length === 0) {
    return [];
  }

  //	created the return array based
  let prevPos = extractPosFromToken(sortedProtos[0]);

  const ret: number[] = [
    prevPos.line,
    prevPos.col,
    prevPos.length,
    semanticTokenToLegendIndex(sortedProtos[0].type),
    0,
  ];

  for (let i = 1; i < sortedProtos.length; i++) {
    //	compute the difference
    const currentPos = extractPosFromToken(sortedProtos[i]);

    if (currentPos.line === prevPos.line) {
      ret.push(0, currentPos.col - prevPos.col, currentPos.length, 0, 0);
    } else {
      ret.push(
        currentPos.line - prevPos.line,
        currentPos.col,
        currentPos.length,
        semanticTokenToLegendIndex(sortedProtos[i].type),
        0
      );
    }

    prevPos = currentPos;
  }

  return ret;
};

export { extractSemanticProtos, convertProtosToSemanticTokens };
