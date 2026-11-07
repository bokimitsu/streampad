// ==UserScript==
// @name         AnimePahe TV
// @namespace    https://github.com/bokimitsu/streampad
// @version      0.1.1
// @description  DualShock 4 controls and a 10-foot layout for AnimePahe on Android TV.
// @author       bokimitsu
// Site and player domains: keep these @match lines in sync with CONFIG.siteDomains / CONFIG.playerDomains.
// @match        https://animepahe.pw/*
// @match        https://kwik.cx/*
// @run-at       document-end
// @grant        GM_getValue
// @grant        GM_setValue
// @updateURL    https://raw.githubusercontent.com/bokimitsu/streampad/main/animepahe-tv.user.js
// @downloadURL  https://raw.githubusercontent.com/bokimitsu/streampad/main/animepahe-tv.user.js
// ==/UserScript==

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // CONFIG — everything tunable lives here.
  // ---------------------------------------------------------------------------
  const CONFIG = {
    // The site moves domains now and then; also update the @match lines above.
    siteDomains: ['animepahe.pw'],
    playerDomains: ['kwik.cx'],

    // Gamepad indices measured on the projector (docs/controller-map.md): standard mapping.
    buttons: {
      cross: 0, circle: 1, square: 2, triangle: 3,
      l1: 4, r1: 5, l2: 6, r2: 7,
      share: 8, options: 9, l3: 10, r3: 11,
      up: 12, down: 13, left: 14, right: 15,
    },
    axes: { leftX: 0, leftY: 1, rightX: 2, rightY: 3 },
    triggerThreshold: 0.5,   // L2/R2 are analog; count as "pressed" above this
    stickDeadZone: 0.15,     // idle noise measured at ±0.03
    disconnectGraceMs: 2500, // how long a lost controller may stay gone before warning

    // Keyboard keys act as virtual controller buttons, so every controller action
    // also has a keyboard shortcut. Keys are KeyboardEvent.key values.
    keys: {
      Enter: 'cross',
      Escape: 'circle', Backspace: 'circle',
      e: 'square',
      '/': 'triangle', f: 'triangle',
      '[': 'l1', ']': 'r1',
      ',': 'l2', '.': 'r2',
      m: 'share',
      o: 'options',
      g: 'l3', s: 'r3',
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    },

    // Button -> action, per context. Later pages override "browse".
    controls: {
      global: { options: 'toggleEnhancement', share: 'sectionPicker' },
      browse: {
        cross: 'click', circle: 'back',
        up: 'focusUp', down: 'focusDown', left: 'focusLeft', right: 'focusRight',
        l1: 'prevPage', r1: 'nextPage', l2: 'prevTab', r2: 'nextTab',
        triangle: 'search', square: 'toggleSort',
      },
      index: { l1: 'prevLetter', r1: 'nextLetter' },
      player: {
        cross: 'playPause', circle: 'back',
        left: 'seekBack', right: 'seekForward', up: 'volumeUp', down: 'volumeDown',
        l1: 'prevEpisode', r1: 'nextEpisode',
        triangle: 'toggleFullscreen', square: 'episodeMenu',
        l3: 'goToShow', r3: 'skipIntro',
      },
    },
    // Buttons held together. Members of a combo fire their single action on release instead.
    combos: [
      { buttons: ['l3', 'r3'], action: 'toggleDebug' },
    ],
    debugKey: '`',
    // Actions that still work while the enhancement is switched off.
    alwaysOn: ['toggleEnhancement', 'toggleDebug'],

    seekSeconds: 10,
    skipIntroSeconds: 85,
  };

  // ---------------------------------------------------------------------------
  // SELECTORS — all derived from the saved snapshots. A site change is fixed here.
  // ---------------------------------------------------------------------------
  const SELECTORS = {
    // Page detection (first match wins)
    page: {
      player: '.theatre .player',
      show: 'article.page-detail',
      index: '.page-index',
      home: '.latest-release',
    },
    header: {
      nav: '.main-header .main-nav',
      homeLink: '.main-header .main-nav a[title="home"]',
      indexLink: '.main-header .main-nav a[title="anime"]',
      search: '.main-header .nav-search input.input-search',
      searchResults: '.main-header .search-results-wrap',
    },
    home: {
      list: '.latest-release .episode-list',      // filled by the site's JS after load
      card: '.latest-release .episode-wrap',
      cardLink: 'a.play',
      cardTitle: '.episode-title a',
      cardEpisode: '.episode-number',
    },
    pagination: {
      bar: 'ul.pagination',
      first: '.page-item:first-child .page-link',
      prev: '.page-link.prev-page',
      next: '.page-link.next-page',
      last: '.page-item:last-child .page-link',
      current: '.page-item.active .page-link',
    },
    index: {
      letterBar: '.page-index .scrollable-ul ul.nav',
      letter: '.page-index .scrollable-ul .nav-link',
      activeLetter: '.page-index .scrollable-ul .nav-link.active',
      activePane: '.page-index .tab-content .tab-pane.active',
      entry: '.page-index .tab-pane .col-12 > a',
    },
    show: {
      title: '.anime-header h1',
      poster: '.anime-header .anime-poster img',
      tabs: '.anime-nav a[data-tab]',
      activeTab: '.anime-nav li.active a[data-tab]',
      synopsis: '.anime-synopsis',
      info: '.anime-info',
      episodeBar: '.episode-bar',
      episodeCount: '.episode-count',
      sortAsc: '#episode_asc',
      sortDesc: '#episode_desc',
      note: '.anime-note',
      episodeList: '.episode-list-wrapper .episode-list',
      episodeCard: '.episode-list .episode-wrap',
      episodeLink: 'a.play',
      episodeNumber: '.episode-number',
      episodeDuration: '.episode-duration',
      episodeDisc: '.episode-disc',
    },
    player: {
      frame: '.theatre .player iframe.embed-responsive-item',
      clickToLoad: '.theatre .player .click-to-load',
      prevEpisode: '.theatre .player .prequel a',
      nextEpisode: '.theatre .player .sequel a',
      episodeMenuButton: '#episodeMenu',
      episodeMenuItem: '.episode-menu .dropdown-item',
      activeEpisode: '.episode-menu .dropdown-item.active',
      title: '.theatre-info h1',
      showLink: '.theatre-info h1 a',
      status: '.theatre-info .anime-status',
      season: '.theatre-info .anime-season',
      poster: '.theatre-info .anime-poster img',
    },
    kwik: {
      video: 'video',
      plyr: '.plyr',
    },
  };

  const VERSION = (typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.version) || 'dev';
  const IS_TOP = window.top === window.self;

  // ---------------------------------------------------------------------------
  // Module runner — each module is isolated: if one throws, the rest and the site keep working.
  // ---------------------------------------------------------------------------
  const moduleStatus = {};

  function runModule(name, init) {
    try {
      const api = init() || {};
      moduleStatus[name] = 'ok';
      return api;
    } catch (err) {
      moduleStatus[name] = 'failed: ' + (err && err.message || err);
      console.error('[AnimePahe TV] module "' + name + '" failed to start', err);
      return null;
    }
  }

  // Wraps a callback that runs repeatedly (events, animation frames) so a bug
  // turns that module off after a few errors instead of throwing forever.
  function guard(name, fn, maxErrors = 5) {
    let errors = 0;
    return function (...args) {
      if (errors >= maxErrors) return undefined;
      try {
        return fn.apply(this, args);
      } catch (err) {
        errors++;
        console.error('[AnimePahe TV] error in "' + name + '"', err);
        if (errors >= maxErrors) moduleStatus[name] = 'stopped after ' + maxErrors + ' errors: ' + (err && err.message || err);
        return undefined;
      }
    };
  }

  // ---------------------------------------------------------------------------
  // core — config, storage, logging, page detection, events, action registry
  // ---------------------------------------------------------------------------
  const core = runModule('core', () => {
    const store = {
      get(key, fallback) {
        try {
          if (typeof GM_getValue === 'function') return GM_getValue(key, fallback);
          const raw = localStorage.getItem('sp.' + key);
          return raw === null ? fallback : JSON.parse(raw);
        } catch (_) { return fallback; }
      },
      set(key, value) {
        try {
          if (typeof GM_setValue === 'function') GM_setValue(key, value);
          else localStorage.setItem('sp.' + key, JSON.stringify(value));
        } catch (err) { console.warn('[AnimePahe TV] could not save', key, err); }
      },
    };

    const logLines = [];
    function log(...parts) {
      const line = new Date().toISOString().slice(11, 19) + ' ' + parts.map(p => typeof p === 'string' ? p : JSON.stringify(p)).join(' ');
      logLines.push(line);
      if (logLines.length > 50) logLines.shift();
      console.log('[AnimePahe TV]', ...parts);
    }

    function detectPage() {
      const host = location.hostname;
      if (CONFIG.playerDomains.some(d => host === d || host.endsWith('.' + d))) return 'kwik';
      for (const [type, sel] of Object.entries(SELECTORS.page)) {
        if (document.querySelector(sel)) return type;
      }
      return 'other';
    }

    const listeners = {};
    const events = {
      on(name, fn) { (listeners[name] = listeners[name] || []).push(fn); },
      emit(name, data) { for (const fn of listeners[name] || []) guard('event:' + name, fn)(data); },
    };

    const handlers = {};
    const actions = {
      register(name, fn) { handlers[name] = fn; },
      has(name) { return !!handlers[name]; },
      run(name, source) {
        state.lastAction = name + ' (' + source + ')';
        if (!state.enabled && !CONFIG.alwaysOn.includes(name)) return false;
        if (!handlers[name]) {
          log('action', name, 'has no handler yet');
          events.emit('unhandledAction', name);
          return true;
        }
        log('action', name, 'from', source);
        guard('action:' + name, handlers[name])();
        return true;
      },
    };

    const state = {
      enabled: store.get('enabled', true),
      debug: store.get('debug', false),
      page: detectPage(),
      lastAction: '—',
    };

    function applyEnabled() {
      document.documentElement.classList.toggle('sp-on', state.enabled);
    }
    applyEnabled();

    actions.register('toggleEnhancement', () => {
      state.enabled = !state.enabled;
      store.set('enabled', state.enabled);
      applyEnabled();
      events.emit('enabledChanged', state.enabled);
      events.emit('toast', state.enabled ? 'TV mode on' : 'TV mode off — press Options to turn it back on');
    });

    actions.register('toggleDebug', () => {
      state.debug = !state.debug;
      store.set('debug', state.debug);
      events.emit('debugChanged', state.debug);
    });

    log('v' + VERSION, 'page:', state.page, IS_TOP ? '(top)' : '(frame)');
    return { store, log, logLines, events, actions, state, detectPage };
  });

  if (!core) return; // without core nothing else can run; the site is left untouched

  // ---------------------------------------------------------------------------
  // layout — styles for the script's own UI; page layouts come in Phase 3
  // ---------------------------------------------------------------------------
  runModule('layout', () => {
    const css = `
      .sp-ui { position: fixed; z-index: 2147483000; font: 600 22px/1.3 system-ui, sans-serif; color: #fff; pointer-events: none; }
      .sp-toast { left: 50%; bottom: 7vh; transform: translateX(-50%); background: rgba(20,20,20,.94);
        border: 2px solid #d5015b; border-radius: 10px; padding: 12px 24px; max-width: 80vw; text-align: center; }
      .sp-toast[hidden], .sp-hint[hidden], .sp-banner[hidden], .sp-debug[hidden] { display: none; }
      .sp-hint { right: 5vw; bottom: 5vh; background: rgba(20,20,20,.9); border-radius: 8px; padding: 8px 16px; font-size: 18px; color: #ccc; }
      .sp-banner { left: 5vw; right: 5vw; top: 5vh; background: #7a0030; border-radius: 10px; padding: 14px 22px; text-align: center; }
      .sp-debug { top: 5vh; right: 5vw; width: min(560px, 44vw); max-height: 85vh; overflow: hidden; background: rgba(0,0,0,.88);
        border: 1px solid #d5015b; border-radius: 8px; padding: 12px 14px; font: 15px/1.35 ui-monospace, Consolas, monospace; white-space: pre-wrap; word-break: break-all; }
    `;
    const style = document.createElement('style');
    style.id = 'sp-style';
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  });

  // Small UI helpers shared by modules (only drawn in the top page).
  const ui = IS_TOP ? runModule('ui', () => {
    function make(cls) {
      const el = document.createElement('div');
      el.className = 'sp-ui ' + cls;
      el.hidden = true;
      document.body.appendChild(el);
      return el;
    }
    const toastEl = make('sp-toast');
    const hintEl = make('sp-hint');
    const bannerEl = make('sp-banner');
    let toastTimer = 0;

    function toast(text, ms = 2200) {
      toastEl.textContent = text;
      toastEl.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toastEl.hidden = true; }, ms);
    }
    core.events.on('toast', toast);
    core.events.on('unhandledAction', name => toast(name + ' — not built yet'));

    return {
      toast,
      hint(text) { hintEl.textContent = text || ''; hintEl.hidden = !text; },
      banner(text) { bannerEl.textContent = text || ''; bannerEl.hidden = !text; },
    };
  }) : null;

  // ---------------------------------------------------------------------------
  // input — gamepad polling + keyboard, turned into actions
  // ---------------------------------------------------------------------------
  const input = IS_TOP ? runModule('input', () => {
    const B = CONFIG.buttons;
    const names = Object.keys(B);
    const comboMembers = new Set(CONFIG.combos.flatMap(c => c.buttons));
    const held = {};          // button name -> pressed this frame
    const comboUsed = {};     // button name -> was part of a fired combo while held
    const live = { pad: null, buttons: [], axes: [], everSeen: false, lostSince: 0 };

    function context() {
      return core.state.page === 'player' ? 'player' : 'browse';
    }
    function actionFor(button) {
      const c = CONFIG.controls;
      const page = core.state.page;
      return (c[page] && c[page][button])
        || (c[context()] && c[context()][button])
        || c.global[button]
        || null;
    }

    function press(button, source) {
      held[button] = true;
      for (const combo of CONFIG.combos) {
        if (combo.buttons.includes(button) && combo.buttons.every(b => held[b])) {
          combo.buttons.forEach(b => { comboUsed[b] = true; });
          core.actions.run(combo.action, source + ' combo');
          return;
        }
      }
      if (!comboMembers.has(button)) {
        const action = actionFor(button);
        if (action) core.actions.run(action, source + ' ' + button);
      }
    }
    function release(button, source) {
      held[button] = false;
      if (comboMembers.has(button)) {
        if (!comboUsed[button]) {
          const action = actionFor(button);
          if (action) core.actions.run(action, source + ' ' + button);
        }
        comboUsed[button] = false;
      }
    }

    // --- gamepad ---
    function firstPad() {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const p of pads) if (p && p.connected) return p;
      return null;
    }

    const prev = {};
    const tick = guard('input', now => {
      const pad = firstPad();
      live.pad = pad;
      if (pad) {
        if (!live.everSeen) { live.everSeen = true; ui && ui.hint(''); core.log('controller:', pad.id, pad.mapping); }
        if (live.lostSince) { live.lostSince = 0; ui && ui.banner(''); }
        live.buttons = names.filter(n => {
          const b = pad.buttons[B[n]];
          return b && (b.pressed || b.value > CONFIG.triggerThreshold);
        });
        live.axes = Array.from(pad.axes);
        for (const n of names) {
          const down = live.buttons.includes(n);
          if (down && !prev[n]) press(n, 'pad');
          else if (!down && prev[n]) release(n, 'pad');
          prev[n] = down;
        }
      } else if (live.everSeen) {
        if (!live.lostSince) live.lostSince = now;
        if (now - live.lostSince > CONFIG.disconnectGraceMs && ui) {
          ui.banner('Controller disconnected. If it comes back but doesn\'t respond, restart Firefox.');
        }
        for (const n of names) { if (prev[n]) release(n, 'pad'); prev[n] = false; }
        live.buttons = [];
      }
      requestAnimationFrame(tick);
    });
    requestAnimationFrame(tick);

    // Firefox only exposes the controller after a button press on this page.
    if (core.state.enabled && ui) ui.hint('Press any controller button');
    core.events.on('enabledChanged', on => { if (ui && !live.everSeen) ui.hint(on ? 'Press any controller button' : ''); });

    // --- keyboard ---
    function isTyping(el) {
      return el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
    }
    document.addEventListener('keydown', guard('input:keys', e => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === CONFIG.debugKey && !isTyping(e.target)) {
        e.preventDefault();
        core.actions.run('toggleDebug', 'key');
        return;
      }
      const button = CONFIG.keys[e.key];
      if (!button || isTyping(e.target) || e.repeat) return;
      const action = actionFor(button);
      if (!action) return;
      if (!core.state.enabled && !CONFIG.alwaysOn.includes(action)) return;
      e.preventDefault();
      e.stopPropagation();
      press(button, 'key');
      release(button, 'key');
    }), true);

    return { live, actionFor };
  }) : null;

  // ---------------------------------------------------------------------------
  // debug overlay — raw input, page type, focused element
  // ---------------------------------------------------------------------------
  if (IS_TOP) runModule('debug', () => {
    const el = document.createElement('div');
    el.className = 'sp-ui sp-debug';
    el.hidden = !core.state.debug;
    document.body.appendChild(el);

    function describe(node) {
      if (!node || node === document.body) return '(body)';
      let s = node.tagName.toLowerCase();
      if (node.id) s += '#' + node.id;
      if (node.classList.length) s += '.' + Array.from(node.classList).slice(0, 3).join('.');
      const text = (node.getAttribute('title') || node.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 50);
      return text ? s + ' "' + text + '"' : s;
    }

    let last = 0;
    const draw = guard('debug', now => {
      if (!el.hidden && now - last > 150) {
        last = now;
        const live = input ? input.live : null;
        const pad = live && live.pad;
        el.textContent = [
          'AnimePahe TV v' + VERSION + '   ' + (core.state.enabled ? 'ON' : 'OFF'),
          'page: ' + core.state.page,
          'viewport: ' + innerWidth + 'x' + innerHeight + ' @' + devicePixelRatio + 'x',
          'focus: ' + describe(document.activeElement),
          '',
          'pad: ' + (pad ? pad.id + ' [' + pad.mapping + ']' : live && live.everSeen ? 'lost' : 'none yet'),
          'held: ' + (live && live.buttons.length ? live.buttons.join(' ') : '—'),
          'axes: ' + (live ? live.axes.map(v => v.toFixed(2)).join('  ') : '—'),
          'last action: ' + core.state.lastAction,
          '',
          'modules: ' + Object.entries(moduleStatus).map(([k, v]) => k + '=' + v).join(', '),
          '',
          core.logLines.slice(-6).join('\n'),
        ].join('\n');
      }
      requestAnimationFrame(draw);
    });
    requestAnimationFrame(draw);
    core.events.on('debugChanged', on => { el.hidden = !on; });
  });

  // ---------------------------------------------------------------------------
  // Later phases plug in here; each stays isolated.
  // ---------------------------------------------------------------------------
  runModule('navigation', () => ({}));   // Phase 2: cursor, spatial focus, scroll wheel, paging, tabs, section picker
  runModule('player', () => ({}));       // Phase 4: postMessage bridge to the Kwik/Plyr frame, custom fullscreen
  runModule('history', () => ({}));      // Phase 5: watch history and history page
})();
