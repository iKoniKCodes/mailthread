import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { extname } from "node:path";

const config = JSON.parse(await readFile(new URL("../wrangler.json", import.meta.url), "utf8"));
const account = process.env.CLOUDFLARE_ACCOUNT_ID || config.account_id;
const namespace = process.env.MAILTHREAD_KV_ID || config.kv_namespaces.find(binding => binding.binding === "MAILTHREAD_STORE")?.id;
const token = process.env.CLOUDFLARE_API_TOKEN;
const name = process.env.MAILTHREAD_WORKER || config.name;
if (!account || !namespace || !token) throw new Error("Set CLOUDFLARE_ACCOUNT_ID, MAILTHREAD_KV_ID and CLOUDFLARE_API_TOKEN.");
const base = "https://api.cloudflare.com/client/v4/accounts/" + encodeURIComponent(account);
const worker = "/workers/scripts/" + encodeURIComponent(name);

async function api(path, method, body, bearer = token) {
  const multipart = body instanceof FormData;
  const response = await fetch(base + path, {
    method, headers: { Authorization: "Bearer " + bearer, ...(multipart ? {} : { "Content-Type": "application/json" }) },
    body: multipart ? body : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(path + " failed (" + response.status + "): " + (result.errors || []).map(e => e.message).join(", "));
  return result.result;
}

const mime = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".json":"application/json", ".webmanifest":"application/manifest+json", ".txt":"text/plain; charset=utf-8", ".svg":"image/svg+xml", ".png":"image/png", ".woff2":"font/woff2" };
const manifest = {};
const assets = new Map();

async function scan(directory, prefix = "") {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const url = new URL(encodeURIComponent(entry.name) + (entry.isDirectory() ? "/" : ""), directory);
    const path = prefix + "/" + entry.name;
    if (entry.isDirectory()) { await scan(url, path); continue; }
    const data = await readFile(url);
    const contentType = mime[extname(path)] || "application/octet-stream";
    const hash = createHash("sha256").update(contentType).update(data).digest("hex").slice(0, 32);
    manifest[path] = { hash, size: data.length };
    assets.set(hash, { data, contentType });
  }
}
await scan(new URL("../out/", import.meta.url));
if (!manifest["/index.html"]) throw new Error("Run npm run build before uploading assets.");
const session = await api(worker + "/assets-upload-session", "POST", { manifest });
let completion = session.buckets.length ? null : session.jwt;
for (const bucket of session.buckets) {
  const body = new FormData();
  for (const hash of bucket) {
    const { data, contentType } = assets.get(hash);
    body.append(hash, new Blob([data.toString("base64")], { type: contentType }), hash);
  }
  const result = await api("/workers/assets/upload?base64=true", "POST", body, session.jwt);
  if (result?.jwt) completion = result.jwt;
}
if (!completion) throw new Error("Cloudflare did not return an asset completion token.");
const form = new FormData();
const metadata = {
  main_module: config.main, compatibility_date: config.compatibility_date, observability: config.observability,
  assets: { jwt: completion, config: { html_handling: "auto-trailing-slash", run_worker_first: ["/api/*", "/demo", "/demo/*", "/workspace", "/workspace/*", "/workspace.html"] } },
  bindings: [{ name: "ASSETS", type: "assets" }, { name: "MAILTHREAD_STORE", type: "kv_namespace", namespace_id: namespace }],
  keep_bindings: ["plain_text", "secret_text"],
};
form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
for (const module of ["worker.mjs", "lib/mail.mjs"]) {
  const source = await readFile(new URL("../" + module, import.meta.url));
  form.append(module, new Blob([source], { type: "application/javascript+module" }), module);
}
const version = await api(worker, "PUT", form);
await api(worker + "/subdomain", "POST", { enabled: config.workers_dev, previews_enabled: config.preview_urls });
console.log("Deployed", name, version.deployment_id || "");
