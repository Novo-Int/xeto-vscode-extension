import { ProtoCompiler } from '../compiler/Compiler';
import { LibraryManager } from './LibManager';
import { PogLib } from './PogLib';

import { readUrl } from './utils';

const librariesToAdd = [ {
		name: 'sys',
		files: ['meta.pog', 'types.pog'] as string[],
	}, {
		name: 'ph',
		files: ['tags.pog', 'kinds.pog', 'entities.pog'] as string[],
	}, {
		name: 'phx',
		files: ['points.pog'] as string[],
	}
] as const;

const processSysLibNo = async (baseURL: string, lm: LibraryManager, index: number): Promise<void> => {
	if (index >= librariesToAdd.length) {
		return;
	}

	const libInfo = librariesToAdd[index];

	//	reading lib.pog to get meta data about the library
	const libInfoUri = `${baseURL}/${libInfo.name}/lib.pog`;

	const libPog = await readUrl(libInfoUri);
	const libInfoCompiler = new ProtoCompiler(libInfoUri.replace('https://', 'pog://'));
	try {
		libInfoCompiler.run(libPog + '\0');
	} catch (e) {
		console.log(e);
	}

	const libVersion = libInfoCompiler.root?.children['pragma']?.children._version.type || 'unknown';
	const libDoc = libInfoCompiler.root?.children['pragma']?.doc || '';

	const lib = new PogLib(libInfo.name, libVersion, libInfoUri.replace('https://', 'pog://'), libDoc);
	lib.includePriority = -1;

	// now that we have the lib read all the files
	const filesPr = libInfo.files.map(async (fileName) => {
		const uri = `${baseURL}/${libInfo.name}/${fileName}`;

		const compiler = new ProtoCompiler(uri.replace('https://', 'pog://'));
		const content = await readUrl(uri);
		compiler.run(content + '\0');

		if (!compiler.root) {
			return;
		}

		Object.entries(compiler.root.children).forEach(([name, proto]) => {
			lib.addChild(name, proto);
		});
	});

	await Promise.all(filesPr);

	lm.addLib(lib);

	processSysLibNo(baseURL, lm, index + 1);
};

export const loadSysLibsFromGH = (sha: string, lm: LibraryManager): void => {
	const baseURL = `https://raw.githubusercontent.com/briansfrank/proto/${sha}/pog`;

	processSysLibNo(baseURL, lm, 0);
};

