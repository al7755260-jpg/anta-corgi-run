import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const cwd=path.dirname(fileURLToPath(import.meta.url));
const child=spawn(process.execPath,[path.join(cwd,'server.mjs'),'--open'],{cwd,detached:true,windowsHide:true,stdio:'ignore'});child.unref();
