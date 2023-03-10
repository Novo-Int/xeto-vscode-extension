import { Proto } from '../compiler/Proto';
import { findProtoByQname } from '../FindProto';
import { PogLib } from './PogLib';

const NAME_SEPARATOR = "#";
export class LibraryManager {
	private libs: Record<string, Record<string, PogLib>> = {};

	private getLibHash(lib: PogLib): string {
		return `${lib.name}${NAME_SEPARATOR}${lib.includePriority}`;
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

		//	get the one with the highest number
		const highestKey = Math.max(...registeredLibs.map(key => parseInt(key.split(NAME_SEPARATOR)[1])));

		return libs[`${name}${NAME_SEPARATOR}${highestKey}`];
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
