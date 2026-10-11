const form=document.querySelector('#tracking-form');
const input=document.querySelector('#awb');
const result=document.querySelector('#tracking-result');
const button=form.querySelector('button');
const menuButton=document.querySelector('.track-menu-toggle');
const menu=document.querySelector('#track-nav');
const stages=['Booked','In Transit','Out for Delivery','Delivered'];
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const prettyDate=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return '';const date=new Date(value+'T12:00:00Z');return Number.isNaN(date.getTime())?'':new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Kolkata'}).format(date);};
function render(shipment){
 if(!shipment){result.innerHTML='<div class="track-message" role="status"><strong>Shipment not found</strong><p>Check the number and try again, or contact our team for help.</p></div>';return;}
 const items=[['Origin',shipment.origin],['Destination',shipment.destination],['Booking date',prettyDate(shipment.bookingDate)],['Expected delivery',prettyDate(shipment.expectedDeliveryDate)],['Carrier AWB',shipment.trackingNumber]].filter(([,value])=>value);
 const events=Array.isArray(shipment.history)?shipment.history:[];
 const active=stages.indexOf(shipment.status);
 const progress=active<0?'':`<ol class="track-progress" aria-label="Shipment progress">${stages.map((stage,index)=>`<li class="${index<=active?'done':''} ${index===active?'current':''}"${index===active?' aria-current="step"':''}>${stage}</li>`).join('')}</ol>`;
 result.innerHTML=`<article class="track-card"><div class="track-card-top"><div><span class="track-label">3A Booking Reference</span><h2>${escapeHtml(shipment.reference)}</h2></div><span class="track-status">${escapeHtml(shipment.status)}</span></div>${progress}<div class="track-meta">${items.map(([label,value])=>`<div><span class="track-label">${label}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}</div><h3>Tracking history</h3>${events.length?`<ol class="track-timeline">${events.map(item=>`<li><strong>${escapeHtml(item.status)}</strong><time>${escapeHtml([prettyDate(item.date),item.time].filter(Boolean).join(' · ')||'Date not recorded')}</time></li>`).join('')}</ol>`:'<p>Updates will appear here when our team records them.</p>'}</article>`;
}
async function lookup(reference){
 button.disabled=true;result.innerHTML='<div class="track-message" role="status">Looking up your shipment…</div>';
 try{const response=await fetch('/api/tracking?awb='+encodeURIComponent(reference),{cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.error||'Tracking is temporarily unavailable.');render(data.shipment);}
 catch(error){result.innerHTML='<div class="track-message" role="alert"><strong>Unable to check tracking</strong><p>'+escapeHtml(error.message)+'</p></div>';}
 finally{button.disabled=false;}
}
form.addEventListener('submit',event=>{event.preventDefault();const reference=input.value.trim();if(!reference)return;const url=new URL(location.href);url.searchParams.set('awb',reference);history.replaceState(null,'',url);lookup(reference);});
menuButton.addEventListener('click',()=>{const open=menuButton.getAttribute('aria-expanded')!=='true';menuButton.setAttribute('aria-expanded',String(open));menuButton.setAttribute('aria-label',open?'Close navigation':'Open navigation');menu.classList.toggle('open',open);});
const initial=new URLSearchParams(location.search).get('awb');if(initial){input.value=initial;lookup(initial);}
