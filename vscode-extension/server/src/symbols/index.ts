import { DocumentSymbol, SymbolKind } from "vscode-languageserver";
import { Proto } from "../compiler/Proto";

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
    p.type === "sys.Bool"
  ) {
    return SymbolKind.Boolean;
  }

  if (
    p.name === "Str" ||
    p.refType?.name === "Str" ||
    p.type === "Str" ||
    p.type === "sys.Str"
  ) {
    return SymbolKind.String;
  }

  if (
    p.name === "Number" ||
    p.refType?.name === "Number" ||
    p.type === "Number" ||
    p.type === "sys.Number"
  ) {
    return SymbolKind.Number;
  }

  if (Object.keys(p.children).length === 0) {
    return SymbolKind.Property;
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
