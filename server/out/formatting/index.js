"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatFile = void 0;
const vscode_languageserver_1 = require("vscode-languageserver");
const Token_1 = require("../compiler/Token");
const generateWhiteSpaces = (options, depth) => {
    return new Array(options.insertSpaces ? depth * options.tabSize : depth)
        .fill(options.insertSpaces ? " " : "\t")
        .join("");
};
exports.formatFile = (doc, tokenBag, options) => {
    const ret = [];
    let depth = 0;
    let i = 0;
    const inputText = doc.getText();
    while (i < tokenBag.length) {
        if (tokenBag[i].token === Token_1.Token.LBRACE) {
            depth++;
        }
        if (tokenBag[i].token === Token_1.Token.RBRACE) {
            depth--;
        }
        if (tokenBag[i].token === Token_1.Token.NL && tokenBag[i + 1]?.token === Token_1.Token.NL) {
            //	dedup multiple lines in proto def
            if (depth !== 0) {
                ret.push(vscode_languageserver_1.TextEdit.del(vscode_languageserver_1.Range.create(tokenBag[i].line, tokenBag[i].col, tokenBag[i + 1].line, tokenBag[i + 1].col)));
            }
        }
        //	dedup multiple lines at 0 level
        if (depth === 0 &&
            tokenBag[i].token === Token_1.Token.NL &&
            tokenBag[i + 1]?.token === Token_1.Token.NL &&
            tokenBag[i + 2]?.token === Token_1.Token.NL) {
            ret.push(vscode_languageserver_1.TextEdit.del(vscode_languageserver_1.Range.create(tokenBag[i + 1].line, tokenBag[i + 1].col, tokenBag[i + 2].line, tokenBag[i + 2].col)));
        }
        //	insert multiple NL between protos at depth 0
        if (depth === 0 &&
            tokenBag[i].token === Token_1.Token.RBRACE &&
            tokenBag[i + 1]?.token === Token_1.Token.NL &&
            tokenBag[i + 2]?.token !== Token_1.Token.NL) {
            ret.push(vscode_languageserver_1.TextEdit.insert(vscode_languageserver_1.Position.create(tokenBag[i + 1].line, tokenBag[i + 1].col), "\n"));
        }
        //	insert NL after proto open
        if (tokenBag[i].token === Token_1.Token.LBRACE &&
            tokenBag[i + 1].token !== Token_1.Token.NL) {
            ret.push(vscode_languageserver_1.TextEdit.replace(vscode_languageserver_1.Range.create(tokenBag[i].line, tokenBag[i].col, tokenBag[i + 1].line, tokenBag[i + 1].col - 1), "\n" + generateWhiteSpaces(options, depth)));
        }
        //	insert NL after proto end
        if (tokenBag[i].token === Token_1.Token.RBRACE &&
            tokenBag[i - 1].token !== Token_1.Token.NL) {
            ret.push(vscode_languageserver_1.TextEdit.insert(vscode_languageserver_1.Position.create(tokenBag[i].line, tokenBag[i].col - 1), "\n" + generateWhiteSpaces(options, depth)));
        }
        //	insert one space between : and whatever is next (bracket, inherited proto)
        if (tokenBag[i].token === Token_1.Token.COLON && tokenBag[i + 1]) {
            if (tokenBag[i].line === tokenBag[i + 1].line) {
                if (tokenBag[i + 1].col > tokenBag[i].col + 2) {
                    ret.push(vscode_languageserver_1.TextEdit.replace(vscode_languageserver_1.Range.create(tokenBag[i].line, tokenBag[i].col, tokenBag[i + 1].line, tokenBag[i + 1].col - 1), " "));
                }
                if (tokenBag[i + 1].col === tokenBag[i].col + 1) {
                    ret.push(vscode_languageserver_1.TextEdit.insert(vscode_languageserver_1.Position.create(tokenBag[i].line, tokenBag[i].col), " "));
                }
            }
        }
        //	no space between . DOT and identifier
        if (tokenBag[i].token === Token_1.Token.DOT &&
            tokenBag[i + 1]?.token === Token_1.Token.ID) {
            if (tokenBag[i].line === tokenBag[i + 1].line) {
                if (tokenBag[i].col + 1 !== tokenBag[i + 1].col) {
                    ret.push(vscode_languageserver_1.TextEdit.del(vscode_languageserver_1.Range.create(tokenBag[i].line, tokenBag[i].col, tokenBag[i + 1].line, tokenBag[i + 1].col - 1)));
                }
            }
        }
        //	no space between identifier and . DOT
        if (tokenBag[i].token === Token_1.Token.ID &&
            tokenBag[i + 1]?.token === Token_1.Token.DOT) {
            if (tokenBag[i].line === tokenBag[i + 1].line) {
                if (tokenBag[i].col + tokenBag[i].val?.trim()?.length !==
                    tokenBag[i + 1].col) {
                    ret.push(vscode_languageserver_1.TextEdit.del(vscode_languageserver_1.Range.create(tokenBag[i].line, tokenBag[i].col + tokenBag[i].val?.length - 1, tokenBag[i + 1].line, tokenBag[i + 1].col - 1)));
                }
            }
        }
        //	indent formatting
        if (tokenBag[i].token === Token_1.Token.NL && tokenBag[i + 1]?.token === Token_1.Token.ID) {
            const desiredWhiteSpaces = generateWhiteSpaces(options, depth);
            ret.push(vscode_languageserver_1.TextEdit.replace(vscode_languageserver_1.Range.create(tokenBag[i + 1].line, 0, tokenBag[i + 1].line, tokenBag[i + 1].col - 1), desiredWhiteSpaces));
        }
        if (tokenBag[i].token === Token_1.Token.NL &&
            tokenBag[i + 1]?.token === Token_1.Token.RBRACE) {
            // we need to use depth-1 as the curly bracket has not been counted yet
            const desiredWhiteSpaces = generateWhiteSpaces(options, depth - 1);
            ret.push(vscode_languageserver_1.TextEdit.replace(vscode_languageserver_1.Range.create(tokenBag[i + 1].line, 0, tokenBag[i + 1].line, tokenBag[i + 1].col - 1), desiredWhiteSpaces));
        }
        // end indent formatting
        i++;
    }
    return ret;
};
//# sourceMappingURL=index.js.map