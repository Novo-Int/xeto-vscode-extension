import { Proto } from './compiler/Proto';

export const findChildrenOf = (identifier: string, root: Proto): string[] => {
	if (identifier.endsWith('.')) {
		identifier = identifier.slice(0, -1);
	}

	const proto = findProtoByQname(identifier, root);

	if (proto) {
		let toRet: string[] = [];

		if (proto.refType) {
			toRet = Object.keys(proto.refType.children).filter(p => p.startsWith("_") === false);
		}

		return [...toRet, ...Object.keys(proto.children).filter(p => p.startsWith("_") === false)];
	}

	return [];
};

export const findProtoByQname = (qname: string, root: Proto): Proto | null => {
	if (qname === "") {
		return root;
	}

    const parts = qname.split(".");

    let ret: Proto | null = null;
    let currentProto: Proto = root;
    let currentPartIndex = 0;

    while(currentProto && currentPartIndex < parts.length) {
		const currentPart = parts[currentPartIndex++];

		currentProto = currentProto.children[currentPart];

		//	follow the refs
		//	TO DO - need to add a check for circular refs
		// if (currentProto && currentProto.refType) {
		//	currentProto = currentProto.refType;
		// }

		if (currentProto && currentPartIndex === parts.length) {
			ret = currentProto;
		}
    }

	return ret;
};
