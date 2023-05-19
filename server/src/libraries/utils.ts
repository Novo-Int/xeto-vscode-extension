import https from "node:https";

export const readUrl = (url: string): Promise<string> => {
	const pr = new Promise<string>((res, rej) => {
		https.get(url, (resp) => {
			let data = '';
	
			resp.on('data', chunk => {
				data += chunk;
			});
	
			resp.on('end', () => {
				res(data);
			});
		});

	});

	return pr;
};
