const metaPropsNotToParse: Record<string, boolean> = { 
	'_is': true,
	'_loc': true,
	'_doc': true,
	'_val': true,
};

export class Proto {
	private _refType?: Proto;

	public readonly doc?: string;
	public readonly name: string;
	public readonly type: string;

	//	alias link to another Proto
	public get refType () {
		return this._refType;
	}

	public children: Record<string, Proto> = {};

	constructor (name: string, type: string, doc?: string) {
		this.name = name;
		this.doc = doc;
		this.type = type;
	}

	private static fromPartialAST(name: string, ast: Record<string, any>): Proto {
		const proto = new Proto(name, ast._is || ast._val, ast._doc?._val);

		Object.keys(ast)
			.filter(key => !metaPropsNotToParse[key])
			.forEach(key => {
				const childProto = Proto.fromPartialAST(key, ast[key]);
				proto.children[key] = childProto;
			});

		return proto;
	}

	static fromAST(ast: Record<string, any>): Proto {
		const root = new Proto('root', 'sys.Root');

		Object.keys(ast)
		.filter(key => !metaPropsNotToParse[key])
		.forEach(key => {
			const childProto = Proto.fromPartialAST(key, ast[key]);
			root.children[key] = childProto;
		});

		return root;
	}
}
