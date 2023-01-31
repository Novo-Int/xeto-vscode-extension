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
import osPath = require('path');

import { ProtoCompiler } from "./compiler/Compiler";
import { CompilerError } from './compiler/Errors';
import { FileLoc } from './compiler/FileLoc';
import { Dirent } from 'fs';
import { Location } from 'vscode';
import { Proto } from './compiler/Proto';
import { findChildrenOf, findProtoByQname } from './FindProto';
import { LibraryManager, PogLib, loadSysLibsFromGH } from './libraries/';

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

const libManager: LibraryManager = new LibraryManager();

const getRootFolderFromParams = (params:InitializeParams): string[] => {
	let ret = '';

	if (params.workspaceFolders) {
		return params.workspaceFolders.map(folder => folder.uri.replace('file://', ''));
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
	rootFolders.filter(folder => Boolean(folder)).forEach(async folderPath => {
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

connection.onInitialized(async (): Promise<InitializeResult> => {
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

	const settings = await connection.workspace.getConfiguration("pog");

	loadSysLibsFromGH(settings.libraries.sys, libManager);

	return {
		capabilities: {
		}
	};
});

// Pog settings
type ExtLibSetting = {
	name: string
	files: string[]
}
interface POGSettings {
	libs: {
		external: ExtLibSetting[],
		system: string
	}
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: POGSettings = {
	libs: {
		external: [],
		system: '',
	}
};

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
			section: 'pog'
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

async function populateLibraryManager(compiler: ProtoCompiler) {
	if (!compiler.root) {
		return;
	}

	const split = compiler.sourceUri.split('/');
	let hasLib = false;

	try {
		const stat = await fs.stat(osPath.join(compiler.sourceUri.replace('file:/', ''), '..', 'lib.pog'));
		if (stat.isFile()) {
			hasLib = true;
		}
	} catch {
		return;
	}

	let libName: string | undefined = undefined;
	let libVersion = '';
	let libDoc = '';

	if (hasLib) {
		libName = split[split.length - 2];
	}

	const isLibMeta = compiler.sourceUri.endsWith('lib.pog');

	if (isLibMeta) {
		libName = split[split.length - 2];
		libVersion = compiler.root?.children['pragma']?.children._version.type;
		libDoc = compiler.root?.children['pragma']?.doc || '';
	}

	if (!libName) {
		return;
	}

	if (!libManager.getLib(libName)) {
		libManager.addLib(new PogLib(libName, libVersion, compiler.sourceUri, libDoc));
	}

	const pogLib = libManager.getLib(libName);

	if (!pogLib) {
		return;
	}

	if (libVersion) {
		pogLib.addMeta(libVersion, libDoc);
	}

	if (!isLibMeta) {
		Object.entries(compiler.root.children).forEach(([name, proto]) => {
			pogLib.addChild(name, proto);
		});
	}
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

		// time to add it to the library manager
		populateLibraryManager(compiler);

		// resolve refs
		compiler.root?.resolveRefTypes(compiler.root, libManager);
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

	let options = compiledDocument.root && findChildrenOf(partialIdentifier, compiledDocument.root) || [];

	//	maybe the identifier is from a lib
	if (options.length === 0) {
		const libName = partialIdentifier.split('.')[0];
		const lib = libManager.getLib(libName);
		
		if (!lib) {
			return [];
		}

		//	get compilers for files that have this lib
		const identifierWithoutLib = partialIdentifier.split('.').slice(1).join('.');

		options = findChildrenOf(identifierWithoutLib, lib.rootProto);
	}

	return options.map(op => ({
		label: op.label,
		kind: CompletionItemKind.Field,
		detail: op.parent,
		documentation: op.doc
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

function getProtoFromFileLoc(uri: string, pos: Position): Proto | null {
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

	const proto = compiledDocument.root && findProtoByQname(identifier.join('.'), compiledDocument.root);

	if (proto) {
		return proto;
	} else {
		const proto = libManager.findProtoByQName(identifier.join('.'));
		
		return proto;
	}
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
