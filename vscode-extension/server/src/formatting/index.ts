import { FormattingOptions } from "vscode-languageserver/node";

import { Position, Range, TextEdit } from "vscode-languageserver";
import { Token } from "../compiler/Token";
import { TokenWithPosition } from "../compiler/Parser";

const generateWhiteSpaces = (
  options: FormattingOptions,
  depth: number
): string => {
  return new Array(depth * options.tabSize)
    .fill(options.insertSpaces ? " " : "\t")
    .join("");
};

export const formatFile = (
  tokenBag: TokenWithPosition[],
  options: FormattingOptions
): TextEdit[] => {
  const ret: TextEdit[] = [];

  let depth = 0;
  let i = 0;

  while (i < tokenBag.length) {
    if (tokenBag[i].token === Token.LBRACE) {
      depth++;
    }

    if (tokenBag[i].token === Token.RBRACE) {
      depth--;
    }

    if (tokenBag[i].token === Token.NL && tokenBag[i + 1]?.token === Token.NL) {
      //	dedup multiple lines in proto def
      if (depth !== 0) {
        ret.push(
          TextEdit.del(
            Range.create(
              tokenBag[i].line,
              tokenBag[i].col,
              tokenBag[i + 1].line,
              tokenBag[i + 1].col
            )
          )
        );
      }
    }

    //	dedup multiple lines at 0 level
    if (
      depth === 0 &&
      tokenBag[i].token === Token.NL &&
      tokenBag[i + 1]?.token === Token.NL &&
      tokenBag[i + 2]?.token === Token.NL
    ) {
      ret.push(
        TextEdit.del(
          Range.create(
            tokenBag[i + 1].line,
            tokenBag[i + 1].col,
            tokenBag[i + 2].line,
            tokenBag[i + 2].col
          )
        )
      );
    }

    //	insert multiple NL between protos at depth 0
    if (
      depth === 0 &&
      tokenBag[i].token === Token.RBRACE &&
      tokenBag[i + 1]?.token === Token.NL &&
      tokenBag[i + 2]?.token !== Token.NL
    ) {
      ret.push(
        TextEdit.insert(
          Position.create(tokenBag[i + 1].line, tokenBag[i + 1].col),
          "\n"
        )
      );
    }

    //	insert NL after proto open
    if (
      tokenBag[i].token === Token.LBRACE &&
      tokenBag[i + 1].token !== Token.NL
    ) {
      ret.push(
        TextEdit.insert(
          Position.create(tokenBag[i].line, tokenBag[i].col),
          "\n"
        )
      );
    }

    //	insert NL after proto end
    if (
      tokenBag[i].token === Token.RBRACE &&
      tokenBag[i - 1].token !== Token.NL
    ) {
      ret.push(
        TextEdit.insert(
          Position.create(tokenBag[i].line, tokenBag[i].col - 1),
          "\n" + generateWhiteSpaces(options, depth)
        )
      );
    }

	//	insert one space between : and whatever is next (bracket, inherited proto)
    if (tokenBag[i].token === Token.COLON && tokenBag[i + 1]) {
      if (tokenBag[i].line === tokenBag[i + 1].line) {
        if (tokenBag[i + 1].col > tokenBag[i].col + 2) {
          ret.push(
            TextEdit.replace(
              Range.create(
                tokenBag[i].line,
                tokenBag[i].col,
                tokenBag[i + 1].line,
                tokenBag[i + 1].col - 1
              ),
              " "
            )
          );
        }

        if (tokenBag[i + 1].col === tokenBag[i].col + 1) {
          ret.push(
            TextEdit.insert(
              Position.create(tokenBag[i].line, tokenBag[i].col),
              " "
            )
          );
        }
      }
    }

    console.log(tokenBag[i]);
    i++;
  }

  return ret;
};
