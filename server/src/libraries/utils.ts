import https from "node:https";

export const readUrl = async (url: string): Promise<string> => {
  const pr = new Promise<string>((resolve, reject) => {
    https.get(url, (resp) => {
      let data = "";

      resp.on("data", (chunk: string) => {
        data += chunk;
      });

      resp.on("end", () => {
        resolve(data);
      });
    });
  });

  return await pr;
};
