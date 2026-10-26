// Local QA server uses the same Worker and SQLite Durable Object as deployment.
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
export async function createPreviewServer(port=0){
const root=path.resolve('public');
const bundle=await build({entryPoints:['worker/index.mjs'],bundle:true,write:false,format:'esm',platform:'browser'});
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json'};
const server=new Miniflare(convertV4MiniflareOptions({name:'cahk-arena-preview',modules:true,script:bundle.outputFiles[0].text,host:'127.0.0.1',port,compatibilityDate:'2026-09-11',durableObjects:{ARENA_ROOMS:{className:'ArenaRoom',useSQLite:true}},serviceBindings:{ASSETS:async request=>{
 const url=new URL(request.url);let pathname;try{pathname=decodeURIComponent(url.pathname);}catch{return new Response('Bad path',{status:400});}
 if(pathname.endsWith('/'))pathname+='index.html';const file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep))return new Response('Forbidden',{status:403});
 try{return new Response(await readFile(file),{headers:{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}});}catch{return new Response('Not found',{status:404});}
}}}));
await server.ready;return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
const server=await createPreviewServer(8787);
console.log('Arena QA server:',String(await server.ready));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await server.dispose();process.exit(0);});
}
