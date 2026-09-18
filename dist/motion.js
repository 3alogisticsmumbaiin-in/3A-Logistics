// One motion lifecycle per page: observers and event frames are released on navigation.
export function initMotion({reducedMotion,finePointer}) {
  const controller=new AbortController();
  const {signal}=controller;
  const frames=new Set();
  const observers=[];
  let disposed=false;
  const frame=callback=>{const id=requestAnimationFrame(time=>{frames.delete(id);if(!disposed)callback(time);});frames.add(id);return id;};
  const main=document.querySelector('main');
  const moving=[];
  const cleanup=()=>{
    disposed=true;controller.abort();observers.forEach(observer=>observer.disconnect());
    frames.forEach(cancelAnimationFrame);
    moving.forEach(el=>{['--tilt-x','--tilt-y','--magnet-x','--magnet-y','--drift-x','--drift-y','--parallax-y'].forEach(key=>el.style.removeProperty(key));});
    document.querySelectorAll('main .reveal,.footer-editorial .reveal').forEach(el=>el.classList.add('visible'));
    main.querySelectorAll('[data-count]').forEach(el=>el.textContent=el.dataset.count);
    document.documentElement.classList.remove('motion-paused');
  };
  document.body.classList.add('motion-ready');
  const hero=main.querySelector('.hp-hero');
  const motionToggle=hero?.querySelector('.hp-motion-toggle');
  motionToggle?.addEventListener('click',()=>{
    const paused=hero.classList.toggle('motion-user-paused');
    motionToggle.setAttribute('aria-pressed',String(paused));
    motionToggle.setAttribute('aria-label',paused?'Resume hero animation':'Pause hero animation');
    motionToggle.textContent=paused?'▶':'Ⅱ';
  },{signal});
  // Section 03 controls share this lifecycle, including reduced-motion mode.
  const process=main.querySelector('.hp-process');
  if(process){
    const steps=[...process.querySelectorAll('.journey-step')];
    const prev=process.querySelector('[data-process-prev]');
    const next=process.querySelector('[data-process-next]');
    const current=process.querySelector('.hp-process-current');
    if(prev&&next&&current&&steps.length){
      let selected=0;
      const select=index=>{
        selected=Math.max(0,Math.min(steps.length-1,index));
        steps.forEach((step,i)=>{step.classList.toggle('is-selected',i===selected);if(i===selected)step.setAttribute('aria-current','step');else step.removeAttribute('aria-current');});
        current.textContent=`${String(selected+1).padStart(2,'0')} — ${String(steps.length).padStart(2,'0')}`;
        prev.disabled=selected===0;next.disabled=selected===steps.length-1;
      };
      prev.addEventListener('click',()=>select(selected-1),{signal});
      next.addEventListener('click',()=>select(selected+1),{signal});
      select(0);
    }
  }
  // Country links remain normal navigation links; hover and keyboard focus highlight their routes.
  const network=main.querySelector('.hp-network');
  network?.querySelectorAll('[data-destination]').forEach(link=>{
    const route=network.querySelector(`[data-map-destination="${link.dataset.destination}"]`);
    const highlight=()=>route?.classList.add('is-highlighted');
    const clear=()=>route?.classList.remove('is-highlighted');
    link.addEventListener('pointerenter',highlight,{signal});
    link.addEventListener('pointerleave',()=>{if(document.activeElement!==link)clear();},{signal});
    link.addEventListener('focus',highlight,{signal});
    link.addEventListener('blur',clear,{signal});
  });
  if(reducedMotion.matches||!('IntersectionObserver' in window)){
    document.querySelectorAll('main .reveal,.footer-editorial .reveal').forEach(el=>el.classList.add('visible'));
    return cleanup;
  }

  const sceneObserver=new IntersectionObserver(entries=>{
    entries.forEach(({target,isIntersecting})=>target.classList.toggle('motion-in-view',isIntersecting));
  },{rootMargin:'60px 0px'});
  main.querySelectorAll('section').forEach(section=>sceneObserver.observe(section));
  observers.push(sceneObserver);
  const visibility=()=>document.documentElement.classList.toggle('motion-paused',document.hidden);
  document.addEventListener('visibilitychange',visibility,{signal});
  visibility();

  const counters=new WeakSet();
  function count(el){
    if(counters.has(el))return;
    counters.add(el);
    const target=Number(el.dataset.count);
    if(!Number.isFinite(target))return;
    const start=performance.now();
    function step(now){const t=Math.min((now-start)/1050,1);el.textContent=Math.round(target*(1-(1-t)**3));if(t<1)frame(step);}
    frame(step);
  }
  const revealObserver=new IntersectionObserver(entries=>{
    for(const {target,isIntersecting} of entries){
      if(!isIntersecting)continue;
      target.classList.add('visible');
      if(target.matches('[data-count]'))count(target);
      target.querySelectorAll('[data-count]').forEach(count);
      revealObserver.unobserve(target);
    }
  },{threshold:.06,rootMargin:'0px 0px -16px 0px'});
  observers.push(revealObserver);
  // Homepage entrances share the same one-shot observer and navigation cleanup.
  main.querySelectorAll('.hp-home .hero-copy>*:not(h1),.hp-home .hero-copy h1,.hp-home .hp-hero-bottom,.hp-home .hp-business-logistics,.hp-home .hp-network-controls').forEach((el,index)=>{
    el.dataset.reveal='fade-up';
    el.style.setProperty('--delay',`${Math.min(index*55,220)}ms`);
  });
  document.querySelectorAll('.footer-editorial .footer-grid>div,.footer-editorial .footer-bottom').forEach((el,i)=>{
    el.dataset.reveal='fade-up';el.style.setProperty('--delay',`${Math.min(i*70,210)}ms`);
    el.classList.add('reveal');revealObserver.observe(el);
  });
  main.querySelectorAll('[data-stagger],.service-grid,.approach-grid,.page-services-grid,.page-process,.page-milestones,.page-form-grid,.tx-form-grid').forEach(group=>{
    [...group.children].forEach((child,index)=>{
      if(child.matches('script,style,legend,input[type="hidden"]'))return;
      child.dataset.reveal ||= 'fade-up';
      child.style.setProperty('--delay',`${Math.min(index*65,260)}ms`);
    });
  });
  main.querySelectorAll('[data-reveal],.section-heading,.network-copy,.network-visual,.journey-step,.why-copy,.why-image,.business-inner,.page-feature,.page-office,.page-service-card,.page-milestones,.network-stats,.page-contact-method,.page-contact-form>label,.tx-field,[data-count]').forEach(el=>{
    if(el.matches('.network-visual'))el.dataset.reveal='scale';
    if(el.matches('.why-image'))el.dataset.reveal='mask';
    el.classList.add('reveal');revealObserver.observe(el);
  });
  // Focus must never land in a visually hidden field while reveals are pending.
  main.addEventListener('focusin',event=>{
    let el=event.target;
    while(el&&el!==main){if(el.classList?.contains('reveal'))el.classList.add('visible');el=el.parentElement;}
  },{signal});

  if(finePointer.matches){
    main.querySelectorAll('[data-tilt],.tilt-card,.hp-home .hp-service-card,.page-service-card:not(.page-service-help),.page-industry-card').forEach(card=>{
      card.classList.add('motion-tilt');moving.push(card);
      let pending=false,last;
      card.addEventListener('pointermove',event=>{
        last=event;if(pending)return;pending=true;
        frame(()=>{pending=false;if(!last)return;const r=card.getBoundingClientRect();const x=(last.clientX-r.left)/r.width-.5,y=(last.clientY-r.top)/r.height-.5;
          card.style.setProperty('--tilt-x',`${-y*5}deg`);card.style.setProperty('--tilt-y',`${x*6}deg`);
        });
      },{signal,passive:true});
      card.addEventListener('pointerleave',()=>{last=null;card.style.setProperty('--tilt-x','0deg');card.style.setProperty('--tilt-y','0deg');},{signal});
    });
    main.querySelectorAll('.hero-actions .btn,.cta-actions .btn,.page-cta .btn,.interior-hero .page-actions .btn,.hp-home .hp-services-heading .btn,.hp-home .hp-about-copy .btn,.hp-home .network-copy>.btn,.hp-home .hp-business-action .btn').forEach(button=>{
      moving.push(button);let pending=false,last;
      button.addEventListener('pointermove',event=>{
        last=event;if(pending)return;pending=true;
        frame(()=>{pending=false;if(!last)return;const r=button.getBoundingClientRect();button.style.setProperty('--magnet-x',`${(last.clientX-r.left-r.width/2)*.055}px`);button.style.setProperty('--magnet-y',`${(last.clientY-r.top-r.height/2)*.08}px`);});
      },{signal,passive:true});
      button.addEventListener('pointerleave',()=>{last=null;button.style.setProperty('--magnet-x','0px');button.style.setProperty('--magnet-y','0px');},{signal});
    });
    main.querySelectorAll('.hero,.interior-hero').forEach(hero=>{
      moving.push(hero);let pending=false,last;
      hero.addEventListener('pointermove',event=>{
        last=event;if(pending)return;pending=true;
        frame(()=>{pending=false;if(!last)return;const r=hero.getBoundingClientRect();const x=(last.clientX-r.left)/r.width-.5,y=(last.clientY-r.top)/r.height-.5;
          hero.style.setProperty('--drift-x',`${x*12}px`);hero.style.setProperty('--drift-y',`${y*9}px`);
        });
      },{signal,passive:true});
      hero.addEventListener('pointerleave',()=>{last=null;hero.style.setProperty('--drift-x','0px');hero.style.setProperty('--drift-y','0px');},{signal});
    });
    const layers=[...main.querySelectorAll('[data-parallax],.page-contact-map>img,.why-image>img')];
    moving.push(...layers);
    let scrollPending=false;
    const parallax=()=>{
      if(scrollPending)return;scrollPending=true;
      frame(()=>{scrollPending=false;for(const el of layers){const r=el.parentElement.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight)continue;const amount=Number(el.dataset.parallax)||10;el.style.setProperty('--parallax-y',`${Math.max(-amount,Math.min(amount,(innerHeight/2-r.top-r.height/2)/innerHeight*amount*2))}px`);}});
    };
    window.addEventListener('scroll',parallax,{signal,passive:true});
    parallax();
  }
  return cleanup;
}
