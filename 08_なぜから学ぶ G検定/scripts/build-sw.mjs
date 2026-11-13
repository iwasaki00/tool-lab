import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
async function walk(path) {
  const items = await readdir(path, { withFileTypes: true });
  return (
    await Promise.all(
      items.map(async (e) =>
        e.isDirectory() ? walk(`${path}/${e.name}`) : `${path}/${e.name}`,
      ),
    )
  ).flat();
}
const output = process.argv[2] ?? "dist";
if (!["dist", "app"].includes(output)) throw new Error("出力先はdistまたはappを指定してください");
const files = (await walk(output)).filter((f) => !f.endsWith("/sw.js"));
const version = createHash("sha256");
for (const f of files) version.update(await readFile(f));
const cache = `why-g-${version.digest("hex").slice(0, 12)}`;
const paths = files.map((f) => "./" + f.slice(output.length + 1));
const sw = `const CACHE=${JSON.stringify(cache)},ASSETS=${JSON.stringify(paths)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('why-g-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith(caches.open(CACHE).then(async cache=>{const hit=await cache.match(event.request,{ignoreSearch:true,ignoreVary:true});if(hit)return hit;try{return await fetch(event.request);}catch{if(event.request.mode==='navigate')return await cache.match('./index.html');return new Response('未取得のデータです。オンラインで再度開いてください。',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});}}));});`;
await writeFile(`${output}/sw.js`, sw);
console.log(`Service Worker: ${paths.length} assets, ${cache}`);
