import { ProtoCompiler } from '../compiler/Compiler';
import { LibraryManager } from './LibManager';
import { XetoLib } from './XetoLib';

import { readUrl } from './utils';

const librariesToAdd = [ {
		name: 'sys',
		files: ['meta.xeto', 'types.xeto'] as string[],
	}, {
		name: 'ph',
		files: ['tags.xeto', 'kinds.xeto', 'entities.xeto'] as string[],
	}, {
		name: 'phx',
		files: ['points.xeto'] as string[],
	}
] as const;

const processSysLibNo = async (baseURL: string, lm: LibraryManager, index: number): Promise<void> => {
	if (index >= librariesToAdd.length) {
		return;
	}

	const libInfo = librariesToAdd[index];

	//	reading lib.xeto to get meta data about the library
	const libInfoUri = `${baseURL}/${libInfo.name}/lib.xeto`;

	const libXeto = await readUrl(libInfoUri);
	const libInfoCompiler = new ProtoCompiler(libInfoUri.replace('https://', 'xeto://'));
	try {
		libInfoCompiler.run(libXeto + '\0');
	} catch (e) {
		console.log(e);
	}

	const libVersion = libInfoCompiler.root?.children['pragma']?.children._version.type || 'unknown';
	const libDoc = libInfoCompiler.root?.children['pragma']?.doc || '';

	const lib = new XetoLib(libInfo.name, libVersion, libInfoUri.replace('https://', 'xeto://'), libDoc);
	lib.includePriority = -1;

	// now that we have the lib read all the files
	const filesPr = libInfo.files.map(async (fileName) => {
		const uri = `${baseURL}/${libInfo.name}/${fileName}`;

		const compiler = new ProtoCompiler(uri.replace('https://', 'xeto://'));
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
	const baseURL = `https://raw.githubusercontent.com/haxall/haxall/${sha}/lib/data`;

	processSysLibNo(baseURL, lm, 0);
};

