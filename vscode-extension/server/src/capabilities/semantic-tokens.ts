import {
  Connection,
  SemanticTokens,
  SemanticTokensParams,
} from "vscode-languageserver";
import {
  convertProtosToSemanticTokens,
  extractSemanticProtos,
} from "../semantic-tokens";
import { LibraryManager } from "../libraries";
import { ProtoCompiler } from "../compiler/Compiler";

export const addSemanticTokens = (
  connection: Connection,
  libManager: LibraryManager,
  compiledDocs: Record<string, ProtoCompiler>
) => {
  function handleSemanticTokens(params: SemanticTokensParams): SemanticTokens {
    const uri = params.textDocument.uri;

    const compiler = compiledDocs[uri];

    if (!compiler || !compiler.root) {
      return {
        data: [],
      };
    }

    const semanticProtos = extractSemanticProtos(compiler.root, libManager);
    const semanticTokens = convertProtosToSemanticTokens(semanticProtos);

    return {
      data: semanticTokens,
    };
  }

  connection.languages.semanticTokens.on(handleSemanticTokens);
};
