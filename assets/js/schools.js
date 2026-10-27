/*
 * School directory for DIET BHSS Hazratbal Complex 121.
 * Each sheetId points to the school's official Class 8th result Google Sheet.
 * The gviz CSV endpoint is used to read the first sheet at runtime.
 *
 * ============================================================
 *  YEARLY SETTINGS — change these two lines each academic year
 * ============================================================
 *  COMPLEX_SESSION  : the session year shown throughout the site.
 *  ENTRY_DEADLINE   : last day (YYYY-MM-DD) marks entry is open.
 *                     After this date all "Enter marks" links are
 *                     disabled automatically. Set a future date to
 *                     re-enable or extend the entry window.
 *  The Google Sheets themselves are reused every year; just clear
 *  the old rows in each sheet before the new session.
 * ============================================================
 */
window.COMPLEX_SESSION = '2026';
window.ENTRY_DEADLINE = '2026-10-31';

/*
 * ============================================================
 *  SCHOOL ACCESS PASSWORDS
 * ============================================================
 *  Each school opens only with its own password. Only a salted,
 *  iterated SHA-256 hash is stored here — never the password itself.
 *
 *  To change a password, run `tools/make-password.html` (open it in a
 *  browser, or use the helper described in the README), then replace
 *  that school's `access.salt` and `access.hash` below.
 *
 *  NOTE: this is a static GitHub Pages site, so the check runs in the
 *  browser. It stops schools and visitors from browsing each other's
 *  sheets through this portal, but a technical user who reads the
 *  source can still find the sheet IDs. Keep each Google Sheet's
 *  sharing settings restricted for real protection.
 * ============================================================
 */
window.COMPLEX_ACCESS = {
  iterations: 8000,        // password hashing rounds
  sessionHours: 8,         // how long an unlock lasts in this tab
  rememberDays: 7,         // "keep me signed in" duration on this device
  admin: {
    label: 'Complex head',
    salt: 'dfcc872601bb217d',
    hash: '0ebb43849bf9a3234d9af313b0d71f1d6250d7a5a65eaa213e85d9fa56d16300'
  }
};

window.COMPLEX_SCHOOLS = [
  {
    slug: 'ghs-hazratbal',
    name: 'GHS Hazratbal',
    type: 'Government High School',
    group: 'govt',
    monogram: 'GH',
    accent: '#0c6b52',
    sheetId: '1CEncoVVMl_vy8L_4CMDod-lraZP4vfvRuFBWi6PsoWI',
    access: {
      salt: 'ec968a7c5413db84',
      hash: '3a5a63c788f28e912e9a9ef55b41b2c88469805fd5cdd853257eef8583168194'
    }
  },
  {
    slug: 'bms-hazratbal',
    name: 'BMS Hazratbal',
    type: 'Government Middle School',
    group: 'govt',
    monogram: 'BH',
    accent: '#17756b',
    sheetId: '1CFQld2EgbiXUkUneS6g7kgRy86ahdudzNZ3CWA-YnSM',
    access: {
      salt: 'f8e9d01fcf4721ea',
      hash: '8764d1644c801cc99fddf468e14bd12a9bc415f52f93ab9ade00a9c5a415a462'
    }
  },
  {
    slug: 'bms-bagat-i-shor',
    name: 'BMS Bagat-i-Shor',
    type: 'Government Middle School',
    group: 'govt',
    monogram: 'BB',
    accent: '#4b7037',
    sheetId: '1HCneEqU1AVxl0dkqIuJcvQixziO6oyTYkEhTJxIO8y0',
    access: {
      salt: '1ffdec5ce5d9062a',
      hash: 'f09a77036eb70457bc6bbd428bc63f576c7796659201dc921d53d8a03d16eb6d'
    }
  },
  {
    slug: 'gms-batapora',
    name: 'Govt Middle School Batapora',
    type: 'Government Middle School',
    group: 'govt',
    monogram: 'BP',
    accent: '#8a6a2f',
    sheetId: '1XiFIVSATsebBdwKmCGVWJlNmBlw_edfrCtf2rLjjx_8',
    access: {
      salt: 'ba4e807d14509763',
      hash: '7dcad990a376d1fc7f7f6a7ab8b06a65458ee8ff638822a425d3f44be717bf3e'
    }
  },
  {
    slug: 'greenland-nigeen',
    name: 'Greenland High School Nigeen',
    type: 'Private High School',
    group: 'private',
    monogram: 'GN',
    accent: '#2f6b8f',
    sheetId: '1gPAqHVxrsQ-68hUqrwFifwKVH6FSZ6Wj7Tydutvdapo',
    access: {
      salt: '5a5083a4480c29d6',
      hash: 'e44cd82899895508844ab7dbf3193b92d4d004daa51a516fe14e9e1e72439943'
    }
  },
  {
    slug: 'legends-sadrabal',
    name: 'Legends School of Education Sadrabal',
    type: 'Private School',
    group: 'private',
    monogram: 'LE',
    accent: '#7b4b8a',
    sheetId: '1R8x2QozZsERHKIfDXZR9RoK1ye6VD13Uo4k2v0ILThU',
    access: {
      salt: '207fa66ec0476f32',
      hash: '9d4d3599ab69134e240f874bb1ed8c0701438a7fa9dbb889f54d279aec5a66e6'
    }
  },
  {
    slug: 'new-lifeline',
    name: 'New Lifeline Educational Institute',
    type: 'Private School',
    group: 'private',
    monogram: 'NL',
    accent: '#b5532f',
    sheetId: '1KMYXbT7E-lziSICM-gQveUKXZsDZcz_NMvuQzne4g5Y',
    access: {
      salt: 'ee3b8c4536d25943',
      hash: 'e3dc1fb9369e0a40a35ce39bd5e53312874d392b4cf554202cdcb56ba03b2244'
    }
  },
  {
    slug: 'crescent-public-school',
    name: 'Crescent Public School',
    type: 'Private School',
    group: 'private',
    monogram: 'CP',
    accent: '#1f6f7a',
    sheetId: '1KZjGMO2VAgCKqFdDBVicLLPtchOuWwTSFQuHoxq1m7g',
    access: {
      salt: 'c9be55ab8513e14e',
      hash: 'b1ff98c3020d57e82ae2fd8f5a31306a26411ea04a78e92ee0c721696c36ac3b'
    }
  },
  {
    slug: 'rp-school-malbagh',
    name: 'RP School Malbagh',
    type: 'Private School',
    group: 'private',
    monogram: 'RP',
    accent: '#8a5a2b',
    sheetId: '1lu_fEhXQ_fUqAzdtLhMm7w9t-8CC7PodRugQ2P8VTa4',
    access: {
      salt: 'f3da2ebebccff75b',
      hash: 'd3954bd13546db6c2970b75c68514055ce7da92211261e9179d4d72966937102'
    }
  },
  {
    slug: 'university-model-school',
    name: 'University Model School',
    type: 'Private School',
    group: 'private',
    monogram: 'UM',
    accent: '#35558c',
    sheetId: '1VgQ3wygnRatX2HwZ03V8D7ZwJq7A4cT-8kD329u2k2M',
    access: {
      salt: 'd5af349ff2798201',
      hash: '68d38c717637a3faae4709773e2fdaba1a494d73e9ce2ccdf4b01f536590df2f'
    }
  },
  {
    slug: 'vision-school',
    name: 'Vision School of Education',
    type: 'Private School',
    group: 'private',
    monogram: 'VS',
    accent: '#6d5a2e',
    sheetId: '1AgSI9nXG9JDqJucwaBY0LLVvpB9WnV9Z8-DHBGVGH-k',
    access: {
      salt: '029b5ec80963258f',
      hash: '8ef04a61c4ad342cc76bfd408d2d332a681a6542aaa2d32aeb749a4fe2a52f33'
    }
  }
];
