import { Proto } from '../compiler/Proto';

type Pos = {
	line: number
	col: number
	length: number
}

const extractSemanticProtos = (root: Proto): Proto[] => {
	const bag: Proto[] = [];

	extractSemanticProtosRecursive(root, bag);

	return bag;
};

const extractSemanticProtosRecursive = (proto: Proto, bag: Proto[]): void => {
	if (proto.type === 'Marker' || proto.type === 'sys.Marker') {
		bag.push(proto);
		return;
	}

	Object.values(proto.children).forEach(proto => extractSemanticProtosRecursive(proto, bag));
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
