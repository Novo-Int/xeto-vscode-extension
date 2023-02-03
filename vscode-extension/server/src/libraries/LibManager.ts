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

	public findProtoByQName(qname: string, desiredLibs: string[] = []): Proto | null {
		//	if we have desiredLibs let's look there first
		if (desiredLibs) {
			for(let i = 0; i < desiredLibs.length; i++) {
				const libName = desiredLibs[i];
				const lib = this.getLib(libName);

				if (!lib) {
					continue;
				}

				const found = findProtoByQname(qname, lib.rootProto);

				if (found) {
					return found;
				}
			}
		}

		const split = qname.split('.');
		const libName = split[0];

		const lib = this.getLib(libName);

		if (!lib) {
			//	mayber this is a sys proto
			const sysLib = this.getLib('sys');

			if (!sysLib) {
				return null;
			}

			return findProtoByQname(qname, sysLib.rootProto);
		}

		return findProtoByQname(split.slice(1).join('.'), lib.rootProto);
	}
}
