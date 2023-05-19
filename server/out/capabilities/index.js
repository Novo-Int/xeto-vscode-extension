"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addHover = exports.addDefinition = exports.addSemanticTokens = exports.addSymbols = exports.addFormatting = exports.addRenameSymbol = exports.addAutoCompletion = void 0;
const autocompletion_1 = require("./autocompletion");
Object.defineProperty(exports, "addAutoCompletion", { enumerable: true, get: function () { return autocompletion_1.addAutoCompletion; } });
const symbol_rename_1 = require("./symbol-rename");
Object.defineProperty(exports, "addRenameSymbol", { enumerable: true, get: function () { return symbol_rename_1.addRenameSymbol; } });
const formatting_1 = require("./formatting");
Object.defineProperty(exports, "addFormatting", { enumerable: true, get: function () { return formatting_1.addFormatting; } });
const symbols_1 = require("./symbols");
Object.defineProperty(exports, "addSymbols", { enumerable: true, get: function () { return symbols_1.addSymbols; } });
const semantic_tokens_1 = require("./semantic-tokens");
Object.defineProperty(exports, "addSemanticTokens", { enumerable: true, get: function () { return semantic_tokens_1.addSemanticTokens; } });
const definition_1 = require("./definition");
Object.defineProperty(exports, "addDefinition", { enumerable: true, get: function () { return definition_1.addDefinition; } });
const hover_1 = require("./hover");
Object.defineProperty(exports, "addHover", { enumerable: true, get: function () { return hover_1.addHover; } });
//# sourceMappingURL=index.js.map