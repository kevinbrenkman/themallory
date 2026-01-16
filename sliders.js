() => {
  "use strict";

  const SECTION_ATTR = "data-wf--main-slider--variant";
  const MQ_MOBILE = window.matchMedia("(max-width: 991px)");
  const MQ_DESKTOP = window.matchMedia("(min-width: 992px)");

  const SCROLL_BEHAVIOR = "smooth";
  const SETTLE_DELAY = 120;

  // TA desktop (transform loop)
  const TA_STEP_MS = 550;
  const TA_WHEEL_MIN = 10;
  const TA_TELEPORT_DELAY_MS = 500; // wait for your path animation to finish
  const TA_RESIZE_REINIT_MS = 180;  // debounce

  /* =========================
     BASE SCROLL SLIDER (all variants, except TA desktop)
     ========================= */
  function initBase(section) {
    if (!section || section.__baseSliderV5) return;
    section.__baseSliderV5 = true;

    const variant = section.getAttribute(SECTION_ATTR) || "desktop-and-down";
    if (variant === "ta-custom" && MQ_DESKTOP.matches) return; // TA desktop handled elsewhere

    const slider = section.querySelector(".slider");
    if (!slider) return;

    const slides = Array.from(section.querySelectorAll(".main-slide"));
    if (!slides.length) return;

    const dotList = section.querySelector(".slider_dot_list");
    if (!dotList) return;

    const arrowsWrapper = section.querySelector(".slider-arrows-wrapper");
    const prevArrow = arrowsWrapper ? arrowsWrapper.querySelector(".arrow:not(.right)") : null;
    const nextArrow = arrowsWrapper ? arrowsWrapper.querySelector(".arrow.right") : null;

    // Build dots to match slides
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
      const scrollLeft = slider.scrollLeft;
      const viewport = slider.clientWidth || 1;
      const scrollRight = scrollLeft + viewport;
      const totalWidth = slider.scrollWidth || 0;
      const maxIndex = slides.length - 1;
      const EDGE_EPS = 2;

      if (scrollLeft <= EDGE_EPS) return 0;
      if (totalWidth > 0 && Math.abs(totalWidth - scrollRight) <= EDGE_EPS) return maxIndex;

      const c = cx();
      let best = 0, bestD = Infinity;
      for (let i = 0; i < slides.length; i++) {
        const d = Math.abs(slideCX(slides[i]) - c);
        if (d < bestD) { bestD = d; best = i; }
      }
      return best;
    }

    function scrollToIndex(i, behavior = SCROLL_BEHAVIOR) {
      const target = slides[i];
      if (!target) return;

      const sliderRect = slider.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const styles = window.getComputedStyle(slider);
      const paddingLeft = parseFloat(styles.paddingLeft) || 0;

      const deltaX = (targetRect.left - sliderRect.left) - paddingLeft;
      slider.scrollTo({ left: slider.scrollLeft + deltaX, behavior });
    }

    function setActive(i) {
      index = i;

      for (let s = 0; s < slides.length; s++) {
        const active = s === i;
        slides[s].classList.toggle("is-active", active);
        slides[s].classList.toggle("active", active);

        const nb = slides[s].querySelector(".slider-image.no-blur");
        if (nb) nb.classList.toggle("active", active);

        const h = slides[s].querySelector(".ta-slide-heading");
        if (h) h.classList.toggle("active", active);
      }

      for (let d = 0; d < dots.length; d++) {
        const active = d === i;
        dots[d].classList.toggle("active", active);
        dots[d].setAttribute("aria-current", active ? "true" : "false");
        const line = dots[d].querySelector(".slider_dot_line");
        if (line) {
          line.style.transition = "none";
          line.style.transform = active ? "scaleX(1)" : "scaleX(0)";
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
     TA DESKTOP LOOP (fixed DOM, invisible teleport, rebuild on resize)
     ========================= */
  function destroyTADesktop(section) {
    const st = section && section.__taState;
    if (!st) return;

    // remove listeners
    st.slider.removeEventListener("wheel", st.onWheel, st.wheelOpts);
    st.track.removeEventListener("transitionend", st.onTransitionEnd);
    window.removeEventListener("resize", st.onResize);

    if (st.prevArrow) st.prevArrow.removeEventListener("click", st.onPrev);
    if (st.nextArrow) st.nextArrow.removeEventListener("click", st.onNext);
    st.dots.forEach((d, i) => d.removeEventListener("click", st.onDotClicks[i]));

    // restore DOM: move real slides back to slider and remove track
    const realStart = st.offset;
    const realEnd = st.offset + st.realCount; // exclusive
    const children = Array.from(st.track.children);

    for (let i = realStart; i < realEnd; i++) {
      const node = children[i];
      if (node) st.slider.appendChild(node);
    }

    st.track.remove();

    // clear timers
    if (st.pendingTeleportTimer) clearTimeout(st.pendingTeleportTimer);
    if (st.unlockTimer) clearTimeout(st.unlockTimer);

    // clear flags so it can re-init cleanly
    delete section.__taState;
    delete section.__taDesktopV6;

    // allow base slider to re-init if we drop to tablet/down
    delete section.__baseSliderV5;
  }

  function initTADesktop(section) {
    if (!section || section.__taDesktopV6) return;

    const variant = section.getAttribute(SECTION_ATTR);
    if (variant !== "ta-custom") return;
    if (!MQ_DESKTOP.matches) return;

    const slider = section.querySelector(".slider");
    if (!slider) return;
    if (slider.querySelector(".ta-track")) return;

    let realSlides = Array.from(slider.querySelectorAll(":scope > .main-slide"));
    if (!realSlides.length) realSlides = Array.from(slider.querySelectorAll(".main-slide"));
    if (!realSlides.length) return;

    const realCount = realSlides.length;

    // Pre-warm real images to reduce blank flash risk
    realSlides.forEach((s) => {
      s.querySelectorAll("img").forEach((img) => {
        try {
          img.loading = "eager";
          if (img.decode) img.decode().catch(() => {});
        } catch (_) {}
      });
    });

    // dots for TA
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

    // track
    const track = document.createElement("div");
    track.className = "ta-track";
    realSlides.forEach(s => track.appendChild(s));
    slider.appendChild(track);

    // clones: [left clones | real | right clones]
    const leftClones = realSlides.map(s => s.cloneNode(true));
    const rightClones = realSlides.map(s => s.cloneNode(true));
    leftClones.reverse().forEach(c => track.insertBefore(c, track.firstChild));
    rightClones.forEach(c => track.appendChild(c));

    const allSlides = Array.from(track.querySelectorAll(".main-slide"));
    const offset = realCount;

    let domPos = offset; // active position in allSlides
    let locked = false;
    let pendingTeleportTimer = null;
    let unlockTimer = null;

    function clearPendingTeleport() {
      if (pendingTeleportTimer) { clearTimeout(pendingTeleportTimer); pendingTeleportTimer = null; }
    }
    function clearUnlockTimer() {
      if (unlockTimer) { clearTimeout(unlockTimer); unlockTimer = null; }
    }

    function freezeScaleTransitionOnce() {
      const els = section.querySelectorAll(".main-slide .slide");
      els.forEach(el => { el.__t = el.style.transition; el.style.transition = "none"; });
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          els.forEach(el => { el.style.transition = el.__t || ""; delete el.__t; });
        });
      });
    }

    function realIndexFromDom(p) {
      const raw = p - offset;
      return ((raw % realCount) + realCount) % realCount;
    }

    function setDots(realIdx) {
      if (!dots.length) return;
      for (let i = 0; i < dots.length; i++) {
        const active = i === realIdx;
        dots[i].classList.toggle("active", active);
        dots[i].setAttribute("aria-current", active ? "true" : "false");
        const line = dots[i].querySelector(".slider_dot_line");
        if (line) {
          line.style.transition = "none";
          line.style.transform = active ? "scaleX(1)" : "scaleX(0)";
        }
      }
    }

    function setActiveOnly(pos) {
      for (let i = 0; i < allSlides.length; i++) {
        const active = i === pos;
        allSlides[i].classList.toggle("is-active", active);
        allSlides[i].classList.toggle("active", active);

        const nb = allSlides[i].querySelector(".slider-image.no-blur");
        if (nb) nb.classList.toggle("active", active);

        const h = allSlides[i].querySelector(".ta-slide-heading");
        if (h) h.classList.toggle("active", active);
      }
      setDots(realIndexFromDom(pos));
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

    function goToDom(p, animate = true) {
      clearPendingTeleport();
      clearUnlockTimer();
      if (locked) return;
      locked = true;

      domPos = p;
      setActiveOnly(domPos);
      setTrackX(xForCentered(domPos), animate);

      unlockTimer = setTimeout(() => { locked = false; }, TA_STEP_MS);
    }

    function step(dir) {
      if (locked) return;
      goToDom(domPos + dir, true);
    }

    // Invisible teleport that preserves “active” without re-animating:
    // add active to target first (frozen), snap, then remove active from old (still frozen)
    function invisibleTeleport(fromPos, toPos) {
      freezeScaleTransitionOnce();

      // keep both active for this snap (no transitions, so no visible change)
      allSlides[fromPos].classList.add("is-active", "active");
      allSlides[toPos].classList.add("is-active", "active");

      // keep inner toggles correct on target too
      {
        const nb = allSlides[toPos].querySelector(".slider-image.no-blur");
        if (nb) nb.classList.add("active");
        const h = allSlides[toPos].querySelector(".ta-slide-heading");
        if (h) h.classList.add("active");
      }

      // snap track atomically
      track.style.transition = "none";
      track.style.transform = `translate3d(${xForCentered(toPos)}px,0,0)`;
      track.offsetHeight; // force reflow
      track.style.transition = `transform ${TA_STEP_MS}ms ease`;

      // now it’s safe to drop active from the old clone (still frozen)
      allSlides[fromPos].classList.remove("is-active", "active");
      {
        const nb = allSlides[fromPos].querySelector(".slider-image.no-blur");
        if (nb) nb.classList.remove("active");
        const h = allSlides[fromPos].querySelector(".ta-slide-heading");
        if (h) h.classList.remove("active");
      }

      domPos = toPos;
      setDots(realIndexFromDom(domPos));
    }

    function scheduleTeleport(toPos) {
      clearPendingTeleport();
      clearUnlockTimer();
      locked = true; // hold while your path animation finishes

      const fromPos = domPos;

      pendingTeleportTimer = setTimeout(() => {
        pendingTeleportTimer = null;
        invisibleTeleport(fromPos, toPos);
        locked = false;
      }, TA_TELEPORT_DELAY_MS);
    }

    function onTransitionEnd(e) {
      if (e.propertyName !== "transform") return;

      const leftEnd = offset - 1;
      const rightStart = offset + realCount;

      if (domPos <= leftEnd) {
        scheduleTeleport(domPos + realCount);
      } else if (domPos >= rightStart) {
        scheduleTeleport(domPos - realCount);
      }
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

    // dots click → jump to real set position (no looping needed here)
    const onDotClicks = dots.map((_, i) => () => {
      if (locked) return;
      goToDom(offset + i, true);
    });

    // bind
    track.addEventListener("transitionend", onTransitionEnd);
    const wheelOpts = { passive: false };
    slider.addEventListener("wheel", onWheel, wheelOpts);
    if (prevArrow) prevArrow.addEventListener("click", onPrev);
    if (nextArrow) nextArrow.addEventListener("click", onNext);
    dots.forEach((d, i) => d.addEventListener("click", onDotClicks[i]));

    // reinit on resize (destroy + rebuild)
    let resizeTimer = null;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        // always destroy + restart, as requested
        destroyTADesktop(section);
        // re-boot this section only
        initBase(section);
        initTADesktop(section);
      }, TA_RESIZE_REINIT_MS);
    }
    window.addEventListener("resize", onResize);

    // store state for teardown
    section.__taState = {
      slider, track, allSlides, realCount, offset,
      prevArrow, nextArrow, dots,
      onWheel, wheelOpts, onTransitionEnd,
      onPrev, onNext, onDotClicks,
      onResize,
      pendingTeleportTimer, unlockTimer
    };

    section.__taDesktopV6 = true;

    // init
    setActiveOnly(domPos);
    setTrackX(xForCentered(domPos), false);
  }

  function boot(root = document) {
    const sections = Array.from(root.querySelectorAll(`section[${SECTION_ATTR}]`));
    sections.forEach(initBase);
    sections.forEach(initTADesktop);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => boot(document));
  } else {
    boot(document);
  }

  document.addEventListener("swup:page:view", () => boot(document));
})();
