import { Proto } from './compiler/Proto';

export const findChildrenOf = (identifier: string, root: Proto): string[] => {
	if (identifier.endsWith('.')) {
		identifier = identifier.slice(0, -1);
	}

	const proto = findProtoByQname(identifier, root);

	if (proto) {
		//  maybe this is an alias
		// const alias = proto.type?.resolved;

		const toRet: string[] = [];

		/*
		if (alias) {
		toRet = Object.keys(alias.children).filter(p => p.startsWith("_") === false);
		}
		*/

		return [...toRet, ...Object.keys(proto.children).filter(p => p.startsWith("_") === false)];
	}

	return [];
};

export const findProtoByQname = (qname: string, root: Proto): Proto | undefined => {
    const parts = qname === "" ? [] : qname.split(".");

    let ret: Proto | undefined;
    let currentProto: Proto = root;
    let currentPartIndex = 0;

    while(currentProto && currentPartIndex < parts.length) {
      const currentPart = parts[currentPartIndex++];

      currentProto = currentProto.children[currentPart];

      //  need to take into account aliases here
      //  currentProto.type;

      if (currentProto && currentPartIndex === parts.length) {
        ret = currentProto;
      }
    }

	return ret;
};
