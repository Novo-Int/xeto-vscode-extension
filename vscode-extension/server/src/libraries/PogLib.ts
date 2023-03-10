import { FileLoc } from '../compiler/FileLoc';
import { Proto } from '../compiler/Proto';

export class PogLib {
	private _version: string;
	private _deps: string[] = [];

	//	higher priority overrides lower priority
	//	by default we give a high priority to all libs
	//	sys libs have -1
	//	other loaded libs via configs start from 0 and go to the number of entries in the lists
	private _includePriority = 100;

	public get version () {
		return this._version;
	}

	public get deps () {
		return this._deps;
	}

	readonly name: string;
	readonly children: Record<string, Proto> = {};
	readonly rootProto: Proto;

	public get includePriority () {
		return this._includePriority;
	}

	public set includePriority (val: number) {
		this._includePriority = val;
	}

	constructor(name: string, version: string, fileUri: string, doc = "") {
		this.name = name;
		this._version = version;
		//	we always want this to point to lib.pog
		if (fileUri.endsWith('lib.pog') === false) {
			fileUri = fileUri.replace(/\/[^/]+$/, '/lib.pog');
		}
		this.rootProto = new Proto(name, 'sys.Root', new FileLoc(fileUri), doc);
	}

	public addChild(name: string, proto: Proto): void {
		this.children[name] = proto;
		this.rootProto.children[name] = proto;
	}

	public addMeta(version: string, doc: string, deps: string[] = []) {
		this.rootProto.doc = doc;
		this._version = version;
		this._deps = [...deps];
	}
}
