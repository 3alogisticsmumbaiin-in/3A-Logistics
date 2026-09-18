import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {createCMS} from './cms.mjs';
const root=process.cwd();
try{process.loadEnvFile?.(path.join(root,'.env'));}catch(error){if(error.code!=='ENOENT')throw error;}
if(process.env.NODE_ENV==='production'){
 if(!process.env.CMS_PASSWORD||process.env.CMS_PASSWORD.length<12)throw Error('Set CMS_PASSWORD to at least 12 characters before deploying.');
 if(!process.env.CMS_PUBLIC_URL||new URL(process.env.CMS_PUBLIC_URL).protocol!=='https:')throw Error('Set CMS_PUBLIC_URL to the live HTTPS website address.');
}
const cms=await createCMS(root);
const publicRoot=path.join(root,'dist');
await stat(path.join(publicRoot,'index.html')); // A production service must have a completed public build.
const port=Number(process.env.PORT)||4173;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};
http.createServer(async(req,res)=>{
 try {
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options','DENY');
  if(pathname==='/healthz'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{"ok":true}');return;}
  if(await cms.handle(req,res,pathname))return;
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end('Method not allowed');return;}
  if(await cms.image(pathname,res,req))return;
  const segments=pathname.split('/');
  if(segments.some(s=>s.startsWith('.')||s==='src'||s==='node_modules')||/\.(mjs|md)$/.test(pathname)){res.writeHead(404);res.end('Not found');return;}
  let file=path.resolve(publicRoot,'.'+pathname);
  if(!file.startsWith(publicRoot+path.sep)&&file!==publicRoot){res.writeHead(403);res.end('Forbidden');return;}
  let info=await stat(file);
  if(info.isDirectory())file=path.join(file,'index.html');
  const data=await readFile(file);
  if(pathname.startsWith('/admin')){res.setHeader('X-Frame-Options','DENY');res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: http:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");}
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(data);
 }catch{res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'});res.end(await readFile(path.join(publicRoot,'404.html')).catch(()=> 'Page not found'));}
}).listen(port,process.env.HOST||(process.env.NODE_ENV==='production'?'0.0.0.0':'127.0.0.1'),()=>console.log(`3A Logistics is ready at http://localhost:${port} — Image manager: /admin/`));
