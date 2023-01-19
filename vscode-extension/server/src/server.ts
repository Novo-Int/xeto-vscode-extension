/* --------------------------------------------------------------------------------------------
 * Copyright (c) Novi-Studio
 * ------------------------------------------------------------------------------------------ */
import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentSyncKind,
	InitializeResult,
	CompletionParams,
	DidChangeWatchedFilesNotification,
	HoverParams,
	Hover,
	DefinitionParams,
	Definition
} from 'vscode-languageserver/node';

import {
	Position,
	TextDocument
} from 'vscode-languageserver-textdocument';

import fs from 'fs/promises';

import { ProtoCompiler } from "./compiler/Compiler";
import { CompilerError } from './compiler/Errors';
import { FileLoc } from './compiler/FileLoc';
import { CLib, CProto } from './compiler/CTypes';
import { Dirent } from 'fs';
import { Location } from 'vscode';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;
let rootFolders: string[] = [];

let docsToCompilerResults: Record<string, ProtoCompiler> = {};

const getRootFolderFromParams = (params:InitializeParams): string[] => {
	let ret = '';

	if (params.workspaceFolders) {
		ret = params.workspaceFolders[0].uri;
	} else {
		ret = params.rootUri || '';
	}

	ret = ret.replace('file://', '');

	return [ret];
};

const addWorkspaceRootToWatch = async (uri: string, storage: string[] = []) => {
	const files = await fs.readdir(uri, {
		withFileTypes: true,
	});

	await Promise.all(files.map((dirEntry: Dirent) => {
		if (dirEntry.isDirectory()) {
			return addWorkspaceRootToWatch(`${uri}/${dirEntry.name}`, storage);
		} else {
			storage.push(`${uri}/${dirEntry.name}`);
		}
	}));

	return storage;
};

const parseAllRootFolders = () => {
	rootFolders.forEach(async folderPath => {
		const files = await addWorkspaceRootToWatch(folderPath);

		const pogFiles = files.filter(path => path.endsWith('.pog'));

		pogFiles
			.filter(file => !docsToCompilerResults[`file://${file}`])
			.forEach(async file => {
				const textDocument = TextDocument.create(`file://${file}`, 'pog', 1, await (await fs.readFile(file)).toString());

				parseDocument(textDocument);
			});
	});
};

connection.onInitialize((params: InitializeParams) => {
	rootFolders = getRootFolderFromParams(params);

	parseAllRootFolders();

	const capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we fall back using global settings.
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			hoverProvider: true,
			definitionProvider: true,
			// Tell the client that this server supports code completion.
			completionProvider: {
				resolveProvider: true,
				triggerCharacters: [ '.' ]
			}
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	return result;
});

connection.onInitialized((): InitializeResult => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
		connection.client.register(DidChangeWatchedFilesNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}

	docsToCompilerResults = {};

	return {
		capabilities: {
		}
	};
});

// The example settings
interface POGSettings {
	maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: POGSettings = { maxNumberOfProblems: 1000 };
let globalSettings: POGSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<POGSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <POGSettings>(
			(change.settings.languageServerExample || defaultSettings)
		);
	}

	// Revalidate all open text documents
	documents.all().forEach(parseDocument);
});

function getDocumentSettings(resource: string): Thenable<POGSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'pogExample'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

// Only keep settings for open documents
documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	parseAllRootFolders();

	parseDocument(change.document);
});

function isCompilerError(error: any): error is CompilerError {
	return "type" in error;
}

function fileLocToDiagPosition(loc: FileLoc): Position {
	return {
		line: loc.line,
		character: loc.col > 0 ? loc.col - 1 : loc.col
	};
}

async function parseDocument(textDocument: TextDocument): Promise<void> {
	const diagnostics: Diagnostic[] = [];
	const compiler = new ProtoCompiler(textDocument.uri);
	const text = textDocument.getText();

	// if no compiler is saved then save one
	if (!docsToCompilerResults[textDocument.uri]) {
		docsToCompilerResults[textDocument.uri] = compiler;
	} else {
		// if a compiler is already present
		// only add a compiler if no errors are availabe
		// TO DO - remove this logic and always add the current compiler when we have a resilient compiler
		if (compiler.errs.length === 0) {
			docsToCompilerResults[textDocument.uri] = compiler;
		}
	}

	try {
		compiler.run(text + '\0');
		compiler.errs
			.forEach(err => {
				const diagnostic: Diagnostic = {
					severity: DiagnosticSeverity.Error,
					range: {
						start: fileLocToDiagPosition(err.loc),
						end: fileLocToDiagPosition(err.endLoc)
					},
					message: err.message,
					//source: 'ex'
				};
	
				diagnostics.push(diagnostic);
			});
	} catch (e: unknown) {
		if (isCompilerError(e)) {
			const diagnostic: Diagnostic = {
				severity: DiagnosticSeverity.Error,
				range: {
					start: textDocument.positionAt(e.loc.charIndex),
					end: textDocument.positionAt(text.length)
				},
				message: e.message,
				//source: 'ex'
			};

			diagnostics.push(diagnostic);
		}
	} finally {
		connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
	}
	return;
}

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
});

const identifierCharRegexp = /[a-zA-Z0-9_. \n\t]/;
const identifierSegmentCharRegexp = /[a-zA-Z0-9_]/;

function getIdentifierForPosition(doc: TextDocument, pos: Position): string {
	let position = doc.offsetAt(pos);
	const text = doc.getText();

	// this is naive, but we go backwards until we reach a :
	let identifier = "";

	while (position >= -1 && text.charAt(position).match(identifierCharRegexp)) {
		identifier = text.charAt(position) + identifier;
		position --;
	}

	if (position === -1) {
		return '';
	}

	identifier = identifier.trim().replace(/[\n\t]/g, '');

	return identifier;
}

function getLargestIdentifierForPosition(doc: TextDocument, pos: Position): string[] {
	let position = doc.offsetAt(pos);
	const text = doc.getText();

	// this is naive, but we go backwards until we reach a :
	let identifier = "";

	while (position >= -1 && text.charAt(position).match(identifierCharRegexp)) {
		identifier = text.charAt(position) + identifier;
		position --;
	}

	identifier = identifier.trim().replace(/[\n\t]/g, '');

	position = doc.offsetAt(pos) + 1;
	while(position < text.length && text.charAt(position).match(identifierSegmentCharRegexp)) {
		identifier += text.charAt(position);
		position ++;
	}

	identifier = identifier.trim().replace(/[\n\t]/g, '');

	return identifier.split('.');
}

function findExternalPogsOnLibName(libName: string): CProto[] {
	let libs: CProto[] = [];

	Object.values(docsToCompilerResults).filter(compiler => {
		const deps = compiler.libs[0]?.proto?.children["_depends"]?.children;
		
		if (deps) {
			const libsFound = Object.values(deps).filter(proto => proto.children["lib"].val === libName);
			libs = libs.concat(libsFound);
		}
	});

	return libs;
}

function handleAutoCompletion(params: CompletionParams): CompletionItem[] {
	// let try to find the identifier for this position
	const compiledDocument = docsToCompilerResults[params.textDocument.uri];
	const doc = documents.get(params.textDocument.uri);

	if (!compiledDocument || !doc) {
		return [];
	}

	const partialIdentifier = getIdentifierForPosition(doc, params.position);

	if (!partialIdentifier) {
		return [];
	}

	let options: string[] = compiledDocument.findChildrenOf(partialIdentifier);

	//	maybe the identifier is from a lib
	if (options.length === 0) {
		const lib = partialIdentifier.split('.')[0];
		const libs = findExternalPogsOnLibName(lib);
		
		if (libs.length === 0) {
			return [];
		}

		//	get compilers for files that have this lib
		const compilerKeys = Object.keys(docsToCompilerResults).filter(file => {
			const split = file.split('/');
			return split[split.length-2] === libs[0].children["lib"].val;
		});

		const identifierWithoutLib = partialIdentifier.split('.').slice(1).join('.');

		options = compilerKeys
			.map(key => docsToCompilerResults[key].findChildrenOf(identifierWithoutLib))
			.reduce((acc, current) => [...acc, ...current], []);
	}

	return options.map(op => ({
		label: op,
		kind: CompletionItemKind.Field,
	}));
}

// This handler provides the initial list of the completion items.
connection.onCompletion(handleAutoCompletion);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		return item;
	}
);

function getProtoFromFileLoc(uri: string, pos: Position): CProto | null {
	// let try to find the identifier for this position
	const compiledDocument = docsToCompilerResults[uri];
	const doc = documents.get(uri);

	if (!compiledDocument || !doc) {
		return null;
	}

	const identifier = getLargestIdentifierForPosition(doc, pos);

	if (!identifier) {
		return null;
	}

	const proto = compiledDocument.findProtoByQname(identifier.join('.'));

	if (proto) {
		return proto;
	} else {
		const lib = identifier[0];
		const libs = findExternalPogsOnLibName(lib);
		
		if (libs.length === 0) {
			return null;
		}

		//	get compilers for files that have this lib
		const compilerKeys = Object.keys(docsToCompilerResults).filter(file => {
			const split = file.split('/');
			return split[split.length-2] === libs[0].children["lib"].val;
		});

		const identifierWithoutLib = identifier.slice(1).join('.');

		const options = compilerKeys
			.map(key => docsToCompilerResults[key].findProtoByQname(identifierWithoutLib))
			.reduce((acc, current) => {

				if (current) {
					return [...acc, current];
				}

				return acc;
			}, [] as CProto[]);
		
		if (options[0].doc) {
			return options[0];
		}
	}

	return null;
}

function handleHover(params: HoverParams): Hover | null {
	const proto = getProtoFromFileLoc(params.textDocument.uri, params.position);

	if (!proto) {
		return null;
	}

	return {
		contents: proto.doc || ''
	};
}

connection.onHover(handleHover);

function handleDefinition(params: DefinitionParams): Definition | null {
	const proto = getProtoFromFileLoc(params.textDocument.uri, params.position);
	
	if (!proto) {
		return null;
	}

	return {
		uri: proto.loc.file,
		range: {
			start: {
				line: proto.loc.line,
				character: proto.loc.col,
			},
			end: {
				line: proto.loc.line,
				character: proto.loc.col + 1,
			}
		}
	};
}

connection.onDefinition(handleDefinition);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
