import path from "path";
import * as url from "url";

// @ts-expect-error
const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

export const dir = path.resolve(__dirname, "..");
