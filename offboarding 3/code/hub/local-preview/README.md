# Local preview of the Digi Hub

This folder lets a developer run the Hub on their own computer against a **pretend database**, so changes can be tested safely.
Nothing here touches the real Hub or its data.

1. `python3 make-preview.py`  (builds `index.html` and a `heatmap/` folder)
2. `python3 -m http.server 8766`
3. Open http://localhost:8766/ in a browser.

`mock.js` replaces the Claude page runtime (`window.claude`) with an in-memory database that behaves like the real one:
its objects are frozen (as the real ones are), it supports `collection().doc().get/set/update/delete`, `add`, `onSnapshot`,
`orderBy` and `limit`. It resets on every reload.

## Loading sample data
Open the browser console on the preview page and run, for example:

```js
const db = await claude.use('db');
await db.collection('advisors').doc('a-test').set({company:'Test Financial', advisor:'Pat Test', dma:'Cameron Cogswell', hours:3, mgmtFee:1500, runs:['hnw'], locations:[{place:'Denver, CO', zip:'80202'}]});
await db.collection('billing').doc('2026-a-test').set({advisorId:'a-test', year:2026, m1:'yes', m2:'yes', m3:'yes'});
```

You can load the real backups the same way: read the JSON files in `../../../data-backup/hub/<collection>/` and `set` each one.
(The files store the document fields exactly as the database holds them.)

## Unlocking things in the preview
* **Management:** in the console run `sessionStorage.setItem('dm_mgmt_unlocked','1')` and reload.
* **Advisors password:** run
  `const db = await claude.use('db'); const h = await window.hubHashPassword('test123'); await db.collection('site_access').doc('advisors').set({internal:h, onboarding:await window.hubHashPassword('onb123')});`
  then open Advisors and type `test123`.

To simulate a failing connection, run `localStorage.setItem('__failSnap','kudos,site_access')` and reload (remove the key to stop).
