import { DocumentSymbol, SymbolKind } from "vscode-languageserver";
import { Proto } from "../compiler/Proto";

const isProtoArray = (p: Proto): boolean => {
  try {
    return Object.keys(p.children)
      .map((key) => parseInt(key.substring(1)))
      .every((k) => isNaN(k) === false);
  } catch {
    return false;
  }
};

const getSymbolType = (p: Proto): SymbolKind => {
  if (p.name === "of" || p.name === "is") {
    return SymbolKind.Operator;
  }

  if (
    p.type === "sys.Marker" ||
    p.type === "Marker" ||
    p.refType?.type === "sys.Maker" ||
    p.refType?.type === "Marker"
  ) {
    return SymbolKind.Constant;
  }

  if (
    p.name === "Bool" ||
    p.refType?.name === "Bool" ||
    p.type === "Bool" ||
    p.type === "sys.Bool" ||
    (p.type === "sys.Maybe" &&
      p.children["_of"] &&
      p.children["_of"].type === "Bool")
  ) {
    return SymbolKind.Boolean;
  }

  if (
    p.name === "Str" ||
    p.refType?.name === "Str" ||
    p.type === "Str" ||
    p.type === "sys.Str" ||
    (p.type === "sys.Maybe" &&
      p.children["_of"] &&
      p.children["_of"].type === "Str")
  ) {
    return SymbolKind.String;
  }

  if (
    p.name === "Number" ||
    p.refType?.name === "Number" ||
    p.type === "Number" ||
    p.type === "sys.Number" ||
    (p.type === "sys.Maybe" &&
      p.children["_of"] &&
      p.children["_of"].type === "Number")
  ) {
    return SymbolKind.Number;
  }

  if (Object.keys(p.children).length === 0) {
    return SymbolKind.Property;
  }

  //  maybe it's an array
  if (isProtoArray(p)) {
    return SymbolKind.Array;
  }

  return SymbolKind.Namespace;
};

const generateSymbols = (root: Proto): DocumentSymbol[] => {
  const ret: DocumentSymbol[] = [];

  const symbols = root.children;

  Object.keys(symbols).forEach((symbolName) => {
    const loc = symbols[symbolName].loc;

    if (!loc || !loc.line || !loc.col) {
      return;
    }

    const docSymbol: DocumentSymbol = {
      name: symbolName.replace(/_(.*)/, "$1"),
      kind: getSymbolType(symbols[symbolName]),
      range: {
        start: {
          line: loc.line,
          character: loc.col,
        },
        end: {
          line: loc.line,
          character: loc.col + symbols[symbolName].name.length,
        },
      },
      selectionRange: {
        start: {
          line: loc.line,
          character: loc.col,
        },
        end: {
          line: loc.line,
          character: loc.col + symbols[symbolName].name.length,
        },
      },
    };

    if (Object.keys(symbols[symbolName].children).length) {
      docSymbol.children = generateSymbols(symbols[symbolName]);
    }

    ret.push(docSymbol);
  });

  return ret;
};

export { generateSymbols };
