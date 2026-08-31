import http from 'node:http';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
http.createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
  const target=path.resolve(root,'.'+(pathname==='/'?'/gallery.html':pathname));
  if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return}
  const content=await readFile(target);
  res.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.png':'image/png','.json':'application/json','.md':'text/plain; charset=utf-8'}[path.extname(target)]??'application/octet-stream','Cache-Control':'no-store'});res.end(content);
 }catch{res.writeHead(404).end('Not found')}
}).listen(4311,'127.0.0.1',()=>console.log('QA gallery: http://127.0.0.1:4311'));
