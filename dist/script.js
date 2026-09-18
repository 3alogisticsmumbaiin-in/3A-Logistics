import {initEnquiries} from './enquiries.js';
import {initMotion} from './motion.js';

document.documentElement.classList.add('js');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
let pageCleanup = () => {};
let navigationId = 0;
let scrollFrame = 0;
let historySaveTimer = 0;
let lastHistorySave = 0;

function saveScrollPosition(){
  if(document.body.classList.contains('is-navigating'))return;
  history.replaceState({...history.state,scroll:window.scrollY},'',location.href);
  lastHistorySave=performance.now();
}

function setMenu(open, restoreFocus = false) {
  const button = document.querySelector('.menu-btn');
  document.body.classList.toggle('menu-open', open);
  button.setAttribute('aria-expanded', String(open));
  button.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  document.querySelector('main').inert = open;
  document.querySelector('footer').inert = open;
  if (restoreFocus) button.focus();
}

function initHeader() {
  document.querySelector('.menu-btn').addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
  const services=document.querySelector('.nav-services');
  services.addEventListener('pointerenter',()=>services.classList.remove('dismissed'));
  services.addEventListener('focusin',event=>{if(!services.contains(event.relatedTarget))services.classList.remove('dismissed');});
  document.querySelector('.dropdown-toggle').addEventListener('click', event => {
    const parent = event.currentTarget.closest('.nav-services');
    parent.classList.remove('dismissed');
    const open = parent.classList.toggle('open');
    event.currentTarget.setAttribute('aria-expanded', String(open));
  });
}

function initCoverage() {
  const detail = document.querySelector('#coverage-detail');
  if (!detail) return;
  const countries = {
    US: ['USA', 'Send personal parcels, documents or commercial shipments to the United States. Share the destination ZIP code and contents so our team can confirm service options.'],
    CA: ['Canada', 'Connect with family, customers and opportunities in Canada. Share the destination postal code, shipment contents and weight for a personalised quote.'],
    GB: ['United Kingdom', 'Explore shipping from India to the United Kingdom. We can help with packing, documentation and courier choices for your destination.'],
    DE: ['Germany', 'Plan your next shipment to Germany with 3A Logistics. Send us the delivery postcode and item details to discuss available courier services.'],
    AE: ['United Arab Emirates', 'Send documents, parcels and commercial shipments to the UAE. Our team can confirm the suitable service and required paperwork for your goods.'],
    AU: ['Australia', 'Ship to Australia with support for packing and documentation. Item acceptance and service availability are confirmed for your destination and contents.']
  };
  function selectCountry(code, updateUrl = true) {
    if (!Object.hasOwn(countries,code)) code='US';
    const [name, copy] = countries[code];
    document.querySelectorAll('[data-country]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.country === code)));
    // Only the fixed, authored country copy enters this fragment.
    detail.innerHTML=`<div><p class="eyebrow">FROM INDIA / TO ${name.toUpperCase()}</p><h3>${name}</h3><p>${copy} Transit time and final pricing are confirmed before booking.</p></div><a class="btn btn-dark" href="/quote/?destination=${encodeURIComponent(name)}">Get a quote for ${name} ↗</a>`;
    if(updateUrl){const url=new URL(location.href);url.searchParams.set('country',code);history.replaceState(history.state,'',url);}
  }
  document.querySelectorAll('[data-country]').forEach(button=>button.addEventListener('click',()=>selectCountry(button.dataset.country)));
  selectCountry(new URLSearchParams(location.search).get('country') || 'US',false);
}

function initPage() {
  pageCleanup();
  const cleanup=[];
  initEnquiries();
  initCoverage();
  const query = new URLSearchParams(location.search);
  const destination = document.querySelector('form[data-enquiry="quote"] [name="destination"]');
  if(destination && query.get('destination')) destination.value = query.get('destination').slice(0,120);
  const service = document.querySelector('form[data-enquiry="quote"] [name="message"]');
  if(service && query.get('service')) service.value = `I am interested in ${query.get('service').slice(0,100)}.`;

  let motionCleanup=initMotion({reducedMotion,finePointer});
  const refreshMotion=()=>{motionCleanup();motionCleanup=initMotion({reducedMotion,finePointer});onScroll();};
  reducedMotion.addEventListener('change',refreshMotion);
  finePointer.addEventListener('change',refreshMotion);
  cleanup.push(()=>{motionCleanup();reducedMotion.removeEventListener('change',refreshMotion);finePointer.removeEventListener('change',refreshMotion);});

  const carousel = document.querySelector('.testimonials');
  if(carousel){
    const prev=document.querySelector('[data-testimonial-prev]'),next=document.querySelector('[data-testimonial-next]');
    const pagination=carousel.closest('section').querySelector('.hp-stories-pagination');
    const cards=[...carousel.querySelectorAll('.testimonial')];
    let dotCount=0;
    const stride=()=>cards[0].getBoundingClientRect().width+(parseFloat(getComputedStyle(carousel).columnGap)||0);
    const go=index=>carousel.scrollTo({left:Math.min(index*stride(),carousel.scrollWidth-carousel.clientWidth),behavior:reducedMotion.matches?'instant':'smooth'});
    const update=()=>{
      const max=carousel.scrollWidth-carousel.clientWidth;
      prev.disabled=carousel.scrollLeft<3;next.disabled=carousel.scrollLeft>=max-4;
      if(!pagination)return;
      const count=Math.round(max/stride())+1;
      if(count!==dotCount){
        dotCount=count;pagination.replaceChildren(...Array.from({length:count},(_,i)=>{
          const button=document.createElement('button');button.type='button';
          button.setAttribute('aria-label',`Show testimonial ${i+1} of ${cards.length}`);
          button.setAttribute('aria-controls','testimonials');button.addEventListener('click',()=>go(i));return button;
        }));
      }
      const active=Math.min(count-1,Math.round(carousel.scrollLeft/stride()));
      [...pagination.children].forEach((dot,i)=>{dot.classList.toggle('is-active',i===active);if(i===active)dot.setAttribute('aria-current','true');else dot.removeAttribute('aria-current');});
    };
    const move=direction=>{const card=carousel.querySelector('.testimonial');const gap=parseFloat(getComputedStyle(carousel).columnGap)||0;carousel.scrollBy({left:direction*(card.getBoundingClientRect().width+gap),behavior:reducedMotion.matches?'instant':'smooth'});};
    prev.addEventListener('click',()=>move(-1));next.addEventListener('click',()=>move(1));
    carousel.addEventListener('scroll',update,{passive:true});
    carousel.addEventListener('keydown',event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();move(event.key==='ArrowRight'?1:-1);}else if(event.key==='Home'||event.key==='End'){event.preventDefault();go(event.key==='Home'?0:cards.length-1);}});
    window.addEventListener('resize',update);cleanup.push(()=>window.removeEventListener('resize',update));update();
  }
  pageCleanup=()=>cleanup.forEach(fn=>fn());
  onScroll();
}

function onScroll(){
  if(scrollFrame)return;
  scrollFrame=requestAnimationFrame(()=>{
    document.querySelector('.site-header').classList.toggle('scrolled',window.scrollY>30);
    clearTimeout(historySaveTimer);
    if(performance.now()-lastHistorySave>500)saveScrollPosition();
    else historySaveTimer=setTimeout(saveScrollPosition,150);
    const journey=document.querySelector('[data-journey]');
    if(journey){
      const rect=journey.getBoundingClientRect();
      const progress=reducedMotion.matches?1:Math.max(0,Math.min(1,(innerHeight*.82-rect.top)/(rect.height*.7+innerHeight*.22)));
      const line=journey.querySelector('.journey-line').getBoundingClientRect();
      const steps=journey.querySelectorAll('.journey-step');
      journey.style.setProperty('--journey-progress',progress);
      journey.style.setProperty('--journey-travel',String(progress*(innerWidth<=900?line.height:line.width))+'px');
      steps.forEach((step,i)=>step.classList.toggle('is-active',progress>=i/(steps.length-1)));
    }
    scrollFrame=0;
  });
}

async function navigate(url,{pop=false,restore=0}={}){
  const id=++navigationId;
  clearTimeout(historySaveTimer);
  setMenu(false);
  document.querySelector('.nav-services')?.classList.remove('open');
  if(!pop)history.replaceState({...history.state,scroll:window.scrollY},'',location.href);
  document.body.classList.add('is-navigating');
  document.querySelector('main').inert=true;
  document.querySelector('main').setAttribute('aria-busy','true');
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),8000);
  try{
    const [response]=await Promise.all([fetch(url,{signal:controller.signal}),new Promise(resolve=>setTimeout(resolve,reducedMotion.matches?0:300))]);
    if(!response.ok)throw new Error('Navigation unavailable');
    const text=await response.text();
    if(id!==navigationId)return;
    const doc=new DOMParser().parseFromString(text,'text/html');
    if(!doc.querySelector('main'))throw new Error('Invalid page');
    pageCleanup();
    document.title=doc.title;
    document.querySelector('meta[name="description"]').content=doc.querySelector('meta[name="description"]').content;
    document.querySelector('main').replaceWith(doc.querySelector('main'));
    document.querySelector('.site-header').replaceWith(doc.querySelector('.site-header'));
    document.body.dataset.page=doc.body.dataset.page;
    if(!pop)history.pushState({scroll:0},'',url);
    initHeader();initPage();
    window.scrollTo({top:restore,behavior:'instant'});
    const main=document.querySelector('main');main.classList.add('page-enter');main.focus({preventScroll:true});
    if(url.hash){const anchor=document.getElementById(decodeURIComponent(url.hash.slice(1)));anchor?.scrollIntoView({behavior:'instant'});}
  }catch{
    if(id===navigationId)location.assign(url);
  }finally{
    clearTimeout(timeout);
    if(id===navigationId){document.body.classList.remove('is-navigating');document.querySelector('main').inert=false;document.querySelector('main').removeAttribute('aria-busy');}
  }
}

document.addEventListener('click',event=>{
  const link=event.target.closest('a[href]');
  if(!link||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||link.target||link.hasAttribute('download'))return;
  const url=new URL(link.href,location.href);
  if(url.origin!==location.origin||!/^https?:$/.test(url.protocol))return;
  if(url.pathname===location.pathname&&url.search===location.search){
    if(url.hash)return;
    event.preventDefault();setMenu(false);window.scrollTo({top:0,behavior:reducedMotion.matches?'instant':'smooth'});return;
  }
  if(/\.[a-z0-9]+$/i.test(url.pathname)&&!url.pathname.endsWith('index.html'))return;
  event.preventDefault();navigate(url);
});
document.addEventListener('keydown',event=>{
  const open=document.body.classList.contains('menu-open');
  if(event.key==='Escape'){
    if(open)setMenu(false,true);
    const services=document.querySelector('.nav-services');
    if(services.contains(document.activeElement)&&!open)services.querySelector('a').focus();
    services.classList.remove('open');services.classList.add('dismissed');
    document.querySelector('.dropdown-toggle')?.setAttribute('aria-expanded','false');
  }
  if(event.key==='Tab'&&open){
    const focusables=[document.querySelector('.menu-btn'),...document.querySelectorAll('.nav a,.nav button')].filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility==='visible');
    const index=focusables.indexOf(document.activeElement);
    event.preventDefault();
    focusables[(index+(event.shiftKey?-1:1)+focusables.length)%focusables.length].focus();
  }
});
window.addEventListener('resize',()=>{if(innerWidth>900&&document.body.classList.contains('menu-open'))setMenu(false);onScroll();});
window.addEventListener('scroll',onScroll,{passive:true});
window.addEventListener('popstate',event=>navigate(new URL(location.href),{pop:true,restore:event.state?.scroll||0}));
if('scrollRestoration'in history)history.scrollRestoration='manual';
history.replaceState({scroll:window.scrollY},'',location.href);
initHeader();initPage();
document.body.classList.add('initial-reveal');
// A brief brand entrance is bounded and never waits on remote services.
if(!reducedMotion.matches){
  document.body.classList.add('is-navigating');
  const initialNavigation=navigationId;
  setTimeout(()=>{if(navigationId===initialNavigation)document.body.classList.remove('is-navigating');},360);
}
