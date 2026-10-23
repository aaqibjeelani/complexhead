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

window.COMPLEX_SCHOOLS = [
  {
    slug: 'ghs-hazratbal',
    name: 'GHS Hazratbal',
    type: 'Government High School',
    group: 'govt',
    monogram: 'GH',
    accent: '#0c6b52',
    sheetId: '1CEncoVVMl_vy8L_4CMDod-lraZP4vfvRuFBWi6PsoWI'
  },
  {
    slug: 'bms-hazratbal',
    name: 'BMS Hazratbal',
    type: 'Government Middle School',
    group: 'govt',
    monogram: 'BH',
    accent: '#17756b',
    sheetId: '1CFQld2EgbiXUkUneS6g7kgRy86ahdudzNZ3CWA-YnSM'
  },
  {
    slug: 'bms-bagat-i-shor',
    name: 'BMS Bagat-i-Shor',
    type: 'Government Middle School',
    group: 'govt',
    monogram: 'BB',
    accent: '#4b7037',
    sheetId: '1HCneEqU1AVxl0dkqIuJcvQixziO6oyTYkEhTJxIO8y0'
  },
  {
    slug: 'gms-batapora',
    name: 'Govt Middle School Batapora',
    type: 'Government Middle School',
    group: 'govt',
    monogram: 'BP',
    accent: '#8a6a2f',
    sheetId: '1XiFIVSATsebBdwKmCGVWJlNmBlw_edfrCtf2rLjjx_8'
  },
  {
    slug: 'greenland-nigeen',
    name: 'Greenland High School Nigeen',
    type: 'Private High School',
    group: 'private',
    monogram: 'GN',
    accent: '#2f6b8f',
    sheetId: '1gPAqHVxrsQ-68hUqrwFifwKVH6FSZ6Wj7Tydutvdapo'
  },
  {
    slug: 'legends-sadrabal',
    name: 'Legends School of Education Sadrabal',
    type: 'Private School',
    group: 'private',
    monogram: 'LE',
    accent: '#7b4b8a',
    sheetId: '1R8x2QozZsERHKIfDXZR9RoK1ye6VD13Uo4k2v0ILThU'
  },
  {
    slug: 'new-lifeline',
    name: 'New Lifeline Educational Institute',
    type: 'Private School',
    group: 'private',
    monogram: 'NL',
    accent: '#b5532f',
    sheetId: '1KMYXbT7E-lziSICM-gQveUKXZsDZcz_NMvuQzne4g5Y'
  },
  {
    slug: 'crescent-public-school',
    name: 'Crescent Public School',
    type: 'Private School',
    group: 'private',
    monogram: 'CP',
    accent: '#1f6f7a',
    sheetId: '1KZjGMO2VAgCKqFdDBVicLLPtchOuWwTSFQuHoxq1m7g'
  },
  {
    slug: 'rp-school-malbagh',
    name: 'RP School Malbagh',
    type: 'Private School',
    group: 'private',
    monogram: 'RP',
    accent: '#8a5a2b',
    sheetId: '1lu_fEhXQ_fUqAzdtLhMm7w9t-8CC7PodRugQ2P8VTa4'
  },
  {
    slug: 'university-model-school',
    name: 'University Model School',
    type: 'Private School',
    group: 'private',
    monogram: 'UM',
    accent: '#35558c',
    sheetId: '1VgQ3wygnRatX2HwZ03V8D7ZwJq7A4cT-8kD329u2k2M'
  },
  {
    slug: 'vision-school',
    name: 'Vision School of Education',
    type: 'Private School',
    group: 'private',
    monogram: 'VS',
    accent: '#6d5a2e',
    sheetId: '1AgSI9nXG9JDqJucwaBY0LLVvpB9WnV9Z8-DHBGVGH-k'
  }
];