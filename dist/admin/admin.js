import {normalizeImageURL} from '../image-url.js';

const $=id=>document.getElementById(id);
let images=[],selected=null,pending=null,setup=false,busy=false;
let previewTimer=0,previewTimeout=0,previewRequest=0;
const displayedURL=item=>item.replacement?.imageUrl||item.url;
const names={'hero-motion-background':'Homepage · globe background','hero-motion-plane':'Homepage · aircraft','hero-motion-truck':'Homepage · truck','about-scene-clean':'About · courier and customer','process-scene-clean':'Process · parcel conveyor','shipping-scene-clean':'Shipping · globe and transport','customer-scene-clean':'Customer stories · delivery photo','closing-reference-scene':'Closing banner · global network','service-fedex':'International courier · aircraft','service-self-express':'Express delivery · parcel','service-dhl':'Business shipping · truck','service-medicine':'Medicine courier','bangalore':'Kochi office - city view','bengaluru':'Bengaluru office - city view','mumbai':'Mumbai office - city view','delhi':'Delhi office - city view','hero-background':'Network - port background','pickup-visual':'Courier pickup','logo':'Company logo','favicon':'Browser icon','logo-cursor':'Mouse cursor'};
const title=item=>names[item.id]||item.title;
async function api(endpoint,data){const r=await fetch('/api/cms/'+endpoint,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});const result=await r.json();if(!r.ok){if(r.status===401&&endpoint!=='login'){if($('editor').open)$('editor').close();await start();}throw Error(result.error||'Something went wrong. Please try again.');}return result;}
function setStatus(text){$('status').textContent=text;}
async function start(){const state=await api('status');setup=state.setup;$('login').hidden=state.authenticated;$('manager').hidden=!state.authenticated;$('logout').hidden=!state.authenticated;if(state.authenticated){await load();return;}$('login-title').textContent=setup?'Make it yours.':'Welcome back.';$('login-copy').textContent=setup?'Create a temporary local admin password of at least 12 characters. It resets when the server restarts. Set CMS_PASSWORD on your server to keep the same login.':state.configured?'Sign in to manage your website images.':'Image management needs a server password. Set CMS_PASSWORD, then restart the server.';$('password').autocomplete=setup?'new-password':'current-password';$('password').minLength=setup?12:1;$('login-submit').textContent=setup?'Create password →':'Sign in →';$('login-form').hidden=!state.configured&&!setup;setStatus('');}
const pageNames={'/':'Home','/about':'About us','/services':'Services','/services/international':'International courier','/services/express':'Express delivery','/services/domestic':'Domestic courier','/services/business':'Business shipping','/services/logistics':'Logistics solutions','/coverage':'Coverage & offices','/industries':'What you can ship','/careers':'Careers','/contact':'Contact','/quote':'Request a quote'};
const brandIDs=new Set(['logo','favicon','logo-cursor']);
let activePage=new URL(location.href).searchParams.get('page')||'/';
const label=path=>pageNames[path]||path;
const displayName=item=>title(item).replace(/^Homepage · /,'').replace(/^About · /,'').replace(/^Process · /,'').replace(/^Shipping · /,'').replace(/^Closing banner · /,'').replace(/^Customer stories · /,'').replace(/^Avatar /i,'Customer photo · ');
function pageItems(){if(activePage==='brand')return images.filter(i=>brandIDs.has(i.id));if(activePage==='all')return images;return images.filter(i=>!brandIDs.has(i.id)&&i.pages.some(p=>p.path===activePage));}
function sectionsFor(item){if(brandIDs.has(item.id))return [{section:'Brand identity',anchor:''}];if(activePage==='all')return [{section:'All website images',anchor:''}];return item.placements?.filter(p=>p.page===activePage).length?item.placements.filter(p=>p.page===activePage):[{section:'Page images',anchor:''}];}
function choosePage(value){setStatus('');activePage=value;$('page').value=value;$('search').value='';$('filter').value='all';const url=new URL(location.href);url.searchParams.set('page',value);history.replaceState(null,'',url);render();window.scrollTo({top:0,behavior:'instant'});}
async function load(){const listing=await api('images');images=listing.images;if(!['brand','all',...Object.keys(pageNames)].includes(activePage))activePage='/';$('page').replaceChildren(...Object.entries(pageNames).map(([path,name])=>new Option(name,path)),new Option('Shared branding','brand'),new Option('All images','all'));$('page').value=activePage;render();}
function navigation(){const nav=$('page-nav');nav.replaceChildren();for(const [path,name] of [...Object.entries(pageNames),['brand','Shared branding'],['all','All images']]){const button=document.createElement('button');button.type='button';button.className='page-nav-item'+(path.startsWith('/services/')?' subpage':'')+(path===activePage?' current':'')+(path==='brand'?' brand-link':'');if(path===activePage)button.setAttribute('aria-current','page');const nameSpan=document.createElement('span');nameSpan.textContent=name;const count=document.createElement('small');count.textContent=path==='all'?images.length:path==='brand'?images.filter(i=>brandIDs.has(i.id)).length:images.filter(i=>!brandIDs.has(i.id)&&i.pages.some(p=>p.path===path)).length;button.append(nameSpan,count);button.onclick=()=>choosePage(path);nav.append(button);}}
function render(){navigation();const isBrand=activePage==='brand',isAll=activePage==='all';const pageLabel=isBrand?'Shared branding':isAll?'All images':label(activePage);$('page-title').textContent=pageLabel;$('breadcrumb-page').textContent=pageLabel;$('page-description').textContent=isBrand?'Manage the identity used across your website.':isAll?'Browse every image in one place.':'Manage images by section, in the order visitors see them.';$('preview-page').href=isBrand||isAll?'/':activePage;$('preview-page').textContent=isBrand||isAll?'Preview website ↗':'Preview page ↗';$('search').placeholder=isAll?'Search all images…':'Search this page…';$('brand-note').hidden=isBrand||isAll;
 const pageList=pageItems();const q=$('search').value.toLowerCase().trim(),filter=$('filter').value;const list=pageList.filter(i=>(title(i)+' '+i.title+' '+sectionsFor(i).map(s=>s.section).join(' ')).toLowerCase().includes(q)&&(filter==='all'||(filter==='updated'?!!i.replacement:!i.replacement)));const allSections=new Set(pageList.flatMap(i=>sectionsFor(i).map(s=>s.section)));$('stat-images').textContent=pageList.length;$('stat-sections').textContent=allSections.size;$('stat-updated').textContent=pageList.filter(i=>i.replacement).length;$('count').textContent=`${list.length} ${list.length===1?'image':'images'}`;$('empty').hidden=list.length>0;$('images').replaceChildren();
 const groups=new Map();for(const item of list)for(const placement of sectionsFor(item)){if(!groups.has(placement.section))groups.set(placement.section,{anchor:placement.anchor,items:[]});groups.get(placement.section).items.push(item);}
 const order=['Main hero','Services & shipping','Our story','How it works','Our network','Business shipping','Customer stories','Closing banner'];const entries=[...groups];if(activePage==='/')entries.sort((a,b)=>(order.indexOf(a[0])<0?99:order.indexOf(a[0]))-(order.indexOf(b[0])<0?99:order.indexOf(b[0])));
 for(const [section,group] of entries){const block=document.createElement('section');block.className='image-section';const heading=document.createElement('div');heading.className='image-section-heading';const h2=document.createElement('h2');h2.textContent=section;const count=document.createElement('span');count.textContent=`${group.items.length} ${group.items.length===1?'image':'images'}`;heading.append(h2,count);if(!isBrand&&!isAll){const view=document.createElement('a');view.href=activePage+(group.anchor?'#'+group.anchor:'');view.target='_blank';view.rel='noopener';view.textContent='View section ↗';heading.append(view);}const grid=document.createElement('div');grid.className='grid';for(const item of group.items)grid.append(imageCard(item,section));block.append(heading,grid);$('images').append(block);}
}
function imageCard(item,section){const card=document.createElement('article');card.className='card';const thumb=document.createElement('button');thumb.type='button';thumb.className='thumb';thumb.setAttribute('aria-label','Preview '+displayName(item));thumb.onclick=()=>edit(item,section);const img=new Image();img.referrerPolicy='no-referrer';img.src=displayedURL(item);img.alt=displayName(item);img.loading='lazy';const unavailable=document.createElement('span');unavailable.className='thumb-error';unavailable.textContent='Image unavailable · check URL';unavailable.hidden=true;img.onerror=()=>{img.hidden=true;unavailable.hidden=false;};thumb.append(img,unavailable);const badge=document.createElement('span');badge.className=item.replacement?'badge':'original-badge';badge.textContent=item.replacement?'Updated':'Original';thumb.append(badge);const content=document.createElement('div');content.className='card-copy';const heading=document.createElement('h3');heading.textContent=displayName(item);const copy=document.createElement('p');const pages=item.pages.filter(p=>p.path!=='/404');copy.textContent=brandIDs.has(item.id)?'Shared across the website':pages.length>1?`Shared image · ${pages.length} pages`:'Only on this page';const button=document.createElement('button');button.type='button';button.textContent='Replace image ↗';button.setAttribute('aria-label','Manage '+title(item));button.onclick=()=>edit(item,section);content.append(heading,copy,button);card.append(thumb,content);return card;}

function showPreview(url,isGoogleDrive=false){
 clearTimeout(previewTimeout);
 const request=++previewRequest;
 const img=new Image();img.id='preview';img.alt='Selected website image';img.referrerPolicy='no-referrer';
 $('preview').replaceWith(img);$('preview-placeholder').hidden=true;$('dimensions').textContent='Loading preview…';$('preview-message').textContent='';
 img.onload=()=>{if(request!==previewRequest)return;clearTimeout(previewTimeout);$('dimensions').textContent=`${img.naturalWidth} × ${img.naturalHeight} pixels`;$('preview-message').textContent=isGoogleDrive?'Preview loaded. The file must remain publicly accessible.':'';};
 img.onerror=()=>{if(request!==previewRequest)return;clearTimeout(previewTimeout);img.hidden=true;$('preview-placeholder').hidden=false;$('dimensions').textContent='';$('preview-message').textContent=isGoogleDrive?'Image cannot be displayed from this Google Drive link. Make sure the file is publicly accessible or use a direct image URL.':'Image could not be displayed. Check that the URL points to a publicly accessible image and allows use on this website.';};
 previewTimeout=setTimeout(()=>{if(request!==previewRequest)return;$('dimensions').textContent='';$('preview-message').textContent='Preview is taking too long. Check the link or select Preview to try again.';},12000);
 img.src=url;
}
function edit(item,section='Image details'){
 clearTimeout(previewTimer);selected=item;pending=null;
 $('image-url').value=item.replacement?.imageUrl||'';$('image-url').setCustomValidity('');$('image-url').removeAttribute('aria-invalid');$('edit-error').textContent='';
 $('edit-title').textContent=displayName(item);$('edit-context').textContent=(activePage==='brand'?'Shared branding':activePage==='all'?'Image library':label(activePage))+' / '+section;
 const shared=item.pages.filter(p=>p.path!=='/404');$('shared-warning').hidden=shared.length<2;$('shared-warning').textContent='Shared image: this change will update '+shared.length+' pages. Review the list below before saving.';
 showPreview(displayedURL(item),item.replacement?normalizeImageURL(item.replacement.imageUrl).isGoogleDrive:false);
 $('used-on').replaceChildren(...item.pages.map(page=>{const li=document.createElement('li');const a=document.createElement('a');a.href=page.path;a.target='_blank';a.rel='noopener';a.textContent=page.title+' ↗';li.append(a);return li;}));
 $('restore').hidden=!item.replacement;$('save').disabled=true;$('edit-state').textContent=item.replacement?'An image URL is currently live.':'The original image is currently live.';$('editor').showModal();
}
function validateURL(previewNow=false){
 clearTimeout(previewTimer);clearTimeout(previewTimeout);previewRequest++;pending=null;$('save').disabled=true;$('edit-error').textContent='';$('preview-message').textContent='';$('image-url').setCustomValidity('');$('image-url').removeAttribute('aria-invalid');
 try{
  const normalized=normalizeImageURL($('image-url').value);
  pending=normalized.url===selected?.replacement?.imageUrl?null:normalized.url;
  $('save').disabled=busy||!pending;$('edit-state').textContent=pending?'Preview only — save the URL to update the website.':'This image URL is already live.';
  if(previewNow)showPreview(normalized.url,normalized.isGoogleDrive);
  else{ $('dimensions').textContent='Loading preview…';previewTimer=setTimeout(()=>showPreview(normalized.url,normalized.isGoogleDrive),250); }
 }catch(e){
  $('image-url').setCustomValidity(e.message);$('image-url').setAttribute('aria-invalid','true');$('edit-error').textContent=e.message;$('edit-state').textContent='Enter a valid image URL to preview and save.';$('preview').hidden=true;$('preview-placeholder').hidden=false;$('dimensions').textContent='';
 }
}
$('image-url').oninput=()=>validateURL();
$('preview-url').onclick=()=>validateURL(true);
function lock(value){busy=value;$('save').disabled=value||!pending;$('restore').disabled=value;$('image-url').disabled=value;$('preview-url').disabled=value;document.querySelector('.close').disabled=value;}
async function refreshAfterChange(message){try{await load();setStatus(message);}catch(e){setStatus(message+' The image list could not refresh: '+e.message);}}
$('save').onclick=async()=>{if(!pending||busy)return;lock(true);$('edit-error').textContent='';$('edit-state').textContent='Saving your image URL…';try{await api('image-url',{url:selected.url,imageUrl:pending});$('editor').close();await refreshAfterChange('Image URL saved for this server session. Export URLs to keep a backup.');}catch(e){$('edit-error').textContent=e.message;$('edit-state').textContent='Save was not confirmed. Check your connection and try again.';}finally{lock(false);}};
$('restore').onclick=async()=>{if(busy||!confirm('Restore the original image everywhere it appears?'))return;lock(true);try{await api('restore',{url:selected.url});$('editor').close();await refreshAfterChange('Original image restored for this server session. Export URLs to keep this change.');}catch(e){$('edit-error').textContent=e.message;}finally{lock(false);}};
$('editor').addEventListener('cancel',e=>{if(busy)e.preventDefault();});$('editor').addEventListener('close',()=>{clearTimeout(previewTimer);clearTimeout(previewTimeout);previewRequest++;});
$('login-form').onsubmit=async e=>{e.preventDefault();$('login-submit').disabled=true;$('login-error').textContent='';try{await api(setup?'setup':'login',{password:$('password').value});$('password').value='';await start();}catch(e){$('login-error').textContent=e.message;}finally{$('login-submit').disabled=false;}};
$('logout').onclick=async()=>{try{await api('logout',{});await start();}catch(e){setStatus(e.message);}};

function lockReferences(value){$('export-urls').disabled=value;$('import-urls').disabled=value;}
$('export-urls').onclick=async()=>{
 lockReferences(true);
 try{
  const document=await api('export');
  const referenceURL=URL.createObjectURL(new Blob([JSON.stringify(document,null,2)+'\n'],{type:'application/json'}));
  const link=window.document.createElement('a');link.href=referenceURL;link.download='cms-images.json';window.document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(referenceURL),1000);
  setStatus('URL references exported. Keep cms-images.json for import or your next deployment.');
 }catch(e){setStatus('Export failed: '+e.message);}finally{lockReferences(false);}
};
$('import-urls').onclick=()=>{$('import-file').value='';$('import-file').click();};
$('import-file').onchange=async()=>{
 const file=$('import-file').files[0];if(!file)return;lockReferences(true);
 try{
  if(file.size>256*1024)throw Error('Choose a URL reference JSON file no larger than 256 KB.');
  let document;try{document=JSON.parse(await file.text());}catch{throw Error('This file is not valid JSON. Choose a previously exported cms-images.json file.');}
  if(document?.version!==1||!document.images||typeof document.images!=='object'||Array.isArray(document.images))throw Error('Choose a version 1 URL reference export.');
  if(!confirm('Replace all current image URL references with this file? Images not listed will use their originals. Export first if you need to keep your current references.'))return;
  await api('import',document);await refreshAfterChange('Image URL references imported for this server session.');
 }catch(e){setStatus('Import failed: '+e.message);}finally{lockReferences(false);$('import-file').value='';}
};
$('search').oninput=render;$('filter').onchange=render;$('page').onchange=()=>choosePage($('page').value);$('open-brand').onclick=()=>choosePage('brand');$('clear-filters').onclick=()=>{$('search').value='';$('filter').value='all';render();};start().catch(e=>setStatus(e.message));
