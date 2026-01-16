(() => {
  "use strict";

  const SECTION_ATTR="data-wf--main-slider--variant";
  const MQ_MOBILE=matchMedia("(max-width: 991px)");
  const MQ_DESKTOP=matchMedia("(min-width: 992px)");

  const SCROLL_BEHAVIOR="smooth";
  const SETTLE_DELAY=120;

  const TA_STEP_MS=550;
  const TA_WHEEL_MIN=10;
  const TA_TELEPORT_DELAY_MS=500;
  const TA_RESIZE_REINIT_MS=180;

  // visuals timing (after centered)
  const TA_ACTIVE_DELAY_MS = 250;      // image no-blur active
  const TA_HEADING_DELAY_MS = 250;     // heading active after that

  // touch axis lock (mobile ta-custom base)
  const SWIPE_LOCK_PX = 10;

  function sections(root=document){
    return [...root.querySelectorAll(`section[${SECTION_ATTR}]`)];
  }

  function ensureScrollbarCSS(){
    if(document.getElementById("kb-hide-x-scrollbar")) return;
    const style = document.createElement("style");
    style.id = "kb-hide-x-scrollbar";
    style.textContent = `
      .js-hide-x-scrollbar{ scrollbar-width:none; -ms-overflow-style:none; }
      .js-hide-x-scrollbar::-webkit-scrollbar{ display:none; }
      .ta-track{ will-change: transform; transform: translate3d(0,0,0); }
    `;
    document.head.appendChild(style);
  }

  /* =========================
     BASE (unchanged behavior + mobile ta axis lock)
     ========================= */
  function destroyBase(section){
    const st=section && section.__baseS;
    if(!st){ delete section.__baseV; return; }

    st.slider.removeEventListener("scroll", st.onScroll, st.scrollOpts);
    st.slider.removeEventListener("mousedown", st.onDown);
    window.removeEventListener("mousemove", st.onMove);
    window.removeEventListener("mouseup", st.onUp);
    st.slider.removeEventListener("mouseleave", st.onLeave);

    st.slider.removeEventListener("touchstart", st.onTStart, st.tOpts);
    st.slider.removeEventListener("touchmove", st.onTMove, st.tOpts);
    st.slider.removeEventListener("touchend", st.onTEnd);
    st.slider.removeEventListener("touchcancel", st.onTEnd);

    if(st.prevArrow) st.prevArrow.removeEventListener("click", st.onPrev);
    if(st.nextArrow) st.nextArrow.removeEventListener("click", st.onNext);
    st.dots.forEach((d,i)=>d.removeEventListener("click", st.onDot[i]));
    st.dots.forEach((d,i)=>d.removeEventListener("keydown", st.onKey[i]));
    if(st.settleTimer) clearTimeout(st.settleTimer);

    delete section.__baseS;
    delete section.__baseV;
  }

  function initBase(section){
    if(!section || section.__baseV) return;

    const variant = section.getAttribute(SECTION_ATTR) || "desktop-and-down";
    if(variant==="ta-custom" && MQ_DESKTOP.matches) return;

    ensureScrollbarCSS();

    const slider = section.querySelector(".slider");
    if(!slider) return;

    slider.classList.add("js-hide-x-scrollbar");

    if(slider.querySelector(".ta-track")) destroyTA(section);

    const slides = [...section.querySelectorAll(".main-slide")];
    if(!slides.length) return;

    const dotList = section.querySelector(".slider_dot_list");
    if(!dotList) return;

    const arrowsWrapper = section.querySelector(".slider-arrows-wrapper");
    const prevArrow = arrowsWrapper ? arrowsWrapper.querySelector(".arrow:not(.right)") : null;
    const nextArrow = arrowsWrapper ? arrowsWrapper.querySelector(".arrow.right") : null;

    let dots = [...dotList.querySelectorAll(".slider_dot_item")];
    if(dots.length !== slides.length){
      dotList.innerHTML="";
      for(let i=0;i<slides.length;i++){
        const item=document.createElement("div"); item.className="slider_dot_item";
        const line=document.createElement("div"); line.className="slider_dot_line";
        const bg=document.createElement("div"); bg.className="slider-dot-bg";
        item.appendChild(line); item.appendChild(bg); dotList.appendChild(item);
      }
      dots=[...dotList.querySelectorAll(".slider_dot_item")];
    }

    const isTaMobile = (variant==="ta-custom" && !MQ_DESKTOP.matches);
    if(isTaMobile){
      slider.style.overflowX="auto";
      slider.style.overflowY="hidden";
      slider.style.webkitOverflowScrolling="touch";
      slider.style.scrollSnapType="none";
      slider.style.touchAction="pan-y";
    }

    let index=0, settleTimer=null;
    let isMouseDown=false, startX=0, startScrollLeft=0;

    const cx=()=>slider.scrollLeft + slider.clientWidth/2;
    const slideCX=(el)=>el.offsetLeft + el.offsetWidth/2;

    function nearestIndexByScroll(){
      const sl=slider.scrollLeft;
      const vw=slider.clientWidth||1;
      const sr=sl+vw;
      const tw=slider.scrollWidth||0;
      const max=slides.length-1;
      const EPS=2;
      if(sl<=EPS) return 0;
      if(tw>0 && Math.abs(tw-sr)<=EPS) return max;

      const c=cx();
      let best=0, bestD=1e18;
      for(let i=0;i<slides.length;i++){
        const d=Math.abs(slideCX(slides[i]) - c);
        if(d<bestD){ bestD=d; best=i; }
      }
      return best;
    }

    function scrollToIndex(i, behavior=SCROLL_BEHAVIOR){
      const t=slides[i]; if(!t) return;
      const sR=slider.getBoundingClientRect();
      const tR=t.getBoundingClientRect();
      const styles=getComputedStyle(slider);
      const padL=parseFloat(styles.paddingLeft)||0;
      const dx=(tR.left - sR.left) - padL;
      slider.scrollTo({ left: slider.scrollLeft + dx, behavior });
    }

    function setActive(i){
      index=i;
      for(let s=0;s<slides.length;s++){
        const a=s===i;
        slides[s].classList.toggle("is-active",a);
        slides[s].classList.toggle("active",a);
        const nb=slides[s].querySelector(".slider-image.no-blur"); if(nb) nb.classList.toggle("active",a);
        const h=slides[s].querySelector(".ta-slide-heading"); if(h) h.classList.toggle("active",a);
      }
      for(let d=0;d<dots.length;d++){
        const a=d===i;
        dots[d].classList.toggle("active",a);
        dots[d].setAttribute("aria-current",a?"true":"false");
        const line=dots[d].querySelector(".slider_dot_line");
        if(line){ line.style.transition="none"; line.style.transform=a?"scaleX(1)":"scaleX(0)"; }
      }
      if(prevArrow) prevArrow.classList.toggle("inactive", i===0);
      if(nextArrow) nextArrow.classList.toggle("inactive", i===slides.length-1);
    }

    function goTo(i){
      const next = Math.max(0, Math.min(slides.length-1, i));
      setActive(next);
      scrollToIndex(next);
    }

    const onDot = dots.map((_,i)=>()=>goTo(i));
    const onKey = dots.map((_,i)=>e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); goTo(i);} });
    dots.forEach((d,i)=>{
      d.setAttribute("role","button"); d.setAttribute("tabindex","0");
      d.addEventListener("click", onDot[i]);
      d.addEventListener("keydown", onKey[i]);
    });

    function onPrev(){ if(prevArrow && !prevArrow.classList.contains("inactive")) goTo(index-1); }
    function onNext(){ if(nextArrow && !nextArrow.classList.contains("inactive")) goTo(index+1); }
    if(prevArrow) prevArrow.addEventListener("click", onPrev);
    if(nextArrow) nextArrow.addEventListener("click", onNext);

    function onDown(e){
      if(e.button!==0) return;
      isMouseDown=true; startX=e.clientX; startScrollLeft=slider.scrollLeft;
      e.preventDefault();
    }
    function onMove(e){
      if(!isMouseDown) return;
      slider.scrollLeft = startScrollLeft - (e.clientX - startX);
      e.preventDefault();
    }
    function endDrag(){ if(!isMouseDown) return; isMouseDown=false; }
    function onUp(){ endDrag(); }
    function onLeave(){ endDrag(); }

    slider.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    slider.addEventListener("mouseleave", onLeave);

    function onScroll(){
      const n=nearestIndexByScroll();
      for(let s=0;s<slides.length;s++) slides[s].classList.toggle("is-active", s===n);
      clearTimeout(settleTimer);
      settleTimer=setTimeout(()=>{
        const nn=nearestIndexByScroll();
        if(nn!==index) setActive(nn);
        if(MQ_MOBILE.matches) scrollToIndex(index);
      }, SETTLE_DELAY);
    }
    const scrollOpts={passive:true};
    slider.addEventListener("scroll", onScroll, scrollOpts);

    let tStartX=0, tStartY=0, axis=null, tActive=false;
    function onTStart(e){
      if(!isTaMobile) return;
      if(!e.touches || e.touches.length!==1) return;
      tActive=true; axis=null;
      tStartX=e.touches[0].clientX;
      tStartY=e.touches[0].clientY;
    }
    function onTMove(e){
      if(!isTaMobile || !tActive) return;
      if(!e.touches || e.touches.length!==1) return;
      const x=e.touches[0].clientX, y=e.touches[0].clientY;
      const dx=x-tStartX, dy=y-tStartY;

      if(!axis){
        if(Math.abs(dx)<SWIPE_LOCK_PX && Math.abs(dy)<SWIPE_LOCK_PX) return;
        axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      }
      if(axis==="x") e.preventDefault();
    }
    function onTEnd(){
      if(!isTaMobile || !tActive) return;
      tActive=false;
      if(axis!=="x") return;

      const n = nearestIndexByScroll();
      const delta = n - index;
      if(delta > 0) goTo(index + 1);
      else if(delta < 0) goTo(index - 1);
      else scrollToIndex(index);

      axis=null;
    }
    const tOpts={passive:false};
    slider.addEventListener("touchstart", onTStart, tOpts);
    slider.addEventListener("touchmove", onTMove, tOpts);
    slider.addEventListener("touchend", onTEnd);
    slider.addEventListener("touchcancel", onTEnd);

    section.__baseV=1;
    setActive(0);
    if(MQ_MOBILE.matches) scrollToIndex(0,"auto");

    section.__baseS={
      slider,dots,prevArrow,nextArrow,
      onDot,onKey,onPrev,onNext,
      onDown,onMove,onUp,onLeave,
      onScroll,scrollOpts,settleTimer,
      onTStart,onTMove,onTEnd,tOpts
    };
  }

  /* =========================
     TA DESKTOP (Safari-fast + correct scaling)
     ========================= */
  function destroyTA(section){
    const st=section && section.__taS;
    if(!st){ delete section.__taV; return; }

    st.track.removeEventListener("transitionend", st.onEnd);
    st.slider.removeEventListener("wheel", st.onWheel, st.wheelOpts);
    if(st.prevArrow) st.prevArrow.removeEventListener("click", st.onPrev);
    if(st.nextArrow) st.nextArrow.removeEventListener("click", st.onNext);
    st.dots.forEach((d,i)=>d.removeEventListener("click", st.onDot[i]));
    window.removeEventListener("resize", st.onResize);

    if(st.tpTimer) clearTimeout(st.tpTimer);
    if(st.unlockTimer) clearTimeout(st.unlockTimer);
    if(st.resizeTimer) clearTimeout(st.resizeTimer);
    if(st.fallbackTimer) clearTimeout(st.fallbackTimer);
    if(st.v1) clearTimeout(st.v1);
    if(st.v2) clearTimeout(st.v2);

    const kids=[...st.track.children];
    const start=st.offset, end=st.offset+st.realCount;
    for(let i=start;i<end;i++) st.slider.appendChild(kids[i]);
    st.track.remove();

    delete section.__taS;
    delete section.__taV;
  }

  function initTA(section){
    if(!section||section.__taV)return;
    const variant=section.getAttribute(SECTION_ATTR);
    if(variant!=="ta-custom") return;
    if(!MQ_DESKTOP.matches) return;

    ensureScrollbarCSS();

    const slider=section.querySelector(".slider");
    if(!slider) return;
    if(slider.querySelector(".ta-track")) return;

    slider.classList.add("js-hide-x-scrollbar");

    let realSlides=[...slider.querySelectorAll(":scope > .main-slide")];
    if(!realSlides.length) realSlides=[...slider.querySelectorAll(".main-slide")];
    if(!realSlides.length) return;

    const realCount=realSlides.length;

    const dotList=section.querySelector(".slider_dot_list");
    let dots=[];
    if(dotList){
      dotList.innerHTML="";
      for(let i=0;i<realCount;i++){
        const item=document.createElement("div"); item.className="slider_dot_item";
        const line=document.createElement("div"); line.className="slider_dot_line";
        const bg=document.createElement("div"); bg.className="slider-dot-bg";
        item.appendChild(line); item.appendChild(bg); dotList.appendChild(item);
      }
      dots=[...dotList.querySelectorAll(".slider_dot_item")];
    }

    const arrowsWrapper=section.querySelector(".slider-arrows-wrapper");
    const prevArrow=arrowsWrapper?arrowsWrapper.querySelector(".arrow:not(.right)") : null;
    const nextArrow=arrowsWrapper?arrowsWrapper.querySelector(".arrow.right") : null;

    const track=document.createElement("div");
    track.className="ta-track";
    realSlides.forEach(s=>track.appendChild(s));
    slider.appendChild(track);

    const leftClones=realSlides.map(s=>s.cloneNode(true));
    const rightClones=realSlides.map(s=>s.cloneNode(true));
    leftClones.reverse().forEach(c=>track.insertBefore(c,track.firstChild));
    rightClones.forEach(c=>track.appendChild(c));

    const allSlides=[...track.querySelectorAll(".main-slide")];
    const offset=realCount;

    // cache parts
    const parts = allSlides.map(s => ({
      slide: s,
      inner: s.querySelector(".slide"),
      nb: s.querySelector(".slider-image.no-blur"),
      h: s.querySelector(".ta-slide-heading")
    }));

    // movement measurement
    let baseCenter=0, stepSize=0, slideW=0;
    function measure(){
      const a = allSlides[offset];
      const b = allSlides[offset+1] || a;
      slideW = a.offsetWidth || 1;
      const aL = a.offsetLeft;
      const bL = b.offsetLeft;
      stepSize = Math.max(1, (bL - aL) || slideW);
      baseCenter = (allSlides[0].offsetLeft + slideW/2);
    }
    function xForCentered(p){
      const slideCenter = baseCenter + p * stepSize;
      const viewportCenter = slider.clientWidth / 2;
      return -(slideCenter - viewportCenter);
    }
    measure();

    let domPos=offset;
    let prevPos=-1;
    let locked=false;

    let tpTimer=null, unlockTimer=null, resizeTimer=null, fallbackTimer=null;
    let v1=null, v2=null;

    function clearVisualTimers(){
      if(v1){ clearTimeout(v1); v1=null; }
      if(v2){ clearTimeout(v2); v2=null; }
    }

    function realIndexFromDom(p){
      const raw=p-offset;
      return ((raw%realCount)+realCount)%realCount;
    }

    function setDots(realIdx){
      if(!dots.length) return;
      for(let i=0;i<dots.length;i++){
        const a=i===realIdx;
        dots[i].classList.toggle("active",a);
        dots[i].setAttribute("aria-current",a?"true":"false");
        const line=dots[i].querySelector(".slider_dot_line");
        if(line){ line.style.transition="none"; line.style.transform=a?"scaleX(1)":"scaleX(0)"; }
      }
    }

    // FIX: ensure inactive slides scale down by removing active + is-active
    function clearPos(p){
      if(p<0) return;
      const o=parts[p];
      o.slide.classList.remove("is-active","active");
      if(o.nb) o.nb.classList.remove("active");
      if(o.h) o.h.classList.remove("active");
    }

    function activateImage(p){
      const o=parts[p];
      o.slide.classList.add("is-active","active");
      if(o.nb) o.nb.classList.add("active");
    }

    function activateHeading(p){
      const o=parts[p];
      if(o.h) o.h.classList.add("active");
    }

    function setTrackX(x,animate){
      track.style.transition = animate ? `transform ${TA_STEP_MS}ms ease` : "none";
      track.style.transform  = `translate3d(${x}px,0,0)`;
    }

    function clearTeleport(){ if(tpTimer){clearTimeout(tpTimer); tpTimer=null;} }
    function clearUnlock(){ if(unlockTimer){clearTimeout(unlockTimer); unlockTimer=null;} }
    function clearFallback(){ if(fallbackTimer){clearTimeout(fallbackTimer); fallbackTimer=null;} }

    function freezeTwoSlides(a,b){
      const els=[];
      const A=parts[a], B=parts[b];
      if(A && A.inner) els.push(A.inner);
      if(A && A.nb) els.push(A.nb);
      if(A && A.h) els.push(A.h);
      if(B && B.inner) els.push(B.inner);
      if(B && B.nb) els.push(B.nb);
      if(B && B.h) els.push(B.h);
      els.forEach(el=>{ el.__t=el.style.transition; el.style.transition="none"; });
      return () => {
        requestAnimationFrame(()=>requestAnimationFrame(()=>{
          els.forEach(el=>{ el.style.transition=el.__t||""; delete el.__t; });
        }));
      };
    }

    function invisibleTeleport(fromPos,toPos){
      clearVisualTimers();

      const unfreeze = freezeTwoSlides(fromPos, toPos);

      track.style.transition="none";
      track.style.transform=`translate3d(${xForCentered(toPos)}px,0,0)`;
      track.offsetHeight;

      domPos = toPos;

      // clear both old positions and force correct active
      clearPos(fromPos);
      clearPos(prevPos);

      activateImage(domPos);
      activateHeading(domPos);
      setDots(realIndexFromDom(domPos));
      prevPos = domPos;

      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        unfreeze();
        track.style.transition=`transform ${TA_STEP_MS}ms ease`;
      }));
    }

    function scheduleTeleport(toPos){
      clearTeleport(); clearUnlock(); clearFallback();
      locked=true;
      tpTimer=setTimeout(()=>{
        tpTimer=null;
        invisibleTeleport(domPos, toPos);
        locked=false;
      }, TA_TELEPORT_DELAY_MS);
    }

    function teleportCheck(){
      const leftEnd = offset - 1;
      const rightStart = offset + realCount;
      if(domPos <= leftEnd) scheduleTeleport(domPos + realCount);
      else if(domPos >= rightStart) scheduleTeleport(domPos - realCount);
    }

    function scheduleTeleportFallback(){
      clearFallback();
      fallbackTimer = setTimeout(teleportCheck, TA_STEP_MS + 60);
    }

    // IMPORTANT: visuals start after transitionend, but inactive must already be inactive
    function onCentered(){
      clearVisualTimers();
      setDots(realIndexFromDom(domPos));

      v1 = setTimeout(() => {
        activateImage(domPos);
      }, TA_ACTIVE_DELAY_MS);

      v2 = setTimeout(() => {
        activateHeading(domPos);
      }, TA_ACTIVE_DELAY_MS + TA_HEADING_DELAY_MS);
    }

    function goToDom(p, animate=true){
      clearTeleport(); clearUnlock(); clearFallback(); clearVisualTimers();
      if(locked) return;
      locked=true;

      // FIX: clear previous ACTIVE immediately so it explains scaling down
      clearPos(prevPos);

      domPos = p;
      setDots(realIndexFromDom(domPos));
      setTrackX(xForCentered(domPos), !!animate);

      unlockTimer = setTimeout(()=>{ locked=false; }, TA_STEP_MS);
      scheduleTeleportFallback();
    }

    function step(dir){ if(locked) return; goToDom(domPos + dir, true); }

    function onEnd(e){
      if(e.propertyName !== "transform") return;

      // centered -> apply delayed "active" for target
      onCentered();

      // then handle clone wrapping
      teleportCheck();

      // remember current as prev (so next step can clear it)
      prevPos = domPos;
    }

    function onWheel(e){
      const dx = e.deltaX || 0;
      const dy = e.deltaY || 0;
      if(Math.abs(dx) <= Math.abs(dy)) return;
      if(Math.abs(dx) < TA_WHEEL_MIN) return;
      e.preventDefault();
      step(dx > 0 ? 1 : -1);
    }

    function onPrev(){ step(-1); }
    function onNext(){ step(1); }
    const onDot = dots.map((_,i)=>()=>{ if(locked) return; goToDom(offset + i, true); });

    function onResize(){
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(()=>{
        destroyTA(section);
        destroyBase(section);
        initBase(section);
        initTA(section);
      }, TA_RESIZE_REINIT_MS);
    }

    track.addEventListener("transitionend", onEnd);
    const wheelOpts={passive:false};
    slider.addEventListener("wheel", onWheel, wheelOpts);
    if(prevArrow) prevArrow.addEventListener("click", onPrev);
    if(nextArrow) nextArrow.addEventListener("click", onNext);
    dots.forEach((d,i)=>d.addEventListener("click", onDot[i]));
    window.addEventListener("resize", onResize);

    section.__taS={
      slider,track,allSlides,realCount,offset,dots,prevArrow,nextArrow,
      onEnd,onWheel,wheelOpts,onPrev,onNext,onDot,onResize,
      tpTimer,unlockTimer,resizeTimer,fallbackTimer,v1,v2
    };
    section.__taV=1;

    // init: set all slides inactive, then activate current
    for(let i=0;i<parts.length;i++) clearPos(i);
    setTrackX(xForCentered(domPos), false);

    requestAnimationFrame(() => {
      activateImage(domPos);
      activateHeading(domPos);
      setDots(realIndexFromDom(domPos));
      prevPos = domPos;
    });
  }

  /* =========================
     BOOT + HANDOFF
     ========================= */
  function boot(root=document){
    const secs=sections(root);
    secs.forEach(initBase);
    secs.forEach(initTA);
  }

  function handoff(){
    sections(document).forEach(sec=>{
      const v=sec.getAttribute(SECTION_ATTR)||"desktop-and-down";
      if(v!=="ta-custom") return;
      const slider = sec.querySelector(".slider");

      if(MQ_DESKTOP.matches){
        destroyBase(sec);
        destroyTA(sec);
        if(slider) slider.scrollLeft = 0;
        initTA(sec);
      } else {
        destroyTA(sec);
        destroyBase(sec);
        if(slider) slider.scrollLeft = 0;
        initBase(sec);
      }
    });
  }

  let lastDesktop = MQ_DESKTOP.matches;
  window.addEventListener("resize", ()=>{
    const now = MQ_DESKTOP.matches;
    if(now === lastDesktop) return;
    lastDesktop = now;
    handoff();
  });

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",()=>{ boot(document); handoff(); });
  } else {
    boot(document); handoff();
  }

  document.addEventListener("swup:page:view",()=>{ boot(document); handoff(); });
})();
