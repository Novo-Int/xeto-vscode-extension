import { FileLoc } from '../compiler/FileLoc';
import { Proto } from '../compiler/Proto';

export class PogLib {
	readonly version: string;
	readonly name: string;
	readonly children: Record<string, Proto> = {};
	readonly rootProto: Proto;

	constructor(name: string, version: string, fileUri: string, doc = "") {
		this.name = name;
		this.version = version;
		this.rootProto = new Proto(name, 'sys.Root', new FileLoc(fileUri), doc);
	}

	public addChild(name: string, proto: Proto): void {
		this.children[name] = proto;
		this.rootProto.children[name] = proto;
	}
}