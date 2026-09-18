// Pure URL handling shared by the CMS and its browser editor. No network calls.
export function normalizeImageURL(value){
 if(typeof value!=='string'||!value.trim())throw Error('Enter an image URL.');
 if(value.length>4096||/[\u0000-\u001f\u007f]/.test(value))throw Error('Enter a valid image URL of no more than 4,096 characters.');
 const input=value.trim();
 if(!/^https?:\/\//i.test(input))throw Error('Use a complete image URL starting with https:// or http://.');
 let parsed;try{parsed=new URL(input);}catch{throw Error('Enter a valid image URL.');}
 if(!['https:','http:'].includes(parsed.protocol)||!parsed.hostname||parsed.username||parsed.password)throw Error('Use an HTTP or HTTPS image URL without a username or password.');
 if(parsed.hostname==='drive.google.com'){
  const file=parsed.pathname.match(/^\/file\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/);
  const id=file?.[1]||(/^\/(?:open|uc|thumbnail)\/?$/.test(parsed.pathname)?parsed.searchParams.get('id'):null);
  if(!id||!/^[a-zA-Z0-9_-]+$/.test(id))throw Error('Use a Google Drive file sharing link, not a folder link, or use a direct image URL.');
  const display=new URL('https://drive.google.com/thumbnail');
  display.searchParams.set('id',id);display.searchParams.set('sz','w2400');
  const resourcekey=parsed.searchParams.get('resourcekey');if(resourcekey)display.searchParams.set('resourcekey',resourcekey);
  return {url:display.href,isGoogleDrive:true};
 }
 // URL serialization encodes Unicode safely for redirects without rewriting
 // signed query strings through URLSearchParams.
 return {url:parsed.href,isGoogleDrive:parsed.hostname==='googleusercontent.com'||parsed.hostname.endsWith('.googleusercontent.com')};
}
