# DIET BHSS Hazratbal Complex 121 — Class 8th Marks Portal 2026

A static, mobile-responsive marks-entry portal for the 11 schools under **DIET BHSS Hazratbal Complex 121, Srinagar**.

This website is **not** a result-publishing or report-card system. Each school maintains its own Class 8th Examination 2026 marks in a Google Sheet. The portal gives every school a simple way to open its editable sheet, and provides a read-only view so entries can be checked.

> **Report cards are issued by DIET**, not by Complexhead. The portal does not generate or print individual report cards.

## Live site

After deployment:

**https://aaqibjeelani.github.io/complexhead/**

## What the portal does

- Lists all 11 schools in the complex.
- Gives each school an **Enter marks** button that opens its editable Google Sheet in a new tab.
- Lets anyone open a **read-only view** of a school’s marks sheet.
- Searches the read-only view by roll number, student name, father’s name, or admission number.
- Provides **Print sheet** and **CSV** options for the school’s marks table.
- Shows a **live countdown** to the marks-entry deadline and disables entry automatically once it passes.
- Clearly states that official report cards are issued by DIET.

## Project structure

```text
complexhead/
├── index.html
├── .nojekyll
├── README.md
└── assets/
    ├── css/
    │   └── styles.css
    ├── img/
    │   ├── aj-logo.png
    │   ├── building.jpg
    │   └── crest.svg
    └── js/
        ├── app.js
        └── schools.js
```

There is no build step, package manager, or framework. Open `index.html` or serve the folder with any static server.

## How the data works

The site reads the first sheet in each Google Sheet through Google’s public CSV endpoint:

```text
https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq?tqx=out:csv
```

The parser expects these columns:

| Column | Field |
| --- | --- |
| 0 | SNO |
| 1 | School-wise SNO |
| 2 | Admission number |
| 3 | Roll number |
| 4 | Student name |
| 5 | Father’s name |
| 6 | Mother’s name |
| 7 | School |
| 8 | Date of birth |
| 9–14 | Formative assessment marks |
| 15 | Formative assessment total |
| 16–21 | Summative assessment marks |
| 22 | Summative assessment total |
| 23 | Grand total |
| 24 | Remarks |

Rows without a student name are ignored. If a sheet contains only the blank template, the read-only view shows a **“No records in this sheet yet”** state with a link to the editable sheet.

## School sheet mapping

All 11 school sheet IDs are in:

```text
assets/js/schools.js
```

| School | Google Sheet ID |
| --- | --- |
| GHS Hazratbal | `1CEncoVVMl_vy8L_4CMDod-lraZP4vfvRuFBWi6PsoWI` |
| BMS Hazratbal | `1CFQld2EgbiXUkUneS6g7kgRy86ahdudzNZ3CWA-YnSM` |
| BMS Bagat-i-Shor | `1HCneEqU1AVxl0dkqIuJcvQixziO6oyTYkEhTJxIO8y0` |
| Govt Middle School Batapora | `1XiFIVSATsebBdwKmCGVWJlNmBlw_edfrCtf2rLjjx_8` |
| Greenland High School Nigeen | `1gPAqHVxrsQ-68hUqrwFifwKVH6FSZ6Wj7Tydutvdapo` |
| Legends School of Education Sadrabal | `1R8x2QozZsERHKIfDXZR9RoK1ye6VD13Uo4k2v0ILThU` |
| New Lifeline Educational Institute | `1KMYXbT7E-lziSICM-gQveUKXZsDZcz_NMvuQzne4g5Y` |
| Crescent Public School | `1KZjGMO2VAgCKqFdDBVicLLPtchOuWwTSFQuHoxq1m7g` |
| RP School Malbagh | `1lu_fEhXQ_fUqAzdtLhMm7w9t-8CC7PodRugQ2P8VTa4` |
| University Model School | `1VgQ3wygnRatX2HwZ03V8D7ZwJq7A4cT-8kD329u2k2M` |
| Vision School of Education | `1AgSI9nXG9JDqJucwaBY0LLVvpB9WnV9Z8-DHBGVGH-k` |

Each `schools.js` entry looks like this:

```js
{
  slug: 'ghs-hazratbal',
  name: 'GHS Hazratbal',
  type: 'Government High School',
  group: 'govt',
  monogram: 'GH',
  accent: '#0c6b52',
  sheetId: '1CEncoVVMl_vy8L_4CMDod-lraZP4vfvRuFBWi6PsoWI'
}
```

To change a sheet, replace `sheetId` with the ID from the school’s Google Sheet URL:

```text
https://docs.google.com/spreadsheets/d/THIS_IS_THE_SHEET_ID/edit
```

The sheet must be accessible to anyone with the link (or published to the web) for the in-browser reader to work.

## Local preview

From the project folder:

```powershell
python -m http.server 8765
```

Then open:

```text
http://localhost:8765/
```

Any static server works (for example, `npx serve` or the VS Code Live Server extension).

## Deploy to GitHub Pages

1. Create (or use) the GitHub repository named **`complexhead`** under `aaqibjeelani`.
2. Push the contents of this folder to the `main` branch.
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the **`main`** branch and the **`/ (root)`** folder, then save.
6. Wait for the deployment to finish and open:

   **https://aaqibjeelani.github.io/complexhead/**

All asset paths are relative, so the site works correctly under the `/complexhead/` subpath.

## Entry deadline & countdown

A prominent countdown card sits at the top of the home page and shows the time left until `ENTRY_DEADLINE` (default: 31 October 2026).

- While entry is open, the **Enter marks** links work and the card shows days, hours, minutes, seconds.
- After the deadline, a global banner appears, every **Enter marks** link becomes a disabled **Entry closed** control, and the card shows *“Marks entry has closed”*.
- The read-only sheet view, search, sort, CSV and **Print sheet** keep working after entry closes.
- To re-open or extend entry, change only `window.ENTRY_DEADLINE` in `assets/js/schools.js` (for example `'2026-11-15'`).

The two globals that drive the year and the deadline live at the very top of `assets/js/schools.js`:

```js
window.COMPLEX_SESSION = '2026';        // session year shown across the site
window.ENTRY_DEADLINE = '2026-10-31';   // last day marks entry is open (23:59:59 local)
```

## Yearly reuse (only two lines to change)

The Google Sheets are reused every academic year. Before the new session:

1. Open each school's Google Sheet and delete the old student rows (keep the header row).
2. Open `assets/js/schools.js` and change only these two lines at the top:

   ```js
   window.COMPLEX_SESSION = '2027';        // new session year
   window.ENTRY_DEADLINE = '2027-10-31';   // last day marks entry is open
   ```

   Everything else — titles, cards, banners, print header, CSV file names, and the session label across the page — updates automatically. The sheet IDs stay the same, so no other file needs editing.

3. After the deadline passes, all **Enter marks** links disable themselves automatically. To re-open or extend entry, just move `ENTRY_DEADLINE` to a later date.

## Notes

- No cookies, analytics, or backend are used.
- The site reads the sheets directly in the browser. Google Sheets must allow public read access.
- The website does not modify the Google Sheets. School staff edit the sheets directly in Google Sheets.
- The **Print sheet** action prints the tabular school marks sheet. It does not generate an individual report card.
- Official report cards are issued by DIET.

## Developer

**Developed by Aaqib Jeelani**

- Website: https://aaqibjeelani.github.io/
- Logo: https://aaqibjeelani.github.io/ajvirus/images/transparentlogo%20aj.png
- Design, development & maintenance of the Complex 121 marks portal.

DIET BHSS Hazratbal, Complex 121, NIT Entrance Road, Hazratbal, Srinagar, Jammu & Kashmir — 190006.
