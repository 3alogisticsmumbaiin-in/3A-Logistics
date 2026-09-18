import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {normalizeImageURL} from './image-url.js';

const storageWarning='Changes are kept in server memory and reset on restart or redeploy. Export your image URLs, then include the exported cms-images.json in your deployment to keep them.';
const badRequest=message=>Object.assign(Error(message),{status:400});

export async function createCMS(root){
 const catalog=JSON.parse(await readFile(path.join(root,'media-catalog.json'),'utf8'));
 const slots=new Set(catalog.map(item=>item.url));
 const publicOrigin=process.env.CMS_PUBLIC_URL?new URL(process.env.CMS_PUBLIC_URL).origin:null;
 const production=process.env.NODE_ENV==='production';
 const digest=(password,salt)=>scryptSync(password,salt,64);
 let credential=null;
 if(process.env.CMS_PASSWORD){const salt=randomBytes(16).toString('hex');credential={salt,hash:digest(process.env.CMS_PASSWORD,salt)};}
 const sessions=new Map(),attempts=new Map();
 const requestOrigin=req=>`${req.socket.encrypted||production?'https:':'http:'}//${req.headers.host}`;
 const sameOrigin=req=>{
  try{const origin=new URL(req.headers.origin);return origin.origin===req.headers.origin&&origin.origin===(publicOrigin||requestOrigin(req));}catch{return false;}
 };
 const assertExternal=(imageUrl,req)=>{
  const target=new URL(imageUrl);
  if((publicOrigin&&target.origin===publicOrigin)||(req&&target.host===req.headers.host))throw badRequest('Use an external image URL, not a URL on this website.');
 };
 function documentImages(document,req){
  if(!document||typeof document!=='object'||Array.isArray(document)||document.version!==1||!document.images||typeof document.images!=='object'||Array.isArray(document.images))throw badRequest('Use a version 1 image URL export with an images object.');
  const result=new Map();
  for(const [slot,record] of Object.entries(document.images)){
   if(!slots.has(slot))throw badRequest(`Unknown image slot: ${slot}`);
   if(!record||typeof record!=='object'||Array.isArray(record))throw badRequest('Each image must contain an imageUrl.');
   const {url:imageUrl}=normalizeImageURL(record.imageUrl);
   assertExternal(imageUrl,req);
   if(record.updated!==undefined&&(typeof record.updated!=='string'||!Number.isFinite(Date.parse(record.updated))))throw badRequest('An image has an invalid updated date.');
   result.set(slot,{imageUrl,...(record.updated?{updated:record.updated}:{})});
  }
  return result;
 }
 let baseline;
 try{baseline=JSON.parse(await readFile(path.join(root,'cms-images.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;baseline={version:1,images:{}};}
 let overrides=documentImages(baseline);
 const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
 const body=async req=>{
  let size=0;const chunks=[];
  for await(const chunk of req){size+=chunk.length;if(size>256*1024)throw Object.assign(Error('The image URL document is too large (maximum 256 KB).'),{status:413});chunks.push(chunk);}
  let input;try{input=JSON.parse(Buffer.concat(chunks).toString());}catch{throw badRequest('Invalid JSON request.');}
  if(!input||typeof input!=='object'||Array.isArray(input))throw badRequest('Enter a valid request.');
  return input;
 };
 const session=req=>{const token=req.headers.cookie?.match(/(?:^|;\s*)cms_session=([a-f0-9]{64})(?:;|$)/)?.[1];const record=sessions.get(token);if(record?.expires>Date.now())return token;if(token)sessions.delete(token);return null;};
 const local=req=>!production&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)&&/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host||'');
 const cookie=(value,maxAge)=>`cms_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${production?'; Secure':''}`;
 const routes=new Set(['GET /api/cms/status','POST /api/cms/login','POST /api/cms/setup','POST /api/cms/logout','GET /api/cms/images','POST /api/cms/image-url','POST /api/cms/restore','GET /api/cms/export','POST /api/cms/import']);
 return {
  async image(url,res,req){
   const record=overrides.get(url);if(!record)return false;
   // Guard committed references as well as edits, so an accidental self-reference
   // can never create a redirect loop. The existing static artwork is the fallback.
   try{assertExternal(record.imageUrl,req);}catch{return false;}
   res.writeHead(302,{Location:record.imageUrl,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end();return true;
  },
  async handle(req,res,url){
   if(!url.startsWith('/api/cms/'))return false;
   try{
    if(!routes.has(`${req.method} ${url}`)){json(res,404,{error:'Not found.'});return true;}
    if(req.method==='GET'&&url==='/api/cms/status'){json(res,200,{authenticated:!!session(req),setup:!credential&&local(req),configured:!!credential,persistence:'memory',setupLifetime:'until-server-restart',storageWarning});return true;}
    if(req.method!=='GET'&&!sameOrigin(req)){json(res,403,{error:'Please use the image manager on this website.'});return true;}
    if(req.method==='POST'&&(url==='/api/cms/login'||url==='/api/cms/setup')){
     const {password}=await body(req);
     if(typeof password!=='string'||password.length>256)throw badRequest('Enter a valid password.');
     // Count completed attempts together: overlapping request bodies must not
     // retain separate snapshots of the same client's failure counter.
     const key=req.socket.remoteAddress,now=Date.now();const failures=(attempts.get(key)||[]).filter(t=>now-t<15*60*1000);attempts.set(key,failures);
     if(failures.length>=8){json(res,429,{error:'Too many attempts. Try again in 15 minutes.'});return true;}
     if(url.endsWith('/setup')){
      if(credential||!local(req))throw Object.assign(Error('Setup is unavailable. Set CMS_PASSWORD on the server.'),{status:403});
      if(password.length<12)throw badRequest('Use at least 12 characters.');
      const salt=randomBytes(16).toString('hex');credential={salt,hash:digest(password,salt)};
     }else if(!credential||!timingSafeEqual(digest(password,credential.salt),credential.hash)){failures.push(now);json(res,401,{error:'Password not recognised.'});return true;}
     attempts.delete(key);for(const [token,record] of sessions)if(record.expires<=now)sessions.delete(token);
     const token=randomBytes(32).toString('hex');sessions.set(token,{expires:now+8*60*60*1000});res.setHeader('Set-Cookie',cookie(token,8*60*60));json(res,200,{ok:true});return true;
    }
    const token=session(req);if(!token){json(res,401,{error:'Please sign in.'});return true;}
    if(url==='/api/cms/logout'){sessions.delete(token);res.setHeader('Set-Cookie',cookie('',0));json(res,200,{ok:true});return true;}
    if(url==='/api/cms/images'){json(res,200,{images:catalog.map(item=>({...item,replacement:overrides.get(item.url)||null})),storageWarning,persistence:'memory'});return true;}
    if(url==='/api/cms/export'){
     res.setHeader('Content-Disposition','attachment; filename="cms-images.json"');
     json(res,200,{version:1,images:Object.fromEntries(overrides)});return true;
    }
    if(url==='/api/cms/import'){
     const next=documentImages(await body(req),req);overrides=next;
     json(res,200,{ok:true,count:overrides.size,storageWarning});return true;
    }
    const input=await body(req);
    if(!slots.has(input.url))throw badRequest('Unknown image.');
    if(url==='/api/cms/restore'){overrides.delete(input.url);json(res,200,{ok:true});return true;}
    const {url:imageUrl}=normalizeImageURL(input.imageUrl);assertExternal(imageUrl,req);
    const replacement={imageUrl,updated:new Date().toISOString()};overrides.set(input.url,replacement);
    json(res,200,{ok:true,replacement,storageWarning});
   }catch(error){json(res,error.status||400,{error:error.message||'This image URL could not be saved. Please try again.'});}
   return true;
  }
 };
}
