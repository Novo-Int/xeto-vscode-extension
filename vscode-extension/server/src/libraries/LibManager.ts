import { PogLib } from './PogLib';

export class LibraryManager {
	private libs: Record<string, PogLib> = {};

	public addLib(lib: PogLib): void {
		this.libs[lib.name] = lib;
	}

	public getLib(name: string): PogLib | undefined {
		return this.libs[name];
	}
}
