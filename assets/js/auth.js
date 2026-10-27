/*
 * School access control for DIET BHSS Hazratbal Complex 121.
 *
 * Every school has its own access password. Only the salted, iterated
 * SHA-256 hash of that password is stored in this project (see
 * schools.js). Entering a school's password unlocks that school's sheet
 * for the current browser session; a separate complex-head password can
 * open any school.
 *
 * IMPORTANT — scope of this protection:
 * This is a static site. The check runs in the browser, so it prevents
 * casual browsing between schools but cannot stop a determined technical
 * user from reading the source or opening a Google Sheet URL directly.
 * Keep each Google Sheet's sharing settings restricted as well.
 */
/* global COMPLEX_SCHOOLS, COMPLEX_ACCESS */
window.COMPLEX_AUTH = (function () {
  'use strict';

  const CONFIG = (typeof window.COMPLEX_ACCESS === 'object' && window.COMPLEX_ACCESS) || {};
  const ITERATIONS = Number(CONFIG.iterations) || 8000;
  const SESSION_HOURS = Number(CONFIG.sessionHours) || 8;
  const REMEMBER_DAYS = Number(CONFIG.rememberDays) || 7;
  const MAX_ATTEMPTS = 6;
  const LOCKOUT_MS = 60 * 1000;

  const SCHOOLS = Array.isArray(window.COMPLEX_SCHOOLS) ? window.COMPLEX_SCHOOLS : [];
  const listeners = [];

  /*
   * Storage namespace.
   *
   * The suffix is a short fingerprint of every password hash in the project.
   * When a school password (or the master password) is changed, the suffix
   * changes with it, so unlocks and lockout counters saved by the previous
   * password are ignored instead of quietly keeping a browser signed in.
   * Nothing manual to bump — see pruneStaleSessionData() for the cleanup.
   */
  function accessFingerprint() {
    const parts = SCHOOLS.map(function (school) {
      const access = (school && school.access) || {};
      return String(school.slug) + ':' + String(access.salt || '') + ':' + String(access.hash || '');
    });
    const admin = CONFIG.admin || {};
    parts.push('admin:' + String(admin.salt || '') + ':' + String(admin.hash || ''));
    parts.push('iterations:' + ITERATIONS);
    return fnv1a(parts.join('|'));
  }

  /* FNV-1a, 32-bit. Only used to name storage keys, not for security. */
  function fnv1a(value) {
    let hash = 0x811c9dc5;
    const text = String(value);
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return ('0000000' + (hash >>> 0).toString(16)).slice(-8);
  }

  const NAMESPACE = 'complexhead.access.v1.' + accessFingerprint();

  const SESSION_KEY = NAMESPACE + '.session';
  const REMEMBER_KEY = NAMESPACE + '.remember';
  const ATTEMPTS_KEY = NAMESPACE + '.attempts';

  /* ------------------------------------------------------------------ */
  /* SHA-256 (small dependency-free implementation)                     */
  /* ------------------------------------------------------------------ */

  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function utf8Bytes(value) {
    const text = String(value == null ? '' : value);
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text);
    const out = [];
    for (let i = 0; i < text.length; i += 1) {
      let code = text.charCodeAt(i);
      if (code < 0x80) {
        out.push(code);
      } else if (code < 0x800) {
        out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      } else {
        out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      }
    }
    return new Uint8Array(out);
  }

  function rotr(value, bits) {
    return (value >>> bits) | (value << (32 - bits));
  }

  function sha256Hex(value) {
    const bytes = utf8Bytes(value);
    const bitLength = bytes.length * 8;
    const blocks = Math.ceil((bytes.length + 9) / 64);
    const buffer = new Uint8Array(blocks * 64);
    buffer.set(bytes);
    buffer[bytes.length] = 0x80;

    const view = new DataView(buffer.buffer);
    view.setUint32(buffer.length - 8, Math.floor(bitLength / 0x100000000));
    view.setUint32(buffer.length - 4, bitLength >>> 0);

    let h0 = 0x6a09e667;
    let h1 = 0xbb67ae85;
    let h2 = 0x3c6ef372;
    let h3 = 0xa54ff53a;
    let h4 = 0x510e527f;
    let h5 = 0x9b05688c;
    let h6 = 0x1f83d9ab;
    let h7 = 0x5be0cd19;
    const w = new Int32Array(64);

    for (let block = 0; block < blocks; block += 1) {
      for (let i = 0; i < 16; i += 1) {
        w[i] = view.getInt32(block * 64 + i * 4);
      }
      for (let i = 16; i < 64; i += 1) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }

      let a = h0;
      let b = h1;
      let c = h2;
      let d = h3;
      let e = h4;
      let f = h5;
      let g = h6;
      let h = h7;

      for (let i = 0; i < 64; i += 1) {
        const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + s1 + ch + K[i] + w[i]) | 0;
        const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (s0 + maj) | 0;
        h = g;
        g = f;
        f = e;
        e = (d + t1) | 0;
        d = c;
        c = b;
        b = a;
        a = (t1 + t2) | 0;
      }

      h0 = (h0 + a) | 0;
      h1 = (h1 + b) | 0;
      h2 = (h2 + c) | 0;
      h3 = (h3 + d) | 0;
      h4 = (h4 + e) | 0;
      h5 = (h5 + f) | 0;
      h6 = (h6 + g) | 0;
      h7 = (h7 + h) | 0;
    }

    return [h0, h1, h2, h3, h4, h5, h6, h7]
      .map(function (word) { return (word >>> 0).toString(16).padStart(8, '0'); })
      .join('');
  }

  /* ------------------------------------------------------------------ */
  /* Password verification                                              */
  /* ------------------------------------------------------------------ */

  function normalizePassword(value) {
    return String(value == null ? '' : value).toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function hashPassword(salt, password) {
    let digest = salt + ':' + normalizePassword(password);
    for (let i = 0; i < ITERATIONS; i += 1) digest = sha256Hex(digest);
    return digest;
  }

  function safeEqual(a, b) {
    const left = String(a || '');
    const right = String(b || '');
    if (left.length !== right.length) return false;
    let diff = 0;
    for (let i = 0; i < left.length; i += 1) {
      diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
    }
    return diff === 0;
  }

  function schoolBySlug(slug) {
    return SCHOOLS.find(function (school) { return school.slug === slug; }) || null;
  }

  function detailFor(slug) {
    const school = schoolBySlug(slug);
    return school && school.access && school.access.salt && school.access.hash ? school.access : null;
  }

  function matches(entry, password) {
    if (!entry || !entry.salt || !entry.hash) return false;
    return safeEqual(hashPassword(entry.salt, password), entry.hash);
  }

  /* ------------------------------------------------------------------ */
  /* Session storage                                                    */
  /* ------------------------------------------------------------------ */

  function readObject(storage, key) {
    try {
      const raw = storage.getItem(key);
      if (!raw) return {};
      const data = JSON.parse(raw);
      return data && typeof data === 'object' ? data : {};
    } catch (error) {
      return {};
    }
  }

  function writeObject(storage, key, value) {
    try {
      if (Object.keys(value).length) storage.setItem(key, JSON.stringify(value));
      else storage.removeItem(key);
    } catch (error) {
      /* private mode or storage disabled */
    }
  }

  function sessionStore() {
    try { return window.sessionStorage; } catch (error) { return null; }
  }

  function persistStore() {
    try { return window.localStorage; } catch (error) { return null; }
  }

  /*
   * Removes grants and lockout records left behind by an older password.
   * They are already ignored because of the NAMESPACE suffix above; this
   * just keeps the browser storage tidy.
   */
  function pruneStaleSessionData() {
    const keep = [SESSION_KEY, REMEMBER_KEY, ATTEMPTS_KEY];
    [sessionStore(), persistStore()].forEach(function (store) {
      if (!store) return;
      try {
        const stale = [];
        for (let i = 0; i < store.length; i += 1) {
          const key = store.key(i);
          if (key && key.indexOf('complexhead.access.') === 0 && keep.indexOf(key) === -1) {
            stale.push(key);
          }
        }
        stale.forEach(function (key) {
          try { store.removeItem(key); } catch (error) { /* ignore */ }
        });
      } catch (error) {
        /* storage disabled */
      }
    });
  }

  function readGrants() {
    const grants = {};
    const session = sessionStore();
    const persist = persistStore();
    if (session) Object.assign(grants, readObject(session, SESSION_KEY));
    if (persist) Object.assign(grants, readObject(persist, REMEMBER_KEY));
    const now = Date.now();
    let changed = false;
    Object.keys(grants).forEach(function (slug) {
      if (!(Number(grants[slug]) > now)) {
        delete grants[slug];
        changed = true;
      }
    });
    if (changed) {
      if (session) writeObject(session, SESSION_KEY, stripPersisted(grants));
      if (persist) writeObject(persist, REMEMBER_KEY, pickPersisted(grants));
    }
    return grants;
  }

  function pickPersisted(grants, all) {
    const persist = persistStore();
    if (!persist) return {};
    const existing = readObject(persist, REMEMBER_KEY);
    if (all) return grants;
    const out = {};
    Object.keys(grants).forEach(function (slug) {
      if (existing[slug]) out[slug] = grants[slug];
    });
    return out;
  }

  function stripPersisted(grants) {
    const persist = persistStore();
    if (!persist) return grants;
    const existing = readObject(persist, REMEMBER_KEY);
    const out = {};
    Object.keys(grants).forEach(function (slug) {
      if (!existing[slug]) out[slug] = grants[slug];
    });
    return out;
  }

  function grant(slug, remember) {
    const expiry = Date.now() + (remember ? REMEMBER_DAYS : SESSION_HOURS) * 60 * 60 * 1000;
    const grants = readGrants();
    grants[slug] = expiry;

    const session = sessionStore();
    if (session) {
      const sessionGrants = readObject(session, SESSION_KEY);
      sessionGrants[slug] = expiry;
      writeObject(session, SESSION_KEY, stripPersisted(sessionGrants));
    }
    if (remember) {
      const persist = persistStore();
      if (persist) {
        const persisted = readObject(persist, REMEMBER_KEY);
        persisted[slug] = expiry;
        writeObject(persist, REMEMBER_KEY, persisted);
      }
    }
  }

  function isUnlocked(slug) {
    const grants = readGrants();
    if (grants['*'] && grants['*'] > Date.now()) return true;
    return Boolean(slug && grants[slug] && grants[slug] > Date.now());
  }

  function isAdminSession() {
    const grants = readGrants();
    return Boolean(grants['*'] && grants['*'] > Date.now());
  }

  function lock(slug) {
    const session = sessionStore();
    const persist = persistStore();
    ['*', slug].forEach(function (key) {
      if (session) {
        const value = readObject(session, SESSION_KEY);
        delete value[key];
        writeObject(session, SESSION_KEY, value);
      }
      if (persist) {
        const value = readObject(persist, REMEMBER_KEY);
        delete value[key];
        writeObject(persist, REMEMBER_KEY, value);
      }
    });
    notify({ type: 'lock', slug: slug });
  }

  function lockAll() {
    const session = sessionStore();
    const persist = persistStore();
    if (session) writeObject(session, SESSION_KEY, {});
    if (persist) writeObject(persist, REMEMBER_KEY, {});
    notify({ type: 'lock', slug: null });
  }

  /* ------------------------------------------------------------------ */
  /* Throttling                                                         */
  /* ------------------------------------------------------------------ */

  function readAttempts() {
    const session = sessionStore();
    if (!session) return {};
    return readObject(session, ATTEMPTS_KEY);
  }

  function lockoutRemaining(slug) {
    const record = readAttempts()[slug];
    if (!record || !record.until) return 0;
    return Math.max(0, Number(record.until) - Date.now());
  }

  function registerFailure(slug) {
    const session = sessionStore();
    if (!session) return 0;
    const attempts = readAttempts();
    const record = attempts[slug] && Number(attempts[slug].count) ? attempts[slug] : { count: 0, until: 0 };
    if (record.until && record.until < Date.now()) {
      record.count = 0;
      record.until = 0;
    }
    record.count = Number(record.count) + 1;
    if (record.count >= MAX_ATTEMPTS) {
      record.until = Date.now() + LOCKOUT_MS;
      record.count = 0;
    }
    attempts[slug] = record;
    writeObject(session, ATTEMPTS_KEY, attempts);
    return record.until || 0;
  }

  function clearFailures(slug) {
    const session = sessionStore();
    if (!session) return;
    const attempts = readAttempts();
    delete attempts[slug];
    writeObject(session, ATTEMPTS_KEY, attempts);
  }

  /* ------------------------------------------------------------------ */
  /* Events                                                             */
  /* ------------------------------------------------------------------ */

  function notify(detail) {
    listeners.forEach(function (listener) {
      try { listener(detail); } catch (error) { /* keep other listeners alive */ }
    });
    try {
      document.dispatchEvent(new CustomEvent('complexhead:access', { detail: detail }));
    } catch (error) {
      /* CustomEvent unsupported */
    }
  }

  function onChange(listener) {
    if (typeof listener !== 'function') return function () {};
    listeners.push(listener);
    return function () {
      const index = listeners.indexOf(listener);
      if (index !== -1) listeners.splice(index, 1);
    };
  }

  /* ------------------------------------------------------------------ */
  /* Unlock dialog                                                      */
  /* ------------------------------------------------------------------ */

  let dialog = null;
  let pending = { slug: null, intent: null, remember: false };
  let busy = false;

  function q(selector) {
    return dialog ? dialog.querySelector(selector) : null;
  }

  function setError(message) {
    const box = q('#accessError');
    if (!box) return;
    box.textContent = message || '';
    box.hidden = !message;
  }

  function setBusy(value) {
    busy = value;
    const submit = q('#accessSubmit');
    const input = q('#accessPassword');
    if (submit) {
      submit.disabled = value;
      submit.textContent = value ? 'Checking…' : 'Unlock sheet';
    }
    if (input) input.disabled = value;
  }

  function openDialog(slug, intent) {
    const school = schoolBySlug(slug);
    if (!school) return;
    pending = { slug: slug, intent: intent || 'view', remember: false };
    setError('');
    setBusy(false);

    const title = q('#accessDialogTitle');
    const schoolName = q('#accessDialogSchool');
    const kicker = q('#accessDialogKicker');
    const input = q('#accessPassword');
    const remember = q('#accessRemember');
    const copy = q('#accessDialogNote');

    if (kicker) kicker.textContent = school.type;
    if (title) title.textContent = school.name;
    if (schoolName) schoolName.textContent = 'Class 8th Examination ' + (window.COMPLEX_SESSION || '') + ' · Complex 121';
    if (copy) {
      copy.textContent = 'Enter the access password issued to ' + school.name + '. Each school has its own password, and passwords are never shared between schools.';
    }
    if (remember) remember.checked = false;
    if (input) input.value = '';

    if (!dialog) return;
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
      dialog.classList.add('access-dialog--fallback');
    }
    window.setTimeout(function () { if (input) input.focus(); }, 30);
  }

  function closeDialog() {
    if (!dialog) return;
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else {
      dialog.removeAttribute('open');
      dialog.classList.remove('access-dialog--fallback');
    }
    setBusy(false);
    setError('');
  }

  async function submit() {
    if (busy || !pending.slug) return;
    const input = q('#accessPassword');
    const password = normalizePassword(input ? input.value : '');
    const slug = pending.slug;
    const intent = pending.intent;
    const remember = Boolean(q('#accessRemember') && q('#accessRemember').checked);

    setError('');

    if (!password) {
      setError('Please enter the access password.');
      return;
    }

    const wait = lockoutRemaining(slug);
    if (wait > 0) {
      setError('Too many incorrect attempts. Try again in ' + Math.ceil(wait / 1000) + ' seconds.');
      return;
    }

    setBusy(true);
    // Give the browser a frame to paint the "Checking…" state before hashing.
    await new Promise(function (resolve) { window.setTimeout(resolve, 20); });

    let isAdmin = false;
    let ok = matches(detailFor(slug), password);
    if (!ok && CONFIG.admin && matches(CONFIG.admin, password)) {
      ok = true;
      isAdmin = true;
    }

    if (!ok) {
      setBusy(false);
      const until = registerFailure(slug);
      if (until) {
        setError('Too many incorrect attempts. Locked for 60 seconds.');
      } else {
        setError('That password is not correct. Please check the password issued to your school.');
      }
      if (input) {
        input.select();
      }
      return;
    }

    clearFailures(slug);
    if (isAdmin) grant('*', remember);
    grant(slug, remember);
    setBusy(false);
    closeDialog();
    notify({ type: 'unlock', slug: slug, admin: isAdmin, intent: intent });
  }

  function initDialog() {
    dialog = document.getElementById('accessDialog');
    if (!dialog) return;

    const form = q('#accessForm');
    if (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        submit();
      });
    }

    dialog.addEventListener('click', function (event) {
      if (event.target.closest('[data-access-close]')) {
        closeDialog();
        return;
      }
      if (event.target === dialog) {
        const rect = dialog.getBoundingClientRect();
        const inside = event.clientX >= rect.left && event.clientX <= rect.right &&
          event.clientY >= rect.top && event.clientY <= rect.bottom;
        if (!inside) closeDialog();
      }
    });

    dialog.addEventListener('cancel', function (event) {
      event.preventDefault();
      closeDialog();
    });

    const input = q('#accessPassword');
    if (input) {
      input.addEventListener('input', function () { setError(''); });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Public API                                                         */
  /* ------------------------------------------------------------------ */

  pruneStaleSessionData();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDialog);
  } else {
    initDialog();
  }

  return {
    isUnlocked: isUnlocked,
    isAdminSession: isAdminSession,
    open: openDialog,
    close: closeDialog,
    lock: lock,
    lockAll: lockAll,
    onChange: onChange,
    hasAccess: function (slug) { return Boolean(detailFor(slug)); },
    normalize: normalizePassword,
    /* exposed for the password generator / verification tooling */
    sha256: sha256Hex,
    hashPassword: hashPassword,
    iterations: ITERATIONS
  };
})();
