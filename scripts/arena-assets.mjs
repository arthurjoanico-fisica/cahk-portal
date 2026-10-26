import {mkdir,copyFile} from 'node:fs/promises';
import {build} from 'esbuild';
await mkdir('public/arena/vendor',{recursive:true});
await copyFile('node_modules/three/build/three.module.min.js','public/arena/vendor/three.module.min.js');
await copyFile('node_modules/three/LICENSE','public/arena/vendor/THREE-LICENSE.txt');
await copyFile('node_modules/qrcode/license','public/arena/vendor/QRCODE-LICENSE.txt');
await build({entryPoints:['node_modules/qrcode/lib/browser.js'],bundle:true,format:'esm',platform:'browser',minify:true,outfile:'public/arena/vendor/qrcode.mjs',legalComments:'eof'});
