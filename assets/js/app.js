/* global COMPLEX_SCHOOLS */
(function () {
  'use strict';

  const SCHOOLS = Array.isArray(window.COMPLEX_SCHOOLS) ? window.COMPLEX_SCHOOLS : [];
  const AUTH = window.COMPLEX_AUTH || null;
  const SUBJECTS = ['English', 'Mathematics', 'Science', 'Social Science', 'Urdu', 'Kashmiri'];
  const SESSION_YEAR = (window.COMPLEX_SESSION || '2026').trim();
  const ENTRY_DEADLINE = (window.ENTRY_DEADLINE || '2026-10-31').trim();

  /* Fail closed: a school's data is shown only when its access password
     has been entered in this browser session. */
  function isUnlocked(school) {
    return Boolean(AUTH && school && AUTH.isUnlocked(school.slug));
  }

  function isEntryOpen() {
    const end = new Date(ENTRY_DEADLINE + 'T23:59:59');
    if (isNaN(end.getTime())) return true;
    return Date.now() <= end.getTime();
  }

  function entryDeadlineLong() {
    try {
      return new Date(ENTRY_DEADLINE + 'T00:00:00').toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric'
      });
    } catch (error) {
      return ENTRY_DEADLINE;
    }
  }
  const DEFAULT_TITLE = 'Class 8th Marks Portal ' + SESSION_YEAR + ' | DIET BHSS Hazratbal Complex 121';
  const CACHE_TTL = 4 * 60 * 1000;

  const cache = new Map();
  const state = {
    groupFilter: 'all',
    schoolQuery: '',
    activeSchool: null,
    students: [],
    rawCsv: '',
    fetchedAt: null,
    loading: false,
    error: '',
    sheetPending: false,
    query: '',
    sort: 'sheet',
    requestToken: 0,
    routeToken: 0
  };

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));

  /* ------------------------------------------------------------------ */
  /* Utilities                                                          */
  /* ------------------------------------------------------------------ */

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function clean(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function toNumber(value) {
    if (value == null) return null;
    const text = String(value).replace(/,/g, '').trim();
    if (!text) return null;
    if (/^(-|—|–|ab|abs|absent|nil|na|n\/a)$/i.test(text)) return null;
    const number = Number(text);
    return Number.isFinite(number) ? number : null;
  }

  function fmt(value) {
    if (value == null || Number.isNaN(value)) return '—';
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
  }

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function sheetEditUrl(school) {
    if (!school.sheetId) return '';
    return 'https://docs.google.com/spreadsheets/d/' + school.sheetId + '/edit';
  }

  function sheetCsvUrl(school) {
    if (!school.sheetId) return '';
    return 'https://docs.google.com/spreadsheets/d/' + school.sheetId + '/gviz/tq?tqx=out:csv&t=' + Date.now();
  }

  function formatChecked(ts) {
    if (!ts) return 'just now';
    try {
      return new Date(ts).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch (error) {
      return 'just now';
    }
  }

  function todayLong() {
    try {
      return new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (error) {
      return '';
    }
  }

  function normalize(value) {
    return clean(value).toUpperCase();
  }

  function naturalCompare(a, b) {
    return String(a == null ? '' : a).localeCompare(String(b == null ? '' : b), 'en', {
      numeric: true,
      sensitivity: 'base'
    });
  }

  function remarkTone(remark) {
    const text = clean(remark);
    if (!text) return 'neutral';
    if (/pass|promot|qualif|declar|distinct/i.test(text)) return 'pass';
    if (/fail|detain|compartment|reappear|essential|absent/i.test(text)) return 'fail';
    return 'neutral';
  }

  function remarkBadge(remark, big) {
    const text = clean(remark);
    const tone = remarkTone(text);
    return '<span class="remark remark--' + tone + (big ? ' remark--big' : '') + '">' + esc(text || '—') + '</span>';
  }

  /* ------------------------------------------------------------------ */
  /* CSV and sheet parsing                                              */
  /* ------------------------------------------------------------------ */

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];

      if (inQuotes) {
        if (char === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 1;
          } else {
            inQuotes = false;
          }
        } else {
          field += char;
        }
      } else if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(field);
        field = '';
      } else if (char === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else if (char !== '\r') {
        field += char;
      }
    }

    if (field.length || row.length) {
      row.push(field);
      rows.push(row);
    }

    return rows;
  }

  function findColumn(header, predicate) {
    for (let i = 0; i < header.length; i += 1) {
      if (predicate(header[i], i)) return i;
    }
    return -1;
  }

  function parseSheet(text) {
    const normalizedText = String(text || '').replace(/^\uFEFF/, '');
    const rows = parseCsv(normalizedText);
    if (!rows.length) return [];

    let headerRow = 0;
    let header = rows[0].map(normalize);

    for (let i = 0; i < Math.min(rows.length, 20); i += 1) {
      const candidate = rows[i].map(normalize);
      const hasName = candidate.some(function (cell) { return cell.includes('NAME OF') && cell.includes('STUDENT'); });
      const hasRoll = candidate.some(function (cell) { return cell.includes('ROLL NO'); });
      if (hasName && hasRoll) {
        headerRow = i;
        header = candidate;
        break;
      }
    }

    const nameIdx = findColumn(header, function (cell) {
      return cell.includes('NAME OF') && cell.includes('STUDENT');
    });
    if (nameIdx === -1) return [];

    const admIdx = findColumn(header, function (cell) { return cell.includes('ADM NO'); });
    const rollIdx = findColumn(header, function (cell) { return cell.includes('ROLL NO'); });
    const fatherIdx = findColumn(header, function (cell) { return cell.includes('FATHER'); });
    const motherIdx = findColumn(header, function (cell) { return cell.includes('MOTHER'); });
    const schoolIdx = findColumn(header, function (cell) {
      return cell.includes('NAME OF') && cell.includes('SCHOOL');
    });
    const dobIdx = findColumn(header, function (cell) {
      return cell.includes('D.O.B') || cell === 'DOB' || cell.includes('DATE OF BIRTH');
    });

    let faStart = findColumn(header, function (cell) { return cell.includes('FORMATIVE'); });
    let saStart = findColumn(header, function (cell) { return cell.includes('SUMMATIVE'); });
    if (faStart === -1) faStart = 9;
    if (saStart === -1) saStart = 16;

    let faTotalIdx = faStart + SUBJECTS.length;
    if (!header[faTotalIdx] || !header[faTotalIdx].includes('TOTAL')) {
      const found = findColumn(header, function (cell, index) {
        return index > faStart && index < saStart && cell.includes('TOTAL');
      });
      if (found !== -1) faTotalIdx = found;
    }

    let saTotalIdx = saStart + SUBJECTS.length;
    if (!header[saTotalIdx] || !header[saTotalIdx].includes('TOTAL')) {
      const found = findColumn(header, function (cell, index) {
        return index > saStart && cell.includes('TOTAL') && !cell.includes('GRAND');
      });
      if (found !== -1) saTotalIdx = found;
    }

    let grandIdx = findColumn(header, function (cell) {
      return cell.includes('GRAND') && cell.includes('TOTAL');
    });
    if (grandIdx === -1) grandIdx = saTotalIdx + 1;

    let remarksIdx = findColumn(header, function (cell) { return cell.includes('REMARKS'); });
    if (remarksIdx === -1) remarksIdx = grandIdx + 1;

    const students = [];

    for (let r = headerRow + 1; r < rows.length; r += 1) {
      const row = rows[r] || [];
      const name = clean(row[nameIdx]);
      if (!name) continue;
      if (normalize(name) === 'NAME OF STUDENT') continue;

      const fa = [];
      const sa = [];
      for (let s = 0; s < SUBJECTS.length; s += 1) {
        fa.push(toNumber(row[faStart + s]));
        sa.push(toNumber(row[saStart + s]));
      }

      let faTotal = toNumber(row[faTotalIdx]);
      let saTotal = toNumber(row[saTotalIdx]);
      let grandTotal = toNumber(row[grandIdx]);
      const remarks = clean(row[remarksIdx]);

      if (faTotal == null) {
        const values = fa.filter(function (value) { return value != null; });
        faTotal = values.length ? values.reduce(function (sum, value) { return sum + value; }, 0) : null;
      }
      if (saTotal == null) {
        const values = sa.filter(function (value) { return value != null; });
        saTotal = values.length ? values.reduce(function (sum, value) { return sum + value; }, 0) : null;
      }
      if (grandTotal == null && (faTotal != null || saTotal != null)) {
        grandTotal = (faTotal || 0) + (saTotal || 0);
      }

      const rollNo = clean(row[rollIdx]);
      const admNo = clean(row[admIdx]);
      const keyType = rollNo ? 'roll' : admNo ? 'adm' : 'row';
      const key = rollNo || admNo || String(r);

      students.push({
        idx: r,
        sno: clean(row[0]),
        schoolWiseNo: clean(row[1]),
        admNo: admNo,
        rollNo: rollNo,
        name: name,
        father: clean(row[fatherIdx]),
        mother: clean(row[motherIdx]),
        schoolName: clean(row[schoolIdx]),
        dob: clean(row[dobIdx]),
        fa: fa,
        sa: sa,
        faTotal: faTotal,
        saTotal: saTotal,
        grandTotal: grandTotal,
        remarks: remarks,
        keyType: keyType,
        key: key
      });
    }

    const keyCounts = new Map();
    students.forEach(function (student) {
      const base = student.key;
      const count = (keyCounts.get(base) || 0) + 1;
      keyCounts.set(base, count);
      if (count > 1) student.key = base + '-' + student.idx;
    });

    return students;
  }

  /* ------------------------------------------------------------------ */
  /* Fetching                                                           */
  /* ------------------------------------------------------------------ */

  async function fetchSchoolData(school, force) {
    const cached = cache.get(school.sheetId);
    if (!force && cached && Date.now() - cached.ts < CACHE_TTL) {
      return cached;
    }

    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, 20000);

    try {
      const response = await fetch(sheetCsvUrl(school), {
        mode: 'cors',
        cache: 'no-store',
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error('Google Sheets returned status ' + response.status + '.');
      }

      const raw = await response.text();
      if (/^\s*<(!doctype|html)/i.test(raw)) {
        throw new Error('The result sheet is not publicly accessible right now.');
      }

      const data = {
        students: parseSheet(raw),
        raw: raw,
        ts: Date.now()
      };

      cache.set(school.sheetId, data);
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  function friendlyError(error) {
    const message = String((error && error.message) || '');
    if (error && error.name === 'AbortError') {
      return 'The request timed out. Please check your connection and try again.';
    }
    if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
      return 'The browser could not reach Google Sheets. Please check your internet connection and try again.';
    }
    if (!message) return 'Something went wrong while loading this result sheet.';
    return message;
  }

  /* ------------------------------------------------------------------ */
  /* School directory                                                   */
  /* ------------------------------------------------------------------ */

  function schoolCard(school) {
    const viewUrl = '#/school/' + school.slug;
    const editUrl = sheetEditUrl(school);
    const unlocked = isUnlocked(school);

    let enterAction;
    if (!unlocked) {
      enterAction = '<button class="school-card__enter school-card__enter--locked" type="button" data-unlock="' + esc(school.slug) + '" data-intent="enter" aria-label="Enter the access password for ' + esc(school.name) + '">' +
        '<svg class="icon" aria-hidden="true"><use href="#i-lock"/></svg> Enter password' +
      '</button>';
    } else if (editUrl) {
      enterAction = isEntryOpen()
        ? '<a class="school-card__enter" href="' + esc(editUrl) + '" target="_blank" rel="noopener" aria-label="Enter or update marks for ' + esc(school.name) + ' in Google Sheets">' +
            '<svg class="icon" aria-hidden="true"><use href="#i-edit"/></svg> Enter marks' +
          '</a>'
        : '<span class="school-card__enter school-card__enter--disabled" aria-disabled="true" title="Marks entry closed on ' + esc(entryDeadlineLong()) + '"><svg class="icon" aria-hidden="true"><use href="#i-lock"/></svg> Entry closed</span>';
    } else {
      enterAction = '<span class="school-card__enter school-card__enter--disabled" aria-disabled="true" title="Google Sheet link pending">' +
        '<svg class="icon" aria-hidden="true"><use href="#i-info"/></svg> Link pending' +
      '</span>';
    }

    const lockBadge = unlocked ? '' :
      '<span class="school-card__lock" title="Password protected" aria-hidden="true"><svg class="icon"><use href="#i-lock"/></svg></span>';

    return '' +
      '<article class="school-card' + (unlocked ? '' : ' school-card--locked') + '" style="--accent:' + esc(school.accent) + '">' +
        '<div class="school-card__top">' +
          '<span class="school-card__monogram" aria-hidden="true">' + esc(school.monogram) + '</span>' +
          '<span class="school-card__type">' + (school.group === 'govt' ? 'Govt.' : 'Private') + '</span>' +
          lockBadge +
          '<a class="school-card__arrow" href="' + esc(viewUrl) + '" aria-label="View the result sheet for ' + esc(school.name) + '"><svg class="icon"><use href="#i-arrow"/></svg></a>' +
        '</div>' +
        '<h3><a class="school-card__title" href="' + esc(viewUrl) + '">' + esc(school.name) + '</a></h3>' +
        '<p class="school-card__kind">' + esc(school.type) + ' <span aria-hidden="true">·</span> Class 8th ' + esc(SESSION_YEAR) + '</p>' +
        '<div class="school-card__foot">' +
          '<div class="school-card__actions">' +
            enterAction +
            '<a class="school-card__view" href="' + esc(viewUrl) + '" aria-label="View the result sheet for ' + esc(school.name) + '">' +
              'View sheet <svg class="icon" aria-hidden="true"><use href="#i-arrow"/></svg>' +
            '</a>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function renderSchools() {
    const query = state.schoolQuery.trim().toLowerCase();
    const filtered = SCHOOLS.filter(function (school) {
      const matchesGroup = state.groupFilter === 'all' || school.group === state.groupFilter;
      const haystack = (school.name + ' ' + school.type).toLowerCase();
      return matchesGroup && (!query || haystack.includes(query));
    });

    const govt = filtered.filter(function (school) { return school.group === 'govt'; });
    const privateSchools = filtered.filter(function (school) { return school.group === 'private'; });

    const govtGrid = $('#govtGrid');
    const privateGrid = $('#privateGrid');
    if (govtGrid) govtGrid.innerHTML = govt.map(schoolCard).join('');
    if (privateGrid) privateGrid.innerHTML = privateSchools.map(schoolCard).join('');

    const groups = {
      govt: $('#finder [data-group="govt"]'),
      private: $('#finder [data-group="private"]')
    };
    if (groups.govt) groups.govt.hidden = govt.length === 0;
    if (groups.private) groups.private.hidden = privateSchools.length === 0;

    $$('[data-count]').forEach(function (el) {
      const key = el.getAttribute('data-count');
      const count = key === 'govt' ? govt.length : privateSchools.length;
      el.textContent = pad(count);
    });

    const empty = $('#schoolSearchEmpty');
    if (empty) empty.hidden = filtered.length !== 0;
  }

  function bindSchoolFinder() {
    const search = $('#schoolSearch');
    if (search) {
      search.addEventListener('input', function () {
        state.schoolQuery = search.value;
        renderSchools();
      });
    }

    const filters = $('#schoolFilters');
    if (filters) {
      filters.addEventListener('click', function (event) {
        const chip = event.target.closest('[data-filter]');
        if (!chip) return;
        state.groupFilter = chip.getAttribute('data-filter');
        $$('.chip', filters).forEach(function (button) {
          const isActive = button === chip;
          button.classList.toggle('is-active', isActive);
          button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
        renderSchools();
      });
    }
    const finder = $('#finder');
    if (finder) {
      finder.addEventListener('click', function (event) {
        const trigger = event.target.closest('[data-unlock]');
        if (!trigger) return;
        event.preventDefault();
        if (!AUTH) {
          toast('Access control could not load. Please reload the page.');
          return;
        }
        AUTH.open(trigger.getAttribute('data-unlock'), trigger.getAttribute('data-intent') || 'enter');
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Routing                                                             */
  /* ------------------------------------------------------------------ */

  function parseRoute() {
    const hash = (window.location.hash || '').replace(/^#/, '');
    if (!hash || hash === '/' || hash === '') {
      return { view: 'home', anchor: null };
    }

    const match = hash.match(/^\/?school\/([^/]+)/);
    if (match) {
      let slug = match[1];
      try {
        slug = decodeURIComponent(slug);
      } catch (error) {
        /* keep the raw value if it cannot be decoded */
      }
      return {
        view: 'school',
        slug: slug,
        anchor: null
      };
    }

    const anchor = hash.replace(/^\//, '');
    return {
      view: 'home',
      anchor: ['finder', 'about', 'contact', 'schools-info', 'how', 'for-schools'].indexOf(anchor) !== -1 ? anchor : null
    };
  }

  function handleRoute() {
    closeNav();
    const route = parseRoute();
    updateNav(route);

    if (route.view === 'school') {
      const school = SCHOOLS.find(function (item) { return item.slug === route.slug; });
      if (!school) {
        window.location.hash = '#/';
        return;
      }

      if (!isUnlocked(school)) {
        state.activeSchool = school;
        state.students = [];
        state.rawCsv = '';
        state.fetchedAt = null;
        state.error = '';
        state.loading = false;
        state.sheetPending = false;
        showResultsView();
        renderResults();
        updateTitle();
        window.scrollTo(0, 0);
        return;
      }

      const isNewSchool = !state.activeSchool || state.activeSchool.slug !== school.slug;

      if (isNewSchool) {
        state.activeSchool = school;
        state.students = [];
        state.rawCsv = '';
        state.fetchedAt = null;
        state.error = '';
        state.sheetPending = false;
        state.loading = true;
        state.query = '';
        state.sort = 'sheet';
        showResultsView();
        renderResults();
        window.scrollTo(0, 0);
        loadSchool(school, false);
      } else {
        showResultsView();
        renderResults();
        updateTitle();
        window.scrollTo(0, 0);
      }
      return;
    }

    showHomeView();
    updateTitle();
    if (route.anchor) {
      const target = document.getElementById(route.anchor);
      if (target) {
        window.setTimeout(function () {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 40);
      }
    } else {
      window.scrollTo(0, 0);
    }
  }

  async function loadSchool(school, force) {
    if (!isUnlocked(school)) {
      state.students = [];
      state.rawCsv = '';
      state.fetchedAt = null;
      state.loading = false;
      state.error = '';
      state.sheetPending = false;
      renderResults();
      updateTitle();
      return;
    }

    if (!school.sheetId) {
      state.students = [];
      state.rawCsv = '';
      state.fetchedAt = new Date();
      state.error = '';
      state.loading = false;
      state.sheetPending = true;
      renderResults();
      updateTitle();
      return;
    }

    state.sheetPending = false;
    const token = ++state.requestToken;
    try {
      const data = await fetchSchoolData(school, force);
      if (token !== state.requestToken) return;
      if (!state.activeSchool || state.activeSchool.slug !== school.slug) return;

      state.students = data.students;
      state.rawCsv = data.raw;
      state.fetchedAt = data.ts;
      state.error = '';
      state.loading = false;
      state.sheetPending = false;
      renderResults();
      updateTitle();
    } catch (error) {
      if (token !== state.requestToken) return;
      if (!state.activeSchool || state.activeSchool.slug !== school.slug) return;

      state.students = [];
      state.rawCsv = '';
      state.fetchedAt = null;
      state.error = friendlyError(error);
      state.loading = false;
      state.sheetPending = false;
      renderResults();
      updateTitle();
    }
  }

  function reloadSchool() {
    if (!state.activeSchool) return;
    state.loading = true;
    state.error = '';
    state.sheetPending = false;
    state.students = [];
    state.rawCsv = '';
    state.fetchedAt = null;
    renderResults();
    loadSchool(state.activeSchool, true);
  }

  function updateNav(route) {
    let active = route.view === 'school' ? 'results' : 'home';
    if (route.view === 'home' && route.anchor) {
      const map = { finder: 'results', about: 'about', contact: 'contact', 'schools-info': 'schools', 'for-schools': 'schools' };
      active = map[route.anchor] || 'home';
    }

    $$('[data-nav]').forEach(function (link) {
      const isActive = link.getAttribute('data-nav') === active;
      link.classList.toggle('is-active', isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  function updateTitle() {
    const school = state.activeSchool;
    if (!school || !document.body.classList.contains('is-results')) {
      document.title = DEFAULT_TITLE;
      return;
    }

    document.title = school.name + ' · Class 8th Result Sheet ' + SESSION_YEAR + ' | DIET Complex 121';
  }

  function showResultsView() {
    const home = $('#homeView');
    const results = $('#resultsView');
    if (home) home.hidden = true;
    if (results) results.hidden = false;
    document.body.classList.add('is-results');
  }

  function showHomeView() {
    const home = $('#homeView');
    const results = $('#resultsView');
    if (home) home.hidden = false;
    if (results) results.hidden = true;
    document.body.classList.remove('is-results');
  }

  /* ------------------------------------------------------------------ */
  /* Result rendering                                                   */
  /* ------------------------------------------------------------------ */

  function statusInfo() {
    if (state.sheetPending) return { tone: 'pending', label: 'Sheet link pending' };
    if (state.loading) return { tone: 'loading', label: 'Connecting' };
    if (state.error) return { tone: 'error', label: 'Unavailable' };
    if (state.students.length) return { tone: 'live', label: 'Sheet synced' };
    return { tone: 'pending', label: 'No records yet' };
  }

  function renderCrumbs() {
    const school = state.activeSchool;
    if (!school) return '';
    return '' +
      '<nav class="crumbs" aria-label="Breadcrumb">' +
        '<a href="#/" class="crumbs__back"><svg class="icon" aria-hidden="true"><use href="#i-arrow"/></svg> All schools</a>' +
        '<span class="crumbs__sep" aria-hidden="true">/</span>' +
        '<span aria-current="page">' + esc(school.name) + '</span>' +
      '</nav>';
  }

  function renderSchoolBanner() {
    const school = state.activeSchool;
    if (!school) return '';
    const unlocked = isUnlocked(school);
    const status = unlocked ? statusInfo() : { tone: 'locked', label: 'Password protected' };
    let count = '';
    if (unlocked && !state.loading && !state.error && state.students.length) {
      count = '<span class="school-banner__count"><strong>' + state.students.length + '</strong> student marks</span>';
    }
    const editUrl = sheetEditUrl(school);
    let editLink = '';
    if (!unlocked) {
      editLink = '<button class="btn btn--light btn--sm school-banner__edit" type="button" data-action="unlock">' +
        '<svg class="icon" aria-hidden="true"><use href="#i-key"/></svg> Enter password</button>';
    } else if (editUrl) {
      editLink = isEntryOpen()
        ? '<a class="btn btn--light btn--sm school-banner__edit" href="' + esc(editUrl) + '" target="_blank" rel="noopener">' +
            '<svg class="icon" aria-hidden="true"><use href="#i-edit"/></svg> Enter / update marks' +
            '<svg class="icon" aria-hidden="true"><use href="#i-external"/></svg></a>'
        : '<span class="btn btn--light btn--sm school-banner__edit is-disabled" aria-disabled="true" title="Marks entry closed on ' + esc(entryDeadlineLong()) + '"><svg class="icon" aria-hidden="true"><use href="#i-lock"/></svg> Entry closed</span>';
    }

    return '' +
      '<section class="school-banner" style="--accent:' + esc(school.accent) + '">' +
        '<div class="school-banner__identity">' +
          '<span class="school-banner__monogram" aria-hidden="true">' + esc(school.monogram) + '</span>' +
          '<div class="school-banner__text">' +
            '<p class="eyebrow eyebrow--light">Class 8th Examination ' + esc(SESSION_YEAR) + '</p>' +
            '<h1>' + esc(school.name) + '</h1>' +
            '<p>' + esc(school.type) + ' <span aria-hidden="true">·</span> Hazratbal, Srinagar</p>' +
          '</div>' +
        '</div>' +
        '<div class="school-banner__meta">' +
          '<span class="status-pill status-pill--' + status.tone + '"><span class="status-pill__dot" aria-hidden="true"></span>' + status.label + '</span>' +
          count +
          (unlocked
            ? '<span class="school-banner__deadline"><svg class="icon" aria-hidden="true"><use href="#i-clock"/></svg> Entry closes ' + esc(entryDeadlineLong()) + '</span>'
            : '<span class="school-banner__deadline"><svg class="icon" aria-hidden="true"><use href="#i-lock"/></svg> Password required</span>') +
          editLink +
        '</div>' +
      '</section>';
  }

  function renderResults() {
    const container = $('#resultsContainer');
    const school = state.activeSchool;
    if (!container || !school) return;

    let body = '';
    if (!isUnlocked(school)) {
      body = renderLocked();
    } else if (state.sheetPending) {
      body = renderSheetPending();
    } else if (state.loading) {
      body = renderLoading();
    } else if (state.error) {
      body = renderError();
    } else if (!state.students.length) {
      body = renderEmpty();
    } else {
      body = renderSheet();
    }

    container.innerHTML = renderCrumbs() +
      renderSchoolBanner() +
      body;
  }

  function renderLocked() {
    const school = state.activeSchool;
    return '' +
      '<div class="state-card state-card--locked">' +
        '<div class="state-illustration" aria-hidden="true">' +
          '<svg viewBox="0 0 120 120" fill="none">' +
            '<circle cx="60" cy="60" r="52" fill="#f3ead9"/>' +
            '<rect x="34" y="52" width="52" height="40" rx="9" fill="#fffdf9" stroke="#8a6a2f" stroke-width="2.5"/>' +
            '<path d="M45 52V43a15 15 0 0 1 30 0v9" stroke="#8a6a2f" stroke-width="2.5" stroke-linecap="round"/>' +
            '<circle cx="60" cy="70" r="4" fill="#8a6a2f"/>' +
            '<path d="M60 74v7" stroke="#8a6a2f" stroke-width="2.5" stroke-linecap="round"/>' +
          '</svg>' +
        '</div>' +
        '<span class="state-badge">Protected sheet</span>' +
        '<h2>This school’s sheet is password protected</h2>' +
        '<p>Enter the access password issued to <strong>' + esc(school.name) + '</strong> to open its read-only view and the marks entry link. Each school has its own password, and no password opens another school’s records.</p>' +
        '<div class="state-actions">' +
          '<button class="btn btn--primary" type="button" data-action="unlock"><svg class="icon" aria-hidden="true"><use href="#i-key"/></svg> Enter password</button>' +
          '<a class="btn btn--ghost" href="#finder">All schools</a>' +
        '</div>' +
        '<p class="state-note">Forgotten the password? Contact the complex head at BHSS Hazratbal — passwords can be reset, but they are never shown on this website.</p>' +
      '</div>';
  }

  function renderLoading() {
    return '' +
      '<div class="sheet-loading" aria-busy="true" aria-live="polite">' +
        '<div class="loading-line"><span class="spinner" aria-hidden="true"></span> Connecting to the official Google Sheet…</div>' +
        '<div class="skeleton skeleton--toolbar"></div>' +
        '<div class="skeleton-wrap">' +
          new Array(7).fill('<div class="skeleton skeleton--row"></div>').join('') +
        '</div>' +
      '</div>';
  }

  function renderError() {
    const school = state.activeSchool;
    return '' +
      '<div class="state-card state-card--error">' +
        '<span class="state-badge state-badge--warn">Connection issue</span>' +
        '<h2>We couldn’t load this result sheet</h2>' +
        '<p>' + esc(state.error) + '</p>' +
        '<p class="state-card__hint">The school’s Google Sheet may be temporarily unavailable, or your connection may have dropped.</p>' +
        '<div class="state-actions">' +
          '<button class="btn btn--primary" type="button" data-action="refresh"><svg class="icon" aria-hidden="true"><use href="#i-refresh"/></svg> Try again</button>' +
          '<a class="btn btn--ghost" href="' + esc(sheetEditUrl(school)) + '" target="_blank" rel="noopener">Open Google Sheet <svg class="icon" aria-hidden="true"><use href="#i-external"/></svg></a>' +
        '</div>' +
      '</div>';
  }

  function renderEmpty() {
    const school = state.activeSchool;
    return '' +
      '<div class="state-card">' +
        '<div class="state-illustration" aria-hidden="true">' +
          '<svg viewBox="0 0 120 120" fill="none">' +
            '<circle cx="60" cy="60" r="52" fill="#e4f0e9"/>' +
            '<path d="M38 28h31l15 15v49a5 5 0 0 1-5 5H38a5 5 0 0 1-5-5V33a5 5 0 0 1 5-5Z" fill="#fffdf9" stroke="#0c5f4a" stroke-width="2.5"/>' +
            '<path d="M69 28v15h15" stroke="#0c5f4a" stroke-width="2.5" stroke-linejoin="round"/>' +
            '<path d="M44 54h32M44 64h32M44 74h20" stroke="#0c5f4a" stroke-width="2.5" stroke-linecap="round" opacity=".45"/>' +
            '<circle cx="82" cy="84" r="17" fill="#e2a03e"/>' +
            '<path d="M82 75v10l6 3" stroke="#3c2a0c" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>' +
          '</svg>' +
        '</div>' +
        '<span class="state-badge">No records yet</span>' +
        '<h2>No records in this sheet yet</h2>' +
        '<p>The Google Sheet for <strong>' + esc(school.name) + '</strong> is currently empty. School staff can add the Class 8th student marks directly in the sheet — once saved, they appear here.</p>' +
        '<div class="state-actions">' +
          (isEntryOpen() ? '<a class="btn btn--primary" href="' + esc(sheetEditUrl(school)) + '" target="_blank" rel="noopener"><svg class="icon" aria-hidden="true"><use href="#i-edit"/></svg> Enter marks in Google Sheet <svg class="icon" aria-hidden="true"><use href="#i-external"/></svg></a>' : '<span class="btn btn--primary is-disabled" aria-disabled="true" title="Marks entry closed on ' + esc(entryDeadlineLong()) + '"><svg class="icon" aria-hidden="true"><use href="#i-lock"/></svg> Marks entry closed</span>') +
          '<button class="btn btn--ghost" type="button" data-action="refresh"><svg class="icon" aria-hidden="true"><use href="#i-refresh"/></svg> Check again</button>' +
        '</div>' +
        '<p class="state-note">Last checked ' + esc(formatChecked(state.fetchedAt)) + ' · This page only reads the sheet; it does not edit or publish it. Entry closes ' + esc(entryDeadlineLong()) + '. Official report cards are issued by DIET.</p>' +
      '</div>';
  }

  function renderSheetPending() {
    const school = state.activeSchool;
    return '' +
      '<div class="state-card">' +
        '<div class="state-illustration" aria-hidden="true">' +
          '<svg viewBox="0 0 120 120" fill="none">' +
            '<circle cx="60" cy="60" r="52" fill="#f3ead9"/>' +
            '<rect x="34" y="34" width="52" height="52" rx="11" fill="#fffdf9" stroke="#8a6a2f" stroke-width="2.5"/>' +
            '<path d="M47 60h26M60 47v26" stroke="#8a6a2f" stroke-width="2.5" stroke-linecap="round" opacity=".38"/>' +
            '<circle cx="82" cy="84" r="17" fill="#e2a03e"/>' +
            '<path d="M82 77v8M82 90v.5" stroke="#3c2a0c" stroke-width="2.6" stroke-linecap="round"/>' +
          '</svg>' +
        '</div>' +
        '<span class="state-badge state-badge--warn">Sheet link pending</span>' +
        '<h2>This school’s sheet is being connected</h2>' +
        '<p>The Google Sheet link for <strong>' + esc(school.name) + '</strong> is not configured yet. Please check back soon, or contact the school office for help.</p>' +
        '<div class="state-actions">' +
          '<a class="btn btn--primary" href="#finder">Browse available school sheets <svg class="icon" aria-hidden="true"><use href="#i-arrow"/></svg></a>' +
          '<a class="btn btn--ghost" href="#contact">Contact the complex</a>' +
        '</div>' +
        '<p class="state-note">The other school sheets in Complex 121 are available now.</p>' +
      '</div>';
  }

  function getFilteredStudents() {
    let list = state.students.slice();
    const query = state.query.trim().toLowerCase();

    if (query) {
      list = list.filter(function (student) {
        return [student.name, student.father, student.mother, student.rollNo, student.admNo]
          .some(function (value) {
            return String(value || '').toLowerCase().includes(query);
          });
      });
    }

    if (state.sort === 'roll') {
      list.sort(function (a, b) { return naturalCompare(a.rollNo, b.rollNo); });
    } else if (state.sort === 'name') {
      list.sort(function (a, b) { return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }); });
    } else if (state.sort === 'total') {
      list.sort(function (a, b) { return (b.grandTotal == null ? -1 : b.grandTotal) - (a.grandTotal == null ? -1 : a.grandTotal); });
    } else {
      list.sort(function (a, b) { return a.idx - b.idx; });
    }

    return list;
  }

  function studentRow(student, index) {
    return '' +
      '<tr class="student-row">' +
        '<td class="cell-index" data-label="#">' + (index + 1) + '</td>' +
        '<td class="cell-roll" data-label="Roll no.">' + esc(student.rollNo || '—') + '</td>' +
        '<td class="cell-name" data-label="Student name">' +
          '<span class="cell-name-text">' + esc(student.name) + '</span>' +
          '<span class="cell-sub">S/O ' + esc(student.father || '—') + '</span>' +
        '</td>' +
        '<td data-label="Father’s name">' + esc(student.father || '—') + '</td>' +
        '<td data-label="Adm. no.">' + esc(student.admNo || '—') + '</td>' +
        '<td class="num" data-label="Grand total"><strong>' + fmt(student.grandTotal) + '</strong></td>' +
        '<td data-label="Remarks">' + remarkBadge(student.remarks) + '</td>' +
      '</tr>';
  }

  function renderStudentRows(list) {
    return list.map(studentRow).join('');
  }

  function renderSheet() {
    const school = state.activeSchool;
    const list = getFilteredStudents();
    const checked = formatChecked(state.fetchedAt);
    const sortOptions = [
      ['sheet', 'Sheet order'],
      ['roll', 'Roll number'],
      ['name', 'Student name'],
      ['total', 'Grand total']
    ];

    return '' +
      '<div class="sheet-panel">' +
        '<div class="sheet-tools no-print">' +
          '<label class="search search--student">' +
            '<svg class="icon" aria-hidden="true"><use href="#i-search"/></svg>' +
            '<span class="sr-only">Search students in this school</span>' +
            '<input id="studentSearch" type="search" value="' + esc(state.query) + '" placeholder="Search by roll no., name, father’s name or adm. no." autocomplete="off">' +
          '</label>' +
          '<div class="sheet-actions">' +
            '<label class="select-wrap">' +
              '<span class="sr-only">Sort students</span>' +
              '<select id="sortSelect">' +
                sortOptions.map(function (option) {
                  return '<option value="' + option[0] + '"' + (state.sort === option[0] ? ' selected' : '') + '>' + option[1] + '</option>';
                }).join('') +
              '</select>' +
              '<svg class="icon" aria-hidden="true"><use href="#i-chevron"/></svg>' +
            '</label>' +
            (isEntryOpen() ? '<a class="btn btn--primary btn--sm" href="' + esc(sheetEditUrl(school)) + '" target="_blank" rel="noopener"><svg class="icon" aria-hidden="true"><use href="#i-edit"/></svg> Enter marks <svg class="icon" aria-hidden="true"><use href="#i-external"/></svg></a>' : '<span class="btn btn--primary btn--sm is-disabled" aria-disabled="true" title="Marks entry closed on ' + esc(entryDeadlineLong()) + '"><svg class="icon" aria-hidden="true"><use href="#i-lock"/></svg> Entry closed</span>') +
            '<button class="btn btn--ghost btn--sm" type="button" data-action="refresh"><svg class="icon" aria-hidden="true"><use href="#i-refresh"/></svg> Refresh</button>' +
            '<button class="btn btn--ghost btn--sm" type="button" data-action="download"' + (state.rawCsv ? '' : ' disabled') + '><svg class="icon" aria-hidden="true"><use href="#i-download"/></svg> CSV</button>' +
            '<button class="btn btn--ghost btn--sm" type="button" data-action="print-sheet"><svg class="icon" aria-hidden="true"><use href="#i-printer"/></svg> Print sheet</button>' +
          '</div>' +
        '</div>' +

        '<div class="sheet-info">' +
          '<span class="status-pill status-pill--live"><span class="status-pill__dot" aria-hidden="true"></span> Read from Google Sheet</span>' +
          '<span id="studentCount">' + list.length + ' of ' + state.students.length + ' students</span>' +
          '<span class="sheet-info__time">Checked ' + esc(checked) + '</span>' +
        '</div>' +

        '<div class="print-head">' +
          '<h2>' + esc(school.name) + '</h2>' +
          '<p>Class 8th Examination Result Sheet · ' + esc(SESSION_YEAR) + ' · DIET BHSS Hazratbal Complex 121</p>' +
        '</div>' +

        '<div class="table-card">' +
          '<table class="sheet-table">' +
            '<caption class="sr-only">Class 8th Examination ' + esc(SESSION_YEAR) + ' result sheet for ' + esc(school.name) + '</caption>' +
            '<thead><tr>' +
              '<th scope="col">#</th>' +
              '<th scope="col">Roll no.</th>' +
              '<th scope="col">Student name</th>' +
              '<th scope="col">Father’s name</th>' +
              '<th scope="col">Adm. no.</th>' +
              '<th scope="col" class="num">Grand total</th>' +
              '<th scope="col">Remarks</th>' +
            '</tr></thead>' +
            '<tbody id="studentRows">' + renderStudentRows(list) + '</tbody>' +
          '</table>' +
        '</div>' +

        '<div class="no-results" id="noStudentMatch"' + (list.length ? ' hidden' : '') + '>' +
          '<svg class="icon" aria-hidden="true"><use href="#i-search"/></svg>' +
          '<p><strong>No matching students.</strong> Try a different roll number, name, or admission number.</p>' +
        '</div>' +

        '<div class="sheet-foot">' +
          '<p>Read directly from the Google Sheet maintained by ' + esc(school.name) + '. This website does not edit or publish the sheet. Official report cards are issued by DIET; this portal does not generate them. In case of any discrepancy, the school record shall prevail.</p>' +
          '<a href="' + esc(sheetEditUrl(school)) + '" target="_blank" rel="noopener">Open in Google Sheets <svg class="icon" aria-hidden="true"><use href="#i-external"/></svg></a>' +
        '</div>' +
      '</div>';
  }

  function updateStudentList() {
    const tbody = $('#studentRows');
    if (!tbody) return;
    const list = getFilteredStudents();
    tbody.innerHTML = renderStudentRows(list);

    const count = $('#studentCount');
    if (count) count.textContent = list.length + ' of ' + state.students.length + ' students';

    const empty = $('#noStudentMatch');
    if (empty) empty.hidden = list.length !== 0;
  }

  /* ------------------------------------------------------------------ */
  /* Actions                                                            */
  /* ------------------------------------------------------------------ */

  function downloadCsv() {
    if (!state.rawCsv || !state.activeSchool) {
      toast('CSV download is not available for this view.');
      return;
    }
    const blob = new Blob([state.rawCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = state.activeSchool.slug + '-class8-marks-' + SESSION_YEAR + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    toast('CSV download started.');
  }

  let toastTimer = null;
  function toast(message) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      el.classList.remove('is-visible');
    }, 3200);
  }

  function bindResultEvents() {
    const container = $('#resultsContainer');
    if (!container) return;

    container.addEventListener('click', function (event) {
      const actionButton = event.target.closest('[data-action]');
      if (!actionButton) return;
      const action = actionButton.getAttribute('data-action');
      if (action === 'refresh' || action === 'retry') reloadSchool();
      if (action === 'download') downloadCsv();
      if (action === 'print-sheet') window.print();
      if (action === 'unlock' && state.activeSchool && AUTH) {
        AUTH.open(state.activeSchool.slug, 'view');
      }
    });

    container.addEventListener('input', function (event) {
      if (event.target.id === 'studentSearch') {
        state.query = event.target.value;
        updateStudentList();
      }
    });

    container.addEventListener('change', function (event) {
      if (event.target.id === 'sortSelect') {
        state.sort = event.target.value;
        updateStudentList();
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Access changes                                                     */
  /* ------------------------------------------------------------------ */

  function updateSignOut() {
    const button = $('#signOutBtn');
    if (!button) return;
    const unlockedAny = Boolean(AUTH) && SCHOOLS.some(function (school) {
      return AUTH.isUnlocked(school.slug);
    });
    button.hidden = !unlockedAny;
    button.title = AUTH && AUTH.isAdminSession()
      ? 'Signed in as complex head — click to lock every school'
      : 'Lock all school sheets on this device';
  }

  function handleAccessChange(detail) {
    const info = detail || {};
    updateSignOut();
    renderSchools();

    if (info.type === 'lock') {
      cache.clear();
      if (state.activeSchool) {
        state.students = [];
        state.rawCsv = '';
        state.fetchedAt = null;
        state.error = '';
        state.loading = false;
        state.sheetPending = false;
        renderResults();
        updateTitle();
      }
      return;
    }

    if (info.type === 'unlock') {
      const onActiveSheet = Boolean(state.activeSchool) &&
        state.activeSchool.slug === info.slug &&
        document.body.classList.contains('is-results');

      if (onActiveSheet) {
        state.students = [];
        state.rawCsv = '';
        state.fetchedAt = null;
        state.error = '';
        state.loading = true;
        state.sheetPending = false;
        renderResults();
        loadSchool(state.activeSchool, false);
      } else if (info.intent === 'view') {
        window.location.hash = '#/school/' + encodeURIComponent(info.slug);
      }

      if (info.admin) {
        toast('Complex head access granted for this session.');
      } else if (!onActiveSheet && info.intent !== 'view') {
        toast('Unlocked. Choose Enter marks to open the Google Sheet.');
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Header, mobile navigation, scroll                                  */
  /* ------------------------------------------------------------------ */

  function openNav() {
    document.body.classList.add('nav-open');
    const toggle = $('#navToggle');
    if (toggle) {
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Close navigation');
    }
  }

  function closeNav() {
    document.body.classList.remove('nav-open');
    const toggle = $('#navToggle');
    if (toggle) {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open navigation');
    }
  }

  function bindHeader() {
    const toggle = $('#navToggle');
    if (toggle) {
      toggle.addEventListener('click', function () {
        if (document.body.classList.contains('nav-open')) closeNav();
        else openNav();
      });
    }

    document.addEventListener('click', function (event) {
      if (!document.body.classList.contains('nav-open')) return;
      if (event.target.closest('.site-header')) return;
      closeNav();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeNav();
    });

    const nav = $('#primaryNav');
    if (nav) {
      nav.addEventListener('click', function (event) {
        if (event.target.closest('a')) closeNav();
      });
    }

    const signOut = $('#signOutBtn');
    if (signOut) {
      signOut.addEventListener('click', function () {
        if (!AUTH) return;
        AUTH.lockAll();
        toast('Signed out. All school sheets are locked.');
      });
    }

    let ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        document.body.classList.toggle('is-scrolled', window.scrollY > 8);
        ticking = false;
      });
    }, { passive: true });
  }

  function applySessionYear() {
    if (!SESSION_YEAR || SESSION_YEAR === '2026') return;
    try {
      const re = /2026/g;
      const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT, null);
      let node;
      while ((node = walker.nextNode())) {
        if (node.nodeValue && node.nodeValue.indexOf('2026') !== -1) {
          node.nodeValue = node.nodeValue.replace(re, SESSION_YEAR);
        }
      }
      document.querySelectorAll('meta[content]').forEach(function (el) {
        const c = el.getAttribute('content');
        if (c && c.indexOf('2026') !== -1) {
          el.setAttribute('content', c.replace(re, SESSION_YEAR));
        }
      });
      if (document.title.indexOf('2026') !== -1) {
        document.title = document.title.replace(re, SESSION_YEAR);
      }
    } catch (error) {
      /* leave the page as-is if anything goes wrong */
    }
  }

  function applyEntryStatus() {
    const banner = $('#entryStatusBanner');
    if (!banner) return;
    if (isEntryOpen()) {
      banner.hidden = true;
      banner.classList.remove('is-closed');
      banner.innerHTML = '';
      return;
    }
    banner.hidden = false;
    banner.classList.add('is-closed');
    banner.innerHTML = 'Marks entry closed on ' + esc(entryDeadlineLong()) +
      '. The read-only sheet view remains available; contact the school office for corrections.';
    const openLink = document.querySelector('.for-schools a.btn--light');
    if (openLink) {
      const span = document.createElement('span');
      span.className = 'btn btn--light is-disabled';
      span.setAttribute('aria-disabled', 'true');
      span.textContent = 'Marks entry closed';
      openLink.replaceWith(span);
    }
  }

  function setClockUnit(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value).padStart(2, '0');
  }

  function updateCountdown() {
    const clock = $('#entryClock');
    if (!clock) return;
    const title = $('#entryWindowTitle');
    const deadlineLabel = $('#entryDeadlineLabel');
    const card = clock.closest('.entry-window');
    const end = new Date(ENTRY_DEADLINE + 'T23:59:59').getTime();
    const remaining = end - Date.now();
    if (deadlineLabel) deadlineLabel.textContent = entryDeadlineLong();

    if (remaining <= 0) {
      setClockUnit('clockDays', 0);
      setClockUnit('clockHours', 0);
      setClockUnit('clockMinutes', 0);
      setClockUnit('clockSeconds', 0);
      if (card) card.classList.add('is-closed');
      if (title) title.innerHTML = 'Marks entry has closed <span>' + esc(entryDeadlineLong()) + '</span>';
      return;
    }

    if (card) card.classList.remove('is-closed');
    const total = Math.floor(remaining / 1000);
    setClockUnit('clockDays', Math.floor(total / 86400));
    setClockUnit('clockHours', Math.floor((total % 86400) / 3600));
    setClockUnit('clockMinutes', Math.floor((total % 3600) / 60));
    setClockUnit('clockSeconds', total % 60);
  }

  function init() {
    applySessionYear();
    applyEntryStatus();
    updateCountdown();
    window.setInterval(updateCountdown, 1000);
    renderSchools();
    bindSchoolFinder();
    bindHeader();
    bindResultEvents();
    if (AUTH) AUTH.onChange(handleAccessChange);
    updateSignOut();
    handleRoute();
    window.addEventListener('hashchange', handleRoute);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
