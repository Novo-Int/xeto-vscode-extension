import { Proto } from '../compiler/Proto';
import { findProtoByQname } from '../FindProto';
import { PogLib } from './PogLib';

export class LibraryManager {
	private libs: Record<string, Record<string, PogLib>> = {};

	private getLibHash(lib: PogLib): string {
		//	we may want to add lib.version to the hash
		//	when we know for sure that a lib is only created with a version
		return `${lib.name}-${lib.isExternal ? 'external' : 'local'}`;
	}

	public addLib(lib: PogLib): void {
		if (this.libs[lib.name] === undefined) {
			this.libs[lib.name] = {};
		}

		const key = this.getLibHash(lib);

		this.libs[lib.name][key] = lib;
	}

	public getLib(name: string): PogLib | undefined {
		const libs = this.libs[name];

		if (!libs) {
			return undefined;
		}

		const registeredLibs = Object.keys(libs);
		const localKeys = registeredLibs.filter(key => key.endsWith('local'));

		if (localKeys.length !== 0) {
			return libs[localKeys[0]];
		}

		return libs[registeredLibs[0]];
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
