import { Proto } from '../compiler/Proto';
import { findProtoByQname } from '../FindProto';
import { LibraryManager } from '../libraries';

type Pos = {
	line: number
	col: number
	length: number
}

const extractSemanticProtos = (root: Proto, libManager?: LibraryManager): Proto[] => {
	const bag: Proto[] = [];

	extractSemanticProtosRecursive(root, root, bag, libManager);

	return bag;
};

const isMarker = (root: Proto, proto: Proto, libManager?: LibraryManager): boolean => {
	if (!proto.type) {
		return false;
	}

	if (proto.type === 'Marker' || proto.type === 'sys.Marker') {
		return true;
	}

	//	TO DO - we should be able to replace all this logic and use proto.refType
	//	to check if this points to a Marker or not

	//	maybe we have a type so we should resolve that
	const alias = findProtoByQname(proto.type, root);

	if (alias) {
		if (alias.type === 'Marker' || alias.type === 'sys.Marker') {
			return true;
		}

		return false;
	}

	if (!libManager) {
		return false;
	}

	//	check in the libs
	const libAlias = libManager.findProtoByQName(proto.type);

	if (libAlias) {
		if (libAlias.type === 'Marker' || libAlias.type === 'sys.Marker') {
			return true;
		}

		return false;
	}

	return false;
};

const extractSemanticProtosRecursive = (root: Proto, proto: Proto, bag: Proto[], libManager?: LibraryManager): void => {
	if (isMarker(root, proto, libManager)) {
		bag.push(proto);
		return;
	}

	Object.values(proto.children).forEach(proto => extractSemanticProtosRecursive(root,  proto, bag, libManager));
};

const extractPosFromProto = (proto: Proto): Pos => {
	return {
		line: proto.loc.line,
		col: proto.loc.col - 1,
		length: proto.name.length
	};
};

const convertProtosToSemanticTokens = (protos: Proto[]): number[] => {
	//	sort them based on the position on the doc
	const sortedProtos = protos.sort((a, b) => a.loc.charIndex - b.loc.charIndex);

	if (sortedProtos.length === 0) {
		return [];
	}

	//	created the return array based
	let prevPos = extractPosFromProto(sortedProtos[0]);

	const ret: number[] = [prevPos.line, prevPos.col, prevPos.length, 0, 0];

	for (let i = 1; i<sortedProtos.length; i++) {
		//	compute the difference
		const diff: number[] = [0, 0, 0, 0, 1];

		const currentPos = extractPosFromProto(sortedProtos[i]);

		if (currentPos.line === prevPos.line) {
			ret.push(0, currentPos.col - prevPos.col, currentPos.length, 0, 0);
		} else {
			ret.push(currentPos.line - prevPos.line, currentPos.col, currentPos.length, 0, 0);
		}

		prevPos = currentPos;
	}

	return ret;
};

export {
	extractSemanticProtos,
	convertProtosToSemanticTokens,
};
