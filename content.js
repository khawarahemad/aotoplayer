// ================================================================
// Auto Video Player v3.1 — GFG / YouTube / Udemy / Coursera
// ================================================================
// KEY ARCHITECTURE:
//   manifest matches "*://*/*" + all_frames:true
//   → script runs in EVERY frame including cross-origin video iframes
//
//   FRAME ROLES:
//   [TOP GFG frame]  : idle-bypass heartbeat + Next/NextTrack clicking
//                      + listens for postMessage signal from child frames
//   [Video iframe]   : finds <video>, sets 2x, plays, detects 'ended',
//                      then postMessages top to click Next
//
//   NO seeking is done — GFG requires full watch-through at any speed.
// ================================================================

(function () {
  'use strict';

  /* ── constants ───────────────────────────────────────────── */
  var MSG_NEXT  = '__AP_NEXT__';        // cross-frame signal
  var SPEED     = 2.0;
  var IS_TOP    = (window === window.top);

  /* ── State & UI ──────────────────────────────────────────── */
  var apPaused = false;
  var pauseBtn = null;

  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['ap_paused'], function(res) {
        if(res && res.ap_paused !== undefined) {
          apPaused = res.ap_paused;
          updateUIVisually();
        }
      });
      chrome.storage.onChanged.addListener(function(changes) {
        if(changes.ap_paused) {
          apPaused = changes.ap_paused.newValue;
          updateUIVisually();
        }
      });
    }
  } catch(e) {}

  function togglePause() {
    apPaused = !apPaused;
    updateUIVisually();
    try { if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) chrome.storage.local.set({ap_paused: apPaused}); } catch(e) {}
  }

  function updateUIVisually() {
    if (!pauseBtn) return;
    if (apPaused) {
      pauseBtn.textContent = 'AutoPlay: OFF';
      pauseBtn.style.backgroundColor = '#d32f2f';
    } else {
      pauseBtn.textContent = 'AutoPlay: ON';
      pauseBtn.style.backgroundColor = '#388e3c';
    }
  }

  if (IS_TOP) {
    function createBtn() {
      if (document.getElementById('ap-pause-btn')) return;
      pauseBtn = document.createElement('button');
      pauseBtn.id = 'ap-pause-btn';
      pauseBtn.textContent = 'AutoPlay: ON';
      Object.assign(pauseBtn.style, {
        position: 'fixed', bottom: '20px', right: '20px', zIndex: '2147483647',
        padding: '8px 12px', backgroundColor: '#388e3c', color: '#fff',
        border: 'none', borderRadius: '4px', fontFamily: 'sans-serif',
        fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
        boxShadow: '0 2px 5px rgba(0,0,0,0.3)', opacity: '0.8',
        transition: 'opacity 0.2s, background-color 0.2s'
      });
      pauseBtn.onmouseover = function() { pauseBtn.style.opacity = '1'; };
      pauseBtn.onmouseout = function() { pauseBtn.style.opacity = '0.8'; };
      pauseBtn.onclick = function(e) { e.preventDefault(); e.stopPropagation(); togglePause(); };
      (document.body || document.documentElement).appendChild(pauseBtn);
      updateUIVisually();
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', createBtn);
    } else {
      createBtn();
    }
  }

  /* ── detect whether this is a GFG top-level page ──────────
     Even when we run inside a cross-origin iframe we still need
     to know the HOST of the TOP frame to decide platform.        */
  var TOP_HOST = '';
  try { TOP_HOST = window.top.location.hostname; } catch (e) {
    // cross-origin top — fall back to document.referrer
    try { TOP_HOST = new URL(document.referrer).hostname; } catch (e2) {}
  }
  var HOST = location.hostname;

  var IS_GFG = TOP_HOST.indexOf('geeksforgeeks') !== -1 ||
               HOST.indexOf('geeksforgeeks')     !== -1;

  /* ── Hardware-like pointer click ─────────────────────────── */
  function hwClick(el) {
    if (!el) return;
    var r  = el.getBoundingClientRect();
    var cx = Math.round(r.left + r.width  / 2);
    var cy = Math.round(r.top  + r.height / 2);

    var Caps = window.InputDeviceCapabilities;
    var caps = Caps ? new Caps({ firesTouchEvents: false }) : undefined;

    var base = {
      bubbles: true, cancelable: true, view: window,
      clientX: cx, clientY: cy,
      screenX: cx + (window.screenX || 0),
      screenY: cy + (window.screenY || 0),
      sourceCapabilities: caps
    };
    var pw = Object.assign({ pointerType: 'mouse', isPrimary: true }, base);

    el.dispatchEvent(new PointerEvent('pointermove', Object.assign({}, pw, { pressure: 0 })));
    el.dispatchEvent(new PointerEvent('pointerover', Object.assign({}, pw, { pressure: 0 })));
    el.dispatchEvent(new PointerEvent('pointerdown', Object.assign({}, pw, { pressure: 0.5 })));
    el.dispatchEvent(new MouseEvent('mousedown', base));

    setTimeout(function () {
      el.dispatchEvent(new PointerEvent('pointerup', Object.assign({}, pw, { pressure: 0 })));
      el.dispatchEvent(new MouseEvent('mouseup', base));
      el.dispatchEvent(new MouseEvent('click',   base));
      try { el.click(); } catch (e) {}
    }, 50 + Math.round(Math.random() * 80));
  }

  /* ── Idle-bypass heartbeat (top frame only) ──────────────── */
  if (IS_TOP) {
    setInterval(function () {
      if (apPaused) return; // Skip heartbeat if paused
      var x = Math.round(window.innerWidth  * (0.4 + Math.random() * 0.2));
      var y = Math.round(window.innerHeight * (0.4 + Math.random() * 0.2));
      document.body.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true, clientX: x, clientY: y,
        pointerType: 'mouse', isPrimary: true
      }));
      if (Math.random() < 0.4) {
        var k = { bubbles: true, cancelable: true, key: 'Shift', code: 'ShiftLeft' };
        document.body.dispatchEvent(new KeyboardEvent('keydown', k));
        setTimeout(function () {
          document.body.dispatchEvent(new KeyboardEvent('keyup', k));
        }, 80);
      }
    }, 15000);
  }

  /* ── Find Next-video button in a document ────────────────── */
  // GFG top-right "Next »" button navigates to next video/track.
  // GFG bottom-left "Next Track" link goes to the next track.
  // We prefer the top-right "Next »" and fall back to "Next Track".
  function labelOf(el) {
    return (el.getAttribute('aria-label') || el.textContent || el.innerText || '')
      .replace(/\s+/g, ' ').trim();
  }

  function isNextVideoBtn(el) {
    if (!el || el.offsetParent === null) return false;
    var t = labelOf(el);
    if (/^next\s*(\u00BB|\u203A|>>|>)?\s*$/i.test(t)) return true;
    var clean = t.replace(/[^a-z]/gi, '').toLowerCase();
    return ['nextvideo', 'nextlesson', 'nextlecture', 'nextchapter', 'nextitem'].indexOf(clean) !== -1;
  }

  function isNextTrackBtn(el) {
    if (!el || el.offsetParent === null) return false;
    var clean = labelOf(el).replace(/[^a-z]/gi, '').toLowerCase();
    return clean === 'nexttrack';
  }

  function findBtn(doc, testFn) {
    var els = doc.querySelectorAll('a, button, [role="button"]');
    for (var i = 0; i < els.length; i++) {
      if (testFn(els[i])) return els[i];
    }
    // Fallback: search all other elements, picking the deepest match
    var all = doc.querySelectorAll('div, span, li, p');
    var best = null;
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (testFn(el)) {
        if (!best || best.contains(el)) best = el;
      }
    }
    return best;
  }

  /* ── Navigate to next video, then next track if needed ───── */
  function clickNext(doc) {
    // 1. Try "Next video/lesson" button first
    var btn = findBtn(doc, isNextVideoBtn);
    if (btn) {
      // console.log('[AutoPlayer] clicking next-video btn:', labelOf(btn));
      hwClick(btn);
      return true;
    }
    // 2. Fall back to "Next Track"
    btn = findBtn(doc, isNextTrackBtn);
    if (btn) {
      // console.log('[AutoPlayer] clicking next-track btn:', labelOf(btn));
      hwClick(btn);
      return true;
    }
    // console.warn('[AutoPlayer] no Next button found in', doc.location ? doc.location.href : '?');
    return false;
  }

  function goNext() {
    // Try top/parent document (has the navigation buttons)
    var docs = [document];
    if (!IS_TOP) {
      try { if (window.parent !== window) docs.unshift(window.parent.document); } catch (e) {}
      try { if (window.top    !== window) docs.unshift(window.top.document);    } catch (e) {}
    }
    for (var i = 0; i < docs.length; i++) {
      if (clickNext(docs[i])) return true;
    }
    return false;
  }

  /* ── postMessage bridge ───────────────────────────────────── */
  // TOP frame: listen for "video ended" signal from child iframes
  if (IS_TOP) {
    window.addEventListener('message', function (e) {
      if (e.data && e.data.type === MSG_NEXT) {
        // console.log('[AutoPlayer] top got MSG_NEXT from iframe');
        setTimeout(goNext, 1000);
      }
    });
  }

  function requestNext() {
    // Try direct navigation first (works if same-origin or parent reachable)
    if (goNext()) return;
    // Cross-origin fallback: tell top frame via postMessage
    var target = IS_TOP ? window : window.top;
    try { target.postMessage({ type: MSG_NEXT }, '*'); } catch (e) {}
  }

  /* ── Video control ───────────────────────────────────────── */
  var _seen     = [];      // tracked video elements
  var _rateWatchTimer = null;

  function seen(v) {
    for (var i = 0; i < _seen.length; i++) if (_seen[i] === v) return true;
    return false;
  }

  function enforceSpeed(v) {
    if (apPaused) return; // Skip speed force if paused
    try { if (Math.abs(v.playbackRate - SPEED) > 0.01) v.playbackRate = SPEED; } catch (e) {}
  }

  function attachVideo(video) {
    if (seen(video)) { enforceSpeed(video); return; }
    _seen.push(video);

    // console.log('[AutoPlayer] attached video in', location.href);

    enforceSpeed(video);

    // Re-enforce speed whenever the site changes it
    video.addEventListener('ratechange', function () {
      setTimeout(function () { enforceSpeed(video); }, 100);
    });

    // When video naturally ends → go next
    video.addEventListener('ended', function () {
      if (apPaused) return; // Skip next if paused
      // console.log('[AutoPlayer] video ended → waiting 8s for progress API to fire before advance');
      setTimeout(requestNext, 8000); // Increased from 1500 to 8000ms to allow tracking API to complete
    });

    // Play it (hardware click first to satisfy autoplay policy)
    if (video.paused && !apPaused) {
      hwClick(video);
      setTimeout(function () { video.play().catch(function () {}); }, 120);
    }

    // Periodic speed re-enforcement in case site overrides it
    if (!_rateWatchTimer) {
      _rateWatchTimer = setInterval(function () {
        for (var i = 0; i < _seen.length; i++) enforceSpeed(_seen[i]);
      }, 3000);
    }
  }

  /* ── Pick best visible video in current document ─────────── */
  function getBestVideo() {
    var best = null, bestArea = 0;
    var vids = document.querySelectorAll('video');
    for (var i = 0; i < vids.length; i++) {
      var r = vids[i].getBoundingClientRect();
      var area = r.width * r.height;
      if (area > bestArea) { best = vids[i]; bestArea = area; }
    }
    return bestArea > 0 ? best : null;
  }

  /* ── Probe same-origin iframes from top ──────────────────── */
  function probeSameOriginIframes() {
    if (!IS_TOP) return;
    var frames = document.querySelectorAll('iframe');
    for (var i = 0; i < frames.length; i++) {
      try {
        var d = frames[i].contentDocument;
        if (!d) continue;
        var vids = d.querySelectorAll('video');
        for (var j = 0; j < vids.length; j++) {
          var r = vids[j].getBoundingClientRect();
          if (r.width * r.height > 0) attachVideo(vids[j]);
        }
      } catch (e) { /* cross-origin — handled by that frame's own script */ }
    }
  }

  /* ── Scan loop ───────────────────────────────────────────── */
  function scan() {
    var v = getBestVideo();
    if (v) attachVideo(v);
    probeSameOriginIframes();
  }

  setInterval(scan, 2000);
  scan();

  /* ── SPA / Next.js URL-change watcher ───────────────────── */
  var _lastUrl = location.href;
  new MutationObserver(function () {
    if (location.href !== _lastUrl) {
      _lastUrl = location.href;
      _seen = [];
      if (_rateWatchTimer) { clearInterval(_rateWatchTimer); _rateWatchTimer = null; }
      setTimeout(scan, 2500);
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  // console.log('[AutoPlayer] v3.1 | isTop:', IS_TOP, '| host:', HOST, '| topHost:', TOP_HOST);

})();
