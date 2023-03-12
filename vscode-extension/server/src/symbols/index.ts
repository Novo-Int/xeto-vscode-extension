import { DocumentSymbol, SymbolKind } from "vscode-languageserver";
import { Proto } from "../compiler/Proto";

const getSymbolType = (p: Proto): SymbolKind => {
  if (p.type === "sys.Marker" || p.type === "Marker") {
    return SymbolKind.Constant;
  }

  return SymbolKind.Namespace;
};

const generateSymbols = (root: Proto): DocumentSymbol[] => {
  const ret: DocumentSymbol[] = [];

  const symbols = root.children;

  Object.keys(symbols).forEach((symbolName) => {
    const loc = symbols[symbolName].loc;

    ret.push({
      name: symbolName,
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
    });
  });

  return ret;
};

export { generateSymbols };
