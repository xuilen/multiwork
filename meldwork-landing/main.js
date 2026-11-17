/* ============================================================
   multiwork Landing — interaction engine
   React Bits ports in vanilla JS:
   · SplitText (per-character staggered rise)
   · DecryptedText (scramble → resolve)
   · CountUp
   · ScrollReveal (IntersectionObserver)
   · SpotlightCard + TiltedCard (mouse position)
   · LogoLoop (CSS marquee)
   · ScrollVelocity (scroll-aware marquee speed)
   · Magnet (mouse-follow on CTAs)
   · GlareHover (CSS-driven shine)
   · Stepper (scenario timeline)
   · Accordion (FAQ)
   · ScrollProgress + ScrollSpy
   · Mobile menu + Escape + a11y
   ============================================================ */

(function () {
  "use strict";
  var doc = document;
  var win = window;
  var reduced = win.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* =========================================================
     1. SPLIT TEXT — wrap each char of .data-split lines in <span class="ch">
     ========================================================= */
  function splitText(el) {
    if (!el || el.dataset.splitDone) return 1;
    el.dataset.splitDone = "1";
    var lines = el.querySelectorAll(".hl-line, [data-split-line]");
    if (!lines.length) lines = [el];
    var globalIndex = 0;
    var baseDelay = parseFloat(el.dataset.splitDelay || "0.04");
    lines.forEach(function (line) {
      // capture existing inner HTML, wrap each word/char carefully
      var raw = line.textContent;
      line.textContent = "";
      // Preserve words so spacing stays right; per-char inside each word.
      var words = doc.documentElement.lang === "zh-CN"
        ? raw.match(/[A-Za-z0-9]+|[^\sA-Za-z0-9]|\s+/g) || []
        : raw.split(/(\s+)/);
      words.forEach(function (token) {
        if (/^\s+$/.test(token)) {
          line.appendChild(document.createTextNode(token));
          return;
        }
        var wordSpan = document.createElement("span");
        wordSpan.className = "word";
        for (var i = 0; i < token.length; i++) {
          var ch = document.createElement("span");
          ch.className = "ch";
          ch.textContent = token[i];
          var delay = (globalIndex * baseDelay).toFixed(3);
          ch.style.setProperty("--cd", delay + "s");
          wordSpan.appendChild(ch);
          globalIndex++;
        }
        line.appendChild(wordSpan);
      });
    });
    return globalIndex;
  }

  // Hero headline
  var headline = doc.getElementById("headline");
  if (headline) {
    var n = splitText(headline);
    function playHeadline() {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { headline.classList.add("play"); });
      });
    }
    if (reduced) headline.classList.add("play");
    else if (doc.readyState === "complete") setTimeout(playHeadline, 80);
    else win.addEventListener("load", playHeadline, { once: true });
    // safety net
    setTimeout(playHeadline, 1400);
  }

  // Final CTA title (same .data-split API)
  var finalTitle = doc.querySelector(".final-title");
  if (finalTitle) {
    var totalChars = splitText(finalTitle);
    if ("IntersectionObserver" in win) {
      var ftObs = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            finalTitle.classList.add("play");
            ftObs.disconnect();
          }
        });
      }, { threshold: 0.4 });
      ftObs.observe(finalTitle);
    } else {
      finalTitle.classList.add("play");
    }
  }

  doc.addEventListener("meldwork:localechange", function () {
    [headline, finalTitle].forEach(function (el) {
      if (!el) return;
      delete el.dataset.splitDone;
      splitText(el);
      el.classList.add("play");
    });
  });

  /* =========================================================
     2. DECRYPTED TEXT — scramble the eyebrow on entrance
     ========================================================= */
  var CHARS = "!<>-_\\/[]{}—=+*^?#|01█▓▒░";
  function decrypt(el) {
    if (!el || el.dataset.decryptDone || reduced) {
      if (el) el.dataset.decryptDone = "1";
      return;
    }
    el.dataset.decryptDone = "1";
    el.classList.add("is-scrambling");
    var target = el.dataset.text || el.textContent;
    var duration = 900;
    var start = performance.now();
    function frame(now) {
      if (el.dataset.text && el.dataset.text !== target) return;
      var p = Math.min((now - start) / duration, 1);
      var revealCount = Math.floor(target.length * p);
      var out = "";
      for (var i = 0; i < target.length; i++) {
        var ch = target[i];
        if (i < revealCount || ch === " ") { out += ch; continue; }
        // random for not-yet-revealed, keep punctuation
        if (/[·\-,&]/.test(ch)) { out += ch; continue; }
        out += CHARS[Math.floor(Math.random() * CHARS.length)];
      }
      el.textContent = out;
      if (p < 1) requestAnimationFrame(frame);
      else { el.textContent = target; el.classList.remove("is-scrambling"); }
    }
    requestAnimationFrame(frame);
  }
  var decryptEls = doc.querySelectorAll("[data-decrypt]");
  decryptEls.forEach(function (el) {
    function start() { decrypt(el); }
    if (doc.readyState === "complete") setTimeout(start, 220);
    else win.addEventListener("load", start, { once: true });
    setTimeout(start, 1600);
  });

  /* =========================================================
     3. SCROLL REVEAL — IntersectionObserver for [data-reveal]
        Section eyebrows also get the DecryptedText treatment
        the first time they scroll into view.
     ========================================================= */
  var revealEls = doc.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in win && !reduced) {
    var revealObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          if (entry.target.classList.contains("eyebrow")) decrypt(entry.target);
          revealObs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
    revealEls.forEach(function (el) { revealObs.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("revealed"); });
  }

  /* Workflow coral line draw — triggered when the steps scroll into view */
  var stepsSection = doc.querySelector("[data-steps]");
  if (stepsSection) {
    if ("IntersectionObserver" in win && !reduced) {
      var stepsObs = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            stepsSection.classList.add("revealed");
            stepsObs.disconnect();
          }
        });
      }, { threshold: 0.3 });
      stepsObs.observe(stepsSection);
    } else {
      stepsSection.classList.add("revealed");
    }
  }

  /* =========================================================
     4. COUNT UP — hero stats
     ========================================================= */
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function countUp(el, index) {
    var target = parseFloat(el.dataset.target);
    var decimals = parseInt(el.dataset.decimals || "0", 10);
    if (reduced) { el.textContent = target.toFixed(decimals); return; }
    var duration = 1500 + index * 90;
    setTimeout(function () {
      var start = performance.now();
      function frame(now) {
        var p = Math.min((now - start) / duration, 1);
        el.textContent = (target * easeOutCubic(p)).toFixed(decimals);
        if (p < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }, 520 + index * 90);
  }
  var stats = doc.getElementById("stats");
  var counted = false;
  function runCounts() {
    if (counted || !stats) return;
    counted = true;
    stats.querySelectorAll(".count").forEach(countUp);
  }
  if (stats) {
    if ("IntersectionObserver" in win) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) { runCounts(); io.disconnect(); }
        });
      }, { threshold: 0.25 });
      io.observe(stats);
    } else runCounts();
  }

  /* =========================================================
     5. SPOTLIGHT CARD — mouse position CSS vars
     ========================================================= */
  doc.querySelectorAll(".spotlight").forEach(function (card) {
    card.addEventListener("mousemove", function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty("--sx", ((e.clientX - r.left) / r.width * 100) + "%");
      card.style.setProperty("--sy", ((e.clientY - r.top) / r.height * 100) + "%");
    });
    card.addEventListener("mouseleave", function () {
      card.style.setProperty("--sx", "50%");
      card.style.setProperty("--sy", "50%");
    });
  });

  /* =========================================================
     6. TILTED CARD — mouse 3D rotate (cap-card, shot)
     ========================================================= */
  function attachTilt(sel, max) {
    doc.querySelectorAll(sel).forEach(function (card) {
      var rect;
      function onMove(e) {
        if (!rect) rect = card.getBoundingClientRect();
        var cx = rect.left + rect.width / 2;
        var cy = rect.top + rect.height / 2;
        var dx = (e.clientX - cx) / rect.width;
        var dy = (e.clientY - cy) / rect.height;
        var rx = (-dy * max).toFixed(2);
        var ry = (dx * max).toFixed(2);
        card.style.transform = "perspective(800px) rotateX(" + rx + "deg) rotateY(" + ry + "deg) translateZ(0)";
      }
      function onLeave() { card.style.transform = ""; rect = null; }
      card.addEventListener("mouseenter", function () { rect = card.getBoundingClientRect(); });
      card.addEventListener("mousemove", onMove);
      card.addEventListener("mouseleave", onLeave);
    });
  }
  attachTilt(".cap-card", 4);
  attachTilt(".shot", 3);

  /* =========================================================
     7. MAGNET — CTAs gently follow the cursor
     ========================================================= */
  doc.querySelectorAll(".magnet").forEach(function (btn) {
    var strength = 14;
    var rect;
    function onMove(e) {
      if (!rect) rect = btn.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var tx = ((e.clientX - cx) / rect.width) * strength;
      var ty = ((e.clientY - cy) / rect.height) * strength;
      btn.style.transform = "translate(" + tx.toFixed(2) + "px, " + ty.toFixed(2) + "px)";
    }
    function reset() { btn.style.transform = ""; rect = null; }
    btn.addEventListener("mouseenter", function () { rect = btn.getBoundingClientRect(); });
    btn.addEventListener("mousemove", onMove);
    btn.addEventListener("mouseleave", reset);
  });

  /* =========================================================
     8. SCROLL VELOCITY — rAF-driven marquee whose speed and
        direction follow the scroll velocity (React Bits port)
     ========================================================= */
  var velocityTrack = doc.querySelector("[data-velocity] .velocity-track");
  if (velocityTrack) {
    if (reduced) {
      velocityTrack.style.transform = "none";
    } else {
      var vx = 0;                 // signed scroll velocity (px/frame, smoothed)
      var vLastY = win.scrollY;
      var vLastT = performance.now();
      var vPos = 0;               // current translate offset in px
      function vTick(now) {
        var dt = Math.min((now - vLastT) / 1000, 0.05);
        vLastT = now;
        var dy = win.scrollY - vLastY;
        vLastY = win.scrollY;
        // ease toward the instantaneous scroll velocity, then decay
        vx += (dy * 2.4 - vx) * 0.1;
        if (vx > 620) vx = 620;
        if (vx < -620) vx = -620;
        // base drift is always leftward; scrolling down accelerates,
        // scrolling up hard enough briefly reverses the direction
        vPos += (42 + vx) * dt;
        var half = velocityTrack.scrollWidth / 2;
        if (half > 0) {
          vPos = ((vPos % half) + half) % half; // keep in [0, half)
          velocityTrack.style.transform = "translateX(" + (-vPos).toFixed(2) + "px)";
        }
        requestAnimationFrame(vTick);
      }
      requestAnimationFrame(vTick);
    }
  }

  /* =========================================================
     9. SCENARIO STEPPER — auto-cycle the timeline
     ========================================================= */
  var scenario = doc.querySelector("[data-scenario]");
  if (scenario) {
    var steps = scenario.querySelectorAll(".t-step");
    var total = steps.length;
    var current = 0;
    var isInView = false;
    var paused = false;
    var autoTimer = null;
    var scnMode = reduced ? "order" : "auto";
    var feed = scenario.querySelector("[data-timeline]");
    var seats = scenario.querySelectorAll("[data-agent]");
    var railStatus = scenario.querySelector("[data-status]");
    var roundLabel = scenario.querySelector("[data-round]");
    var pauseButton = scenario.querySelector("[data-pause]");
    var runStatus = scenario.querySelector("[data-run-status]");
    var segBtns = scenario.querySelectorAll(".seg-btn");
    var roundNames = ["Task", "Round 1 · Request", "Round 1 · Analysis", "Round 1 · Review", "Round 2 · Synthesis"];
    var runningNames = ["Codex is working…", "Hermes and OpenCodeReview are working…",
      "OpenCodeReview is working…", "Codex is bringing the feedback together…", "Codex is bringing the feedback together…"];
    var paragraphs = Array.from(steps, function (step) { return step.querySelector("p"); });
    var originals = paragraphs.map(function (p) { return { en: p.innerHTML, zh: p.dataset.zh }; });
    var typed = 0;
    var stage = "typing";
    function translate(text) { return win.meldworkI18n.t(text); }
    function markup(i) { return originals[i][doc.documentElement.lang === "zh-CN" ? "zh" : "en"]; }
    function renderText(i, count) {
      var p = paragraphs[i];
      p.innerHTML = markup(i);
      var walker = doc.createTreeWalker(p, NodeFilter.SHOW_TEXT);
      var nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(function (node) {
        var chars = Array.from(node.nodeValue);
        node.nodeValue = chars.slice(0, count).join("");
        count = Math.max(0, count - chars.length);
      });
    }
    function textLength(i) {
      var template = doc.createElement("template");
      template.innerHTML = markup(i);
      return Array.from(template.content.textContent).length;
    }
    function setStep(idx, animate) {
      current = Math.max(0, Math.min(total - 1, idx));
      typed = animate ? 0 : textLength(current);
      stage = animate ? "typing" : "reading";
      render();
    }
    function render() {
      steps.forEach(function (step, i) {
        step.classList.toggle("is-visible", i <= current);
        step.classList.toggle("is-active", i === current);
        step.hidden = scnMode !== "order" && i > current;
        if (i === current) step.setAttribute("aria-current", "step");
        else step.removeAttribute("aria-current");
        renderText(i, scnMode === "order" || i !== current ? textLength(i) : typed);
      });
      var states = [["Working", "Waiting", "Waiting"], ["Working", "Waiting", "Waiting"],
        ["Waiting", "Working", "Working"], ["Waiting", "Done", "Working"], ["Working", "Done", "Done"]][current].slice();
      if (current === 1 && stage !== "typing") states = ["Waiting", stage === "thinking" ? "Thinking" : "Working", stage === "thinking" ? "Thinking" : "Working"];
      if (current === 2 && stage !== "typing") states[1] = "Done";
      if (current === 3 && stage !== "typing") states = ["Working", "Done", "Done"];
      if (current === 4 && stage !== "typing") states = ["Done", "Done", "Done"];
      if (scnMode === "order") states = ["Done", "Done", "Done"];
      seats.forEach(function (seat, i) {
        seat.dataset.state = states[i].toLowerCase();
        seat.querySelector("[data-agent-status]").textContent = translate(states[i]);
      });
      scenario.dataset.phase = stage;
      feed.scrollTop = scnMode === "order" ? 0 : feed.scrollHeight;
      railStatus.textContent = (current + 1) + " / " + total;
      roundLabel.textContent = translate(roundNames[current]);
      scenario.querySelector("[data-prev]").disabled = current === 0;
      scenario.querySelector("[data-next]").disabled = current === total - 1;
      pauseButton.textContent = translate(paused ? "Resume" : "Pause");
      pauseButton.setAttribute("aria-pressed", String(paused));
    }
    function stopAuto() {
      clearTimeout(autoTimer);
      autoTimer = null;
      scenario.dataset.playback = "paused";
      runStatus.hidden = true;
    }
    function scheduleNext() {
      stopAuto();
      if (!isInView || paused || reduced || doc.hidden || scnMode !== "auto") return;
      scenario.dataset.playback = "playing";
      runStatus.textContent = translate(current === 1 && stage === "typing" ? "Codex is working…" :
        current === 1 && stage === "thinking" ? "Hermes and OpenCodeReview are thinking…" : runningNames[current]);
      runStatus.hidden = false;
      var delay = stage === "typing" ? 35 : stage === "thinking" ? 1300 : current === total - 1 ? 4200 : current === 1 ? 1800 : 1600;
      autoTimer = setTimeout(function () {
        if (stage === "typing") {
          typed = Math.min(textLength(current), typed + (doc.documentElement.lang === "zh-CN" ? 1 : 2));
          if (typed >= textLength(current)) stage = current === 1 ? "thinking" : "reading";
          render();
        } else if (stage === "thinking") {
          stage = "reading";
          render();
        } else {
          setStep(current === total - 1 ? 0 : current + 1, true);
        }
        scheduleNext();
      }, delay);
    }
    function manualStep(idx) { paused = true; setStep(idx, false); scheduleNext(); }
    scenario.querySelector("[data-prev]").addEventListener("click", function () { manualStep(current - 1); });
    scenario.querySelector("[data-next]").addEventListener("click", function () { manualStep(current + 1); });
    pauseButton.addEventListener("click", function () { paused = !paused; render(); scheduleNext(); });
    scenario.addEventListener("keydown", function (event) {
      if (scnMode !== "auto" || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      manualStep(event.key === "Home" ? 0 : event.key === "End" ? total - 1 : current + (event.key === "ArrowRight" ? 1 : -1));
    });
    function setMode(mode) {
      scnMode = mode;
      scenario.classList.toggle("is-order", mode === "order");
      segBtns.forEach(function (button) {
        var selected = button.dataset.mode === mode;
        button.classList.toggle("is-on", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
      if (mode === "auto") setStep(current, !paused && !reduced);
      else render();
      scheduleNext();
    }
    segBtns.forEach(function (button) {
      button.addEventListener("click", function () { setMode(button.dataset.mode); });
    });
    doc.addEventListener("visibilitychange", scheduleNext);
    doc.addEventListener("meldwork:localechange", function () {
      typed = stage === "typing" ? Math.min(typed, textLength(current)) : textLength(current);
      render(); scheduleNext();
    });
    if ("IntersectionObserver" in win) {
      new IntersectionObserver(function (entries) {
        isInView = entries[0].isIntersecting;
        scheduleNext();
      }, { threshold: 0.15 }).observe(scenario);
    } else isInView = true;
    setMode(scnMode);
  }

  /* =========================================================
     10. FAQ ACCORDION
     ========================================================= */
  doc.querySelectorAll(".acc-item").forEach(function (item) {
    var trigger = item.querySelector(".acc-trigger");
    var panel = item.querySelector(".acc-panel");
    trigger.addEventListener("click", function () {
      var isOpen = item.classList.contains("is-open");
      // close siblings
      doc.querySelectorAll(".acc-item.is-open").forEach(function (o) {
        if (o !== item) {
          o.classList.remove("is-open");
          o.querySelector(".acc-trigger").setAttribute("aria-expanded", "false");
          o.querySelector(".acc-panel").style.maxHeight = "";
        }
      });
      item.classList.toggle("is-open", !isOpen);
      trigger.setAttribute("aria-expanded", String(!isOpen));
      panel.style.maxHeight = !isOpen ? panel.scrollHeight + "px" : "";
    });
  });

  /* =========================================================
     11. NAV — scrolled state, scroll spy, mobile menu
     ========================================================= */
  var nav = doc.getElementById("topnav");
  function setNavScrolled() {
    if (!nav) return;
    if (win.scrollY > 8) nav.classList.add("scrolled");
    else nav.classList.remove("scrolled");
  }
  setNavScrolled();
  win.addEventListener("scroll", setNavScrolled, { passive: true });

  var spyLinks = doc.querySelectorAll("[data-spy]");
  var spyTargets = {};
  spyLinks.forEach(function (a) {
    var id = a.dataset.spy;
    var t = doc.getElementById(id);
    if (t) spyTargets[id] = { link: a, el: t };
  });
  function spy() {
    var y = win.scrollY + win.innerHeight * 0.35;
    var bestId = null;
    var bestTop = -Infinity;
    Object.keys(spyTargets).forEach(function (id) {
      var el = spyTargets[id].el;
      if (!el) return;
      var top = el.getBoundingClientRect().top + win.scrollY;
      if (top <= y && top > bestTop) { bestId = id; bestTop = top; }
    });
    spyLinks.forEach(function (a) {
      a.classList.toggle("active", a.dataset.spy === bestId);
    });
  }
  spy();
  win.addEventListener("scroll", spy, { passive: true });

  // Mobile menu
  var burger = doc.getElementById("burger");
  var overlay = doc.getElementById("overlay");
  var menu = doc.getElementById("mobileMenu");
  function setMenu(open) {
    if (!burger) return;
    burger.setAttribute("aria-expanded", String(open));
    overlay.hidden = !open;
    menu.hidden = !open;
    doc.body.classList.toggle("menu-open", open);
  }
  burger.addEventListener("click", function () {
    setMenu(burger.getAttribute("aria-expanded") !== "true");
  });
  overlay.addEventListener("click", function () { setMenu(false); });
  menu.addEventListener("click", function (e) {
    if (e.target.closest("a")) setMenu(false);
  });
  win.addEventListener("resize", function () {
    if (win.innerWidth > 860) setMenu(false);
  });

  // Global Escape
  win.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (burger && burger.getAttribute("aria-expanded") === "true") setMenu(false);
  });

  /* =========================================================
     12. SCROLL PROGRESS BAR
     ========================================================= */
  var progressBar = doc.querySelector(".scroll-progress span");
  function progress() {
    if (!progressBar) return;
    var max = doc.documentElement.scrollHeight - win.innerHeight;
    var p = max > 0 ? Math.min(win.scrollY / max, 1) : 0;
    progressBar.style.width = (p * 100) + "%";
  }
  progress();
  win.addEventListener("scroll", progress, { passive: true });
  win.addEventListener("resize", progress);

  /* =========================================================
     13c. CLICK SPARK — coral particle burst on primary CTAs
          (the "acceptance point" moment, per DESIGN.md).
     ========================================================= */
  function clickSpark(x, y) {
    if (reduced) return;
    var count = 12;
    for (var i = 0; i < count; i++) {
      var s = doc.createElement("span");
      s.className = "spark";
      var ang = (Math.PI * 2 * i) / count + Math.random() * 0.6;
      var dist = 16 + Math.random() * 30;
      s.style.setProperty("--tx", (Math.cos(ang) * dist).toFixed(1) + "px");
      s.style.setProperty("--ty", (Math.sin(ang) * dist).toFixed(1) + "px");
      s.style.left = x + "px";
      s.style.top = y + "px";
      doc.body.appendChild(s);
      (function (el) {
        setTimeout(function () { el.remove(); }, 620);
      })(s);
    }
  }
  doc.querySelectorAll(".cta-primary").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      clickSpark(e.clientX || 0, e.clientY || 0);
    });
  });

  /* =========================================================
     15. CARD SWAP — React Bits CardSwap port (vanilla JS)
        Single-rAF timeline coordinator: all cards update in one
        tick per frame for buttery smooth swaps.
        Front card drops+fades while rest shift forward, then
        front returns to back with elastic ease.
     ========================================================= */
  var csStage = doc.querySelector("[data-card-swap]");
  if (csStage) {
    var csCards = Array.prototype.slice.call(csStage.querySelectorAll(".cs-card"));
    var csInfos = doc.querySelectorAll(".cs-info-item");
    var csTotal = csCards.length;
    var csDelay = 2000;
    var csCardDist = 40;     // x-axis spacing (tighter to prevent overflow)
    var csVertDist = 45;     // y-axis spacing
    var csSkew = 5;          // skewY degrees
    var csDropDist = 50;     // drop distance (small, combined with opacity)
    var csTotalDur = 1000;   // total swap duration (ms)
    var csInView = false;
    var csAutoTimer = null;
    var csAnimating = false;
    var csOrder = csCards.map(function (_, i) { return i; });

    // Keep horizontal spacing proportional to the container so the
    // centered stack always fits inside overflow:hidden bounds.
    function csComputeDist() {
      var w = csStage.clientWidth || 560;
      csCardDist = Math.max(22, Math.min(40, Math.round(w * 0.07)));
    }

    function elasticOut(t) {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      var p = 0.4;
      return Math.pow(2, -9 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
    }
    function powerInOut(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    // makeSlot — centered stack: cards fan symmetrically around midpoint
    function makeSlot(i, distX, distY, total) {
      var centerX = -(total - 1) * distX / 2;
      return {
        x: centerX + i * distX,
        y: -i * distY,
        z: -i * distX * 1.5,
        zIndex: total - i
      };
    }

    // Set card transform + opacity in one shot
    function placeCard(el, slot, opacity) {
      el.style.transform =
        "translate(-50%, -50%) " +
        "translate3d(" + slot.x.toFixed(1) + "px, " + slot.y.toFixed(1) + "px, " + slot.z.toFixed(1) + "px) " +
        "skewY(" + csSkew + "deg)";
      el.style.zIndex = String(slot.zIndex);
      if (opacity !== undefined) el.style.opacity = opacity.toFixed(2);
    }

    // Initialize card positions
    csComputeDist();
    csCards.forEach(function (card, i) {
      var slot = makeSlot(i, csCardDist, csVertDist, csTotal);
      placeCard(card, slot, 1);
    });

    function csUpdateInfo(activeIdx) {
      csInfos.forEach(function (info, i) {
        info.classList.toggle("is-active", i === activeIdx);
      });
    }

    // Single-rAF swap: all cards update in one rAF tick per frame
    function csSwap() {
      if (csAnimating || csOrder.length < 2) return;
      csAnimating = true;

      var front = csOrder[0];
      var rest = csOrder.slice(1);
      var elFront = csCards[front];
      var frontSlot = makeSlot(0, csCardDist, csVertDist, csTotal);
      var backSlot = makeSlot(csTotal - 1, csCardDist, csVertDist, csTotal);
      var startT = performance.now();

      // Update info immediately for snappy visual feedback
      csUpdateInfo(rest[0]);

      function tick(now) {
        var elapsed = now - startT;
        var p = Math.min(elapsed / csTotalDur, 1);

        // --- Front card: drop+fade (0→0.42), then return to back (0.42→1) ---
        var fX, fY, fZ, fO;
        if (p < 0.42) {
          var dp = p / 0.42;
          var de = powerInOut(dp);
          fX = frontSlot.x;
          fY = frontSlot.y + csDropDist * de;
          fZ = frontSlot.z;
          fO = 1 - de * 0.85;          // fade to 0.15
          elFront.style.zIndex = "0";   // go behind all
        } else {
          var rp = (p - 0.42) / 0.58;
          var re = elasticOut(rp);
          var dropY = frontSlot.y + csDropDist;
          fX = frontSlot.x + (backSlot.x - frontSlot.x) * re;
          fY = dropY + (backSlot.y - dropY) * re;
          fZ = frontSlot.z + (backSlot.z - frontSlot.z) * re;
          fO = 0.15 + 0.85 * re;        // fade back to 1
          elFront.style.zIndex = String(backSlot.zIndex);
        }
        elFront.style.transform =
          "translate(-50%, -50%) " +
          "translate3d(" + fX.toFixed(1) + "px, " + fY.toFixed(1) + "px, " + fZ.toFixed(1) + "px) " +
          "skewY(" + csSkew + "deg)";
        elFront.style.opacity = fO.toFixed(2);

        // --- Rest cards: shift forward (0→0.72) ---
        var mp = Math.min(p / 0.72, 1);
        var me = elasticOut(mp);
        rest.forEach(function (cardIdx, i) {
          var el = csCards[cardIdx];
          var oldSlot = makeSlot(i + 1, csCardDist, csVertDist, csTotal);
          var newSlot = makeSlot(i, csCardDist, csVertDist, csTotal);
          var x = oldSlot.x + (newSlot.x - oldSlot.x) * me;
          var y = oldSlot.y + (newSlot.y - oldSlot.y) * me;
          var z = oldSlot.z + (newSlot.z - oldSlot.z) * me;
          el.style.zIndex = String(newSlot.zIndex);
          el.style.transform =
            "translate(-50%, -50%) " +
            "translate3d(" + x.toFixed(1) + "px, " + y.toFixed(1) + "px, " + z.toFixed(1) + "px) " +
            "skewY(" + csSkew + "deg)";
          el.style.opacity = "1";
        });

        if (p < 1) {
          requestAnimationFrame(tick);
        } else {
          csAnimating = false;
          csOrder = rest.concat([front]);
        }
      }
      requestAnimationFrame(tick);
    }

    function csStartAuto() {
      csStopAuto();
      if (!reduced) csAutoTimer = setInterval(csSwap, csDelay);
    }
    function csStopAuto() {
      if (csAutoTimer) { clearInterval(csAutoTimer); csAutoTimer = null; }
    }

    csUpdateInfo(0);
    if ("IntersectionObserver" in win) {
      var csObs = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          csInView = entry.isIntersecting;
          if (csInView) csStartAuto();
          else csStopAuto();
        });
      }, { threshold: 0.25 });
      csObs.observe(csStage);
    }
    csStage.addEventListener("mouseenter", csStopAuto);
    csStage.addEventListener("mouseleave", function () { if (csInView) csStartAuto(); });

    // Re-flow the stack when the container width changes
    win.addEventListener("resize", function () {
      if (csAnimating) return;
      csComputeDist();
      csCards.forEach(function (card, i) {
        placeCard(card, makeSlot(i, csCardDist, csVertDist, csTotal), 1);
      });
    });
  }

  /* =========================================================
     16. THEME TOGGLE — dark/light switch with localStorage
     ========================================================= */
  var themeToggle = doc.getElementById("themeToggle");
  var themeRoot = doc.documentElement;
  var THEME_KEY = "meldwork-landing-theme";

  function getStoredTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }
  function storeTheme(t) {
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
  }
  // Capture dark-theme srcs at init (before any theme is applied)
  doc.querySelectorAll("[data-theme-src]").forEach(function (img) {
    img.setAttribute("data-dark-src", img.getAttribute("src"));
  });

  function applyTheme(t) {
    if (themeToggle) themeToggle.setAttribute("aria-pressed", String(t === "light"));
    if (t === "light") themeRoot.setAttribute("data-theme", "light");
    else themeRoot.removeAttribute("data-theme");
    // Swap logo srcs
    doc.querySelectorAll("[data-theme-src]").forEach(function (img) {
      var lightSrc = img.getAttribute("data-theme-src");
      var darkSrc = img.getAttribute("data-dark-src");
      img.setAttribute("src", t === "light" ? lightSrc : darkSrc);
    });
    doc.dispatchEvent(new CustomEvent("meldwork:themechange"));
  }

  applyTheme(getStoredTheme() === "light" ? "light" : "dark");

  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      var current = themeRoot.getAttribute("data-theme") === "light" ? "light" : "dark";
      var next = current === "light" ? "dark" : "light";
      applyTheme(next);
      storeTheme(next);
    });
  }

})();
