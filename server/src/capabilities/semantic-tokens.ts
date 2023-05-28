import {
  type Connection,
  type SemanticTokens,
  type SemanticTokensParams,
} from "vscode-languageserver";
import {
  convertProtosToSemanticTokens,
  extractSemanticProtos,
} from "../semantic-tokens";
import { type LibraryManager } from "../libraries";
import { type ProtoCompiler } from "../compiler/Compiler";

export const addSemanticTokens = (
  connection: Connection,
  libManager: LibraryManager,
  compiledDocs: Record<string, ProtoCompiler>
): void => {
  function handleSemanticTokens(params: SemanticTokensParams): SemanticTokens {
    const uri = params.textDocument.uri;

    const compiler = compiledDocs[uri];

    if (!compiler || compiler.root == null) {
      return {
        data: [],
      };
    }

    const semanticProtos = extractSemanticProtos(
      compiler.root,
      compiler.input,
      libManager
    );
    const semanticTokens = convertProtosToSemanticTokens(semanticProtos);

    return {
      data: semanticTokens,
    };
  }

  connection.languages.semanticTokens.on(handleSemanticTokens);
};
