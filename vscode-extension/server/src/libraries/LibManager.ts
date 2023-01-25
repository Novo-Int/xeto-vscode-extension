import { Proto } from '../compiler/Proto';
import { findProtoByQname } from '../FindProto';
import { PogLib } from './PogLib';

export class LibraryManager {
	private libs: Record<string, PogLib> = {};

	public addLib(lib: PogLib): void {
		this.libs[lib.name] = lib;
	}

	public getLib(name: string): PogLib | undefined {
		return this.libs[name];
	}

	public findProtoByQName(qname: string): Proto | null {
		const split = qname.split('.');
		const libName = split[0];

		const lib = this.getLib(libName);

		if (!lib) {
			return null;
		}

		return findProtoByQname(split.slice(1).join('.'), lib.rootProto);
	}
}
