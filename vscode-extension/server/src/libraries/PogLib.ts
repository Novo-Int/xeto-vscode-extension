import { FileLoc } from '../compiler/FileLoc';
import { Proto } from '../compiler/Proto';

export class PogLib {
	private _version: string;

	public get version () {
		return this._version;
	}

	readonly name: string;
	readonly children: Record<string, Proto> = {};
	readonly rootProto: Proto;

	constructor(name: string, version: string, fileUri: string, isExternal = false, doc = "") {
		this.name = name;
		this._version = version;
		this.rootProto = new Proto(name, 'sys.Root', new FileLoc(fileUri), doc);
	}

	public addChild(name: string, proto: Proto): void {
		this.children[name] = proto;
		this.rootProto.children[name] = proto;
	}

	public addMeta(version: string, doc: string) {
		this.rootProto.doc = doc;
		this._version = version;
	}
}
