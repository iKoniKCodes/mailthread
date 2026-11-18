import { readFile, mkdir, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
const source = new URL("../demo.html.gz", import.meta.url);
const target = new URL("../public/demo/", import.meta.url);
await mkdir(target, { recursive: true });
await writeFile(new URL("index.html", target), gunzipSync(await readFile(source)));
