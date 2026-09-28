import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('asset-chunks/manifest.json',root),'utf8'));
await mkdir(new URL('public/assets/',root),{recursive:true});
for(const item of manifest){
 const chunks=await Promise.all(item.parts.map(part=>readFile(new URL(`asset-chunks/${part}`,root))));
 const bytes=Buffer.concat(chunks);
 if(bytes.length!==item.bytes||createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw new Error(`Incomplete asset: ${item.name}`);
 await writeFile(new URL(`public/assets/${item.name}`,root),bytes);
 console.log(`Restored ${item.name} (${bytes.length} bytes)`);
}
