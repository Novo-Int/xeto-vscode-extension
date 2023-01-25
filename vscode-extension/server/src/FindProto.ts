import { Proto } from './compiler/Proto';

export const findChildrenOf = (identifier: string, root: Proto): string[] => {
	if (identifier.endsWith('.')) {
		identifier = identifier.slice(0, -1);
	}

	const proto = findProtoByQname(identifier, root);

	if (proto) {
		const toRet: string[] = [];

		let refType = proto.refType;

		while (refType) {
			toRet.push(...Object.keys(refType.children).filter(p => p.startsWith("_") === false));

			refType = refType.refType;
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
    let currentProto: Proto | undefined = root;
    let currentPartIndex = 0;

    while(currentProto && currentPartIndex < parts.length) {
		const currentPart = parts[currentPartIndex++];

		//	follow refs
		if (!currentProto.children[currentPart] && currentProto.refType) {
			currentProto = currentProto.refType.children[currentPart];
		} else {
			currentProto = currentProto.children[currentPart];
		}

		if (currentProto && currentPartIndex === parts.length) {
			ret = currentProto;
		}
    }

	return ret;
};
