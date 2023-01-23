import { CLib, CProto } from '../CTypes';
import { Step } from './Step';

export class ResolveAlias extends Step {
	public run(): void {
		//
	}

	private resolveAlias(lib: CLib) {
		if (!lib.proto) {
			return;
		}

		this.resolveProto(lib.proto);
	}

	private resolveProto(proto: CProto) {
		const typeName = proto.type?.name;

		if (typeName && typeName !== "sys.Marker" && typeName !== "sys.Intersection" && typeName !== "sys.Union" && typeName !== "sys.List") {
			const ref = this.compiler.findProtoByQname(typeName);

			if (ref && proto.type) {
				// proto.type = CType.makeResolved(proto.type.loc, ref);
			}
		}

		Object.values(proto.children).forEach(c => this.resolveProto(c));
	}
}