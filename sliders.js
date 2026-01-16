(() => {
  "use strict";

  const SECTION_ATTR = "data-wf--main-slider--variant";
  const MQ_MOBILE = matchMedia("(max-width: 991px)");
  const MQ_DESKTOP = matchMedia("(min-width: 992px)");

  const SCROLL_BEHAVIOR = "smooth";
  const SETTLE_DELAY = 120;

  const TA_STEP_MS = 550;
  const TA_WHEEL_MIN = 10;
  const TA_TELEPORT_DELAY_MS = 500;
  const TA_RESIZE_REINIT_MS = 180;

  // GSAP anims
  const SCALE_INACTIVE = 0.5;
  const SCALE_ACTIVE = 1;
  const SCALE_DUR = 0.45;
  const SCALE_EASE = "power2.out";

  const CLIP_ACTIVE = 50; // percent
  const CLIP_INACTIVE = 0;
  const CLIP_DUR = 0.45;
  const CLIP_EASE = "power2.out";

  const hasGSAP = () => typeof window.gsap !== "undefined";

  /* =========================
     BASE SCROLL SLIDER (all variants, except TA desktop)
     ========================= */
  function initBase(section) {
    if (!section || section.__baseV7) return;
    section.__baseV7 = true;

    const variant = section.getAttribute(SECTION_ATTR) || "desktop-and-down";
    if (variant === "ta-custom" && MQ_DESKTOP.matches) return;

    const slider = section.querySelector(".slider");
    if (!slider) return;

    const slides = Array.from(section.querySelectorAll(".main-slide"));
    if (!slides.length) return;

    const dotList = section.querySelector(".slider_dot_list");
    if (!dotList) return;

    const arrowsWrapper = section.querySelector(".slider-arrows-wrapper");
    const prevArrow = arrowsWrapper ? arrowsWrapper.querySelector(".arrow:not(.right)") : null;
    const nextArrow = arrowsWrapper ? arrowsWrapper.querySelector(".arrow.right") : null;

    let dots = Array.from(dotList.querySelectorAll(".slider_dot_item"));
    if (dots.length !== slides.length) {
      dotList.innerHTML = "";
      for (let i = 0; i < slides.length; i++) {
        const item = document.createElement("div");
        item.className = "slider_dot_item";
        const line = document.createElement("div");
        line.className = "slider_dot_line";
        const bg = document.createElement("div");
        bg.className = "slider-dot-bg";
        item.appendChild(line);
        item.appendChild(bg);
        dotList.appendChild(item);
      }
      dots = Array.from(dotList.querySelectorAll(".slider_dot_item"));
    }

    let index = 0;
    let settleTimer = null;

    let isMouseDown = false;
    let startX = 0;
    let startScrollLeft = 0;

    const cx = () => slider.scrollLeft + slider.clientWidth / 2;
    const slideCX = (el) => el.offsetLeft + el.offsetWidth / 2;

    function nearestIndexByScroll() {
      const sl = slider.scrollLeft;
      const vw = slider.clientWidth || 1;
      const sr = sl + vw;
      const tw = slider.scrollWidth || 0;
      const max = slides.length - 1;
      const EPS = 2;

      if (sl <= EPS) return 0;
      if (tw > 0 && Math.abs(tw - sr) <= EPS) return max;

      const c = cx();
      let best = 0, bestD = Infinity;
      for (let i = 0; i < slides.length; i++) {
        const d = Math.abs(slideCX(slides[i]) - c);
        if (d < bestD) { bestD = d; best = i; }
      }
      return best;
    }

    function scrollToIndex(i, behavior = SCROLL_BEHAVIOR) {
      const t = slides[i];
      if (!t) return;

      const sR = slider.getBoundingClientRect();
      const tR = t.getBoundingClientRect();
      const styles = getComputedStyle(slider);
      const padL = parseFloat(styles.paddingLeft) || 0;

      const dx = (tR.left - sR.left) - padL;
      slider.scrollTo({ left: slider.scrollLeft + dx, behavior });
    }

    function setActive(i) {
      index = i;

      for (let s = 0; s < slides.length; s++) {
        const a = s === i;
        slides[s].classList.toggle("is-active", a);
        slides[s].classList.toggle("active", a);

        const nb = slides[s].querySelector(".slider-image.no-blur");
        if (nb) nb.classList.toggle("active", a);

        const h = slides[s].querySelector(".ta-slide-heading");
        if (h) h.classList.toggle("active", a);
      }

      for (let d = 0; d < dots.length; d++) {
        const a = d === i;
        dots[d].classList.toggle("active", a);
        dots[d].setAttribute("aria-current", a ? "true" : "false");
        const line = dots[d].querySelector(".slider_dot_line");
        if (line) {
          line.style.transition = "none";
          line.style.transform = a ? "scaleX(1)" : "scaleX(0)";
        }
      }

      if (prevArrow) prevArrow.classList.toggle("inactive", i === 0);
      if (nextArrow) nextArrow.classList.toggle("inactive", i === slides.length - 1);
    }

    function goTo(i) {
      const next = Math.max(0, Math.min(slides.length - 1, i));
      setActive(next);
      scrollToIndex(next);
    }

    dots.forEach((d, i) => {
      d.setAttribute("role", "button");
      d.setAttribute("tabindex", "0");
      d.addEventListener("click", () => goTo(i));
      d.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goTo(i); }
      });
    });

    if (prevArrow) prevArrow.addEventListener("click", () => {
      if (prevArrow.classList.contains("inactive")) return;
      goTo(index - 1);
    });

    if (nextArrow) nextArrow.addEventListener("click", () => {
      if (nextArrow.classList.contains("inactive")) return;
      goTo(index + 1);
    });

    slider.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      isMouseDown = true;
      startX = e.clientX;
      startScrollLeft = slider.scrollLeft;
      slider.style.scrollSnapType = "none";
      e.preventDefault();
    });

    window.addEventListener("mousemove", (e) => {
      if (!isMouseDown) return;
      slider.scrollLeft = startScrollLeft - (e.clientX - startX);
      e.preventDefault();
    });

    function endDrag() {
      if (!isMouseDown) return;
      isMouseDown = false;
      slider.style.scrollSnapType = "";
    }

    window.addEventListener("mouseup", endDrag);
    slider.addEventListener("mouseleave", endDrag);

    slider.addEventListener("scroll", () => {
      const n = nearestIndexByScroll();
      for (let s = 0; s < slides.length; s++) slides[s].classList.toggle("is-active", s === n);

      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        const nn = nearestIndexByScroll();
        if (nn !== index) setActive(nn);
        if (MQ_MOBILE.matches) scrollToIndex(index);
      }, SETTLE_DELAY);
    }, { passive: true });

    setActive(0);
    if (MQ_MOBILE.matches) scrollToIndex(0, "auto");
  }

  /* =========================
     TA DESKTOP: transform loop + GSAP scale + GSAP clip-path
     ========================= */
  function destroyTA(section) {
    const st = section && section.__taS;
    if (!st) return;

    st.track.removeEventListener("transitionend", st.onEnd);
    st.slider.removeEventListener("wheel", st.onWheel, st.wheelOpts);
    if (st.prevArrow) st.prevArrow.removeEventListener("click", st.onPrev);
    if (st.nextArrow) st.nextArrow.removeEventListener("click", st.onNext);
    st.dots.forEach((d, i) => d.removeEventListener("click", st.onDot[i]));
    window.removeEventListener("resize", st.onResize);

    if (st.tpTimer) clearTimeout(st.tpTimer);
    if (st.unlockTimer) clearTimeout(st.unlockTimer);
    if (st.resizeTimer) clearTimeout(st.resizeTimer);

    // kill GSAP tweens
    if (hasGSAP()) {
      st.scaleTargets.forEach(t => gsap.killTweensOf(t));
      st.clipTargets.forEach(t => gsap.killTweensOf(t));
    }

    // restore DOM: move real slides back and remove track
    const kids = Array.from(st.track.children);
    const start = st.offset, end = st.offset + st.realCount;
    for (let i = start; i < end; i++) st.slider.appendChild(kids[i]);
    st.track.remove();

    delete section.__taS;
    delete section.__taV;
  }

  function initTA(section) {
    if (!section || section.__taV) return;

    const variant = section.getAttribute(SECTION_ATTR);
    if (variant !== "ta-custom") return;
    if (!MQ_DESKTOP.matches) return;

    if (!hasGSAP()) {
      console.warn("[TA slider] GSAP not found.");
      return;
    }

    const slider = section.querySelector(".slider");
    if (!slider) return;
    if (slider.querySelector(".ta-track")) return;

    let realSlides = Array.from(slider.querySelectorAll(":scope > .main-slide"));
    if (!realSlides.length) realSlides = Array.from(slider.querySelectorAll(".main-slide"));
    if (!realSlides.length) return;

    const realCount = realSlides.length;

    // pre-warm real images (reduces blank flash)
    realSlides.forEach(s => {
      s.querySelectorAll("img").forEach(img => {
        try { img.loading = "eager"; img.decode && img.decode().catch(() => {}); } catch (_) {}
      });
    });

    // dots (rebuild to realCount)
    const dotList = section.querySelector(".slider_dot_list");
    let dots = [];
    if (dotList) {
      dotList.innerHTML = "";
      for (let i = 0; i < realCount; i++) {
        const item = document.createElement("div");
        item.className = "slider_dot_item";
        const line = document.createElement("div");
        line.className = "slider_dot_line";
        const bg = document.createElement("div");
        bg.className = "slider-dot-bg";
        item.appendChild(line);
        item.appendChild(bg);
        dotList.appendChild(item);
      }
      dots = Array.from(dotList.querySelectorAll(".slider_dot_item"));
    }

    const arrowsWrapper = section.querySelector(".slider-arrows-wrapper");
    const prevArrow = arrowsWrapper ? arrowsWrapper.querySelector(".arrow:not(.right)") : null;
    const nextArrow = arrowsWrapper ? arrowsWrapper.querySelector(".arrow.right") : null;

    // build track + clones
    const track = document.createElement("div");
    track.className = "ta-track";
    realSlides.forEach(s => track.appendChild(s));
    slider.appendChild(track);

    const leftClones = realSlides.map(s => s.cloneNode(true));
    const rightClones = realSlides.map(s => s.cloneNode(true));
    leftClones.reverse().forEach(c => track.insertBefore(c, track.firstChild));
    rightClones.forEach(c => track.appendChild(c));

    const allSlides = Array.from(track.querySelectorAll(".main-slide"));
    const offset = realCount;

    // GSAP targets
    const scaleTargets = allSlides.map(sl => sl.querySelector(".slide") || sl);
    const clipTargets = allSlides.map(sl => sl.querySelector("img.slider-image.no-blur"));

    // initial states (GSAP owns these)
    gsap.set(scaleTargets, { scale: SCALE_INACTIVE, transformOrigin: "50% 50%" });
    clipTargets.forEach(img => {
      if (!img) return;
      gsap.set(img, {
        clipPath: `circle(${CLIP_INACTIVE}%)`,
        webkitClipPath: `circle(${CLIP_INACTIVE}%)`
      });
    });

    let domPos = offset;
    let locked = false;
    let tpTimer = null;
    let unlockTimer = null;
    let resizeTimer = null;

    function realIndexFromDom(p) {
      const raw = p - offset;
      return ((raw % realCount) + realCount) % realCount;
    }

    function setDots(realIdx) {
      if (!dots.length) return;
      for (let i = 0; i < dots.length; i++) {
        const a = i === realIdx;
        dots[i].classList.toggle("active", a);
        dots[i].setAttribute("aria-current", a ? "true" : "false");
        const line = dots[i].querySelector(".slider_dot_line");
        if (line) {
          line.style.transition = "none";
          line.style.transform = a ? "scaleX(1)" : "scaleX(0)";
        }
      }
    }

    function setActiveClasses(pos) {
      for (let i = 0; i < allSlides.length; i++) {
        const a = i === pos;

        allSlides[i].classList.toggle("is-active", a);
        allSlides[i].classList.toggle("active", a);

        const nb = allSlides[i].querySelector(".slider-image.no-blur");
        if (nb) nb.classList.toggle("active", a);

        const h = allSlides[i].querySelector(".ta-slide-heading");
        if (h) h.classList.toggle("active", a);
      }
      setDots(realIndexFromDom(pos));
    }

    function animateToActive(pos, animate) {
      // prevent double-running
      scaleTargets.forEach(t => gsap.killTweensOf(t));
      clipTargets.forEach(t => t && gsap.killTweensOf(t));

      if (!animate) {
        gsap.set(scaleTargets, { scale: SCALE_INACTIVE });
        gsap.set(scaleTargets[pos], { scale: SCALE_ACTIVE });

        clipTargets.forEach(img => {
          if (!img) return;
          gsap.set(img, {
            clipPath: `circle(${CLIP_INACTIVE}%)`,
            webkitClipPath: `circle(${CLIP_INACTIVE}%)`
          });
        });
        const activeImg = clipTargets[pos];
        if (activeImg) {
          gsap.set(activeImg, {
            clipPath: `circle(${CLIP_ACTIVE}%)`,
            webkitClipPath: `circle(${CLIP_ACTIVE}%)`
          });
        }
        return;
      }

      // scale: all down, active up
      gsap.to(scaleTargets, { scale: SCALE_INACTIVE, duration: SCALE_DUR, ease: SCALE_EASE, overwrite: true });
      gsap.to(scaleTargets[pos], { scale: SCALE_ACTIVE, duration: SCALE_DUR, ease: SCALE_EASE, overwrite: true });

      // clip: all to 0, active to 50
      clipTargets.forEach(img => {
        if (!img) return;
        gsap.to(img, {
          clipPath: `circle(${CLIP_INACTIVE}%)`,
          webkitClipPath: `circle(${CLIP_INACTIVE}%)`,
          duration: CLIP_DUR,
          ease: CLIP_EASE,
          overwrite: true
        });
      });

      const activeImg = clipTargets[pos];
      if (activeImg) {
        gsap.to(activeImg, {
          clipPath: `circle(${CLIP_ACTIVE}%)`,
          webkitClipPath: `circle(${CLIP_ACTIVE}%)`,
          duration: CLIP_DUR,
          ease: CLIP_EASE,
          overwrite: true
        });
      }
    }

    function xForCentered(p) {
      const slide = allSlides[p];
      if (!slide) return 0;
      const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
      const viewportCenter = slider.clientWidth / 2;
      return -(slideCenter - viewportCenter);
    }

    function setTrackX(x, animate) {
      track.style.transition = animate ? `transform ${TA_STEP_MS}ms ease` : "none";
      track.style.transform = `translate3d(${x}px,0,0)`;
    }

    function clearTeleport() { if (tpTimer) { clearTimeout(tpTimer); tpTimer = null; } }
    function clearUnlock() { if (unlockTimer) { clearTimeout(unlockTimer); unlockTimer = null; } }

    function goToDom(p, animate = true) {
      clearTeleport(); clearUnlock();
      if (locked) return;
      locked = true;

      domPos = p;
      setActiveClasses(domPos);
      animateToActive(domPos, animate);
      setTrackX(xForCentered(domPos), animate);

      unlockTimer = setTimeout(() => { locked = false; }, TA_STEP_MS);
    }

    function step(dir) { if (locked) return; goToDom(domPos + dir, true); }

    function teleportTo(newPos) {
      domPos = newPos;
      setActiveClasses(domPos);
      animateToActive(domPos, false); // no re-animation on teleport

      track.style.transition = "none";
      track.style.transform = `translate3d(${xForCentered(domPos)}px,0,0)`;
      track.offsetHeight;
      track.style.transition = `transform ${TA_STEP_MS}ms ease`;
    }

    function scheduleTeleport(newPos) {
      clearTeleport(); clearUnlock();
      locked = true;
      tpTimer = setTimeout(() => {
        tpTimer = null;
        teleportTo(newPos);
        locked = false;
      }, TA_TELEPORT_DELAY_MS);
    }

    function onEnd(e) {
      if (e.propertyName !== "transform") return;

      const leftEnd = offset - 1;
      const rightStart = offset + realCount;

      if (domPos <= leftEnd) scheduleTeleport(domPos + realCount);
      else if (domPos >= rightStart) scheduleTeleport(domPos - realCount);
    }

    function onWheel(e) {
      const dx = e.deltaX || 0;
      const dy = e.deltaY || 0;
      const primary = Math.abs(dy) >= Math.abs(dx) ? dy : dx;
      if (Math.abs(primary) < TA_WHEEL_MIN) return;
      e.preventDefault();
      step(primary > 0 ? 1 : -1);
    }

    function onPrev() { step(-1); }
    function onNext() { step(1); }

    const onDot = dots.map((_, i) => () => {
      if (locked) return;
      goToDom(offset + i, true);
    });

    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        destroyTA(section);
        initBase(section);
        initTA(section);
      }, TA_RESIZE_REINIT_MS);
    }

    // bind
    track.addEventListener("transitionend", onEnd);
    const wheelOpts = { passive: false };
    slider.addEventListener("wheel", onWheel, wheelOpts);
    if (prevArrow) prevArrow.addEventListener("click", onPrev);
    if (nextArrow) nextArrow.addEventListener("click", onNext);
    dots.forEach((d, i) => d.addEventListener("click", onDot[i]));
    window.addEventListener("resize", onResize);

    section.__taS = {
      slider, track, allSlides, realCount, offset, dots, prevArrow, nextArrow,
      scaleTargets, clipTargets,
      onEnd, onWheel, wheelOpts, onPrev, onNext, onDot, onResize,
      tpTimer, unlockTimer, resizeTimer
    };
    section.__taV = true;

    // init state
    setActiveClasses(domPos);
    animateToActive(domPos, false);
    setTrackX(xForCentered(domPos), false);
  }

  function boot(root = document) {
    const sections = Array.from(root.querySelectorAll(`section[${SECTION_ATTR}]`));
    sections.forEach(initBase);
    sections.forEach(initTA);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => boot(document));
  } else {
    boot(document);
  }

  document.addEventListener("swup:page:view", () => boot(document));
})();
