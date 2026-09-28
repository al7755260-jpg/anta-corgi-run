import http from 'node:http';
import {readFile,stat,writeFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.join(here,'dist'),port=5179,url=`http://127.0.0.1:${port}`,pidFile=path.join(here,'.game-server.pid');
const open=()=>{if(process.argv.includes('--open'))execFile('cmd.exe',['/c','start','',url],{windowsHide:true});};
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.glb':'model/gltf-binary','.png':'image/png','.woff2':'font/woff2','.json':'application/json','.mp3':'audio/mpeg','.m4a':'audio/mp4','.wav':'audio/wav','.ogg':'audio/ogg'};
const server=http.createServer(async(req,res)=>{
 try{const pathname=decodeURIComponent(new URL(req.url,url).pathname),file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 const info=await stat(file);if(!info.isFile())throw new Error('not a file');const bytes=await readFile(file);
 res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':bytes.length,'Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:bytes);
 }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('文件未找到');}
});
server.on('error',e=>{if(e.code==='EADDRINUSE'){open();process.exit(0);}console.error(e);process.exit(1);});
server.listen(port,'127.0.0.1',async()=>{await writeFile(pidFile,String(process.pid));console.log(`汪汪向前冲已启动：${url}`);open();});
async function stop(){try{await unlink(pidFile);}catch{}server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),1000).unref();}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
