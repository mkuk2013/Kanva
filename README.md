# Kanva — Design Editor (Website + PWA App)

Canva-style online design editor with original code, templates and name.
Owner: Mukesh Kumar · Payments: Easypaisa 03363268833 (Mukesh Kumar)

## Run / Deploy
- Any static hosting works: Netlify, GitHub Pages, Hostcry, Vercel.
- Upload all files (index.html, style.css, app.js, manifest.json, sw.js, icons/) to the site root.
- Must be served over HTTPS for the PWA install + service worker to work.
- Suggested free start: subdomain kanva.weblitex.com or Netlify.

## Features
- Editor: 8 preset sizes, drag/resize/rotate, text + fonts + shadow + stroke,
  shapes, stickers, uploads, backgrounds (color/gradient), layers panel,
  undo/redo, zoom, duplicate/delete/forward/back.
- 10 ready templates (5 Free, 5 Pro-locked).
- Save designs in the browser (Free: 5, Pro: unlimited). Export PNG (standard/HD),
  JPG, PDF. Free exports carry a small "Made with Kanva" mark; Pro = HD, no mark.
- Plans: Free / Pro Rs 599 per month, Rs 4,999 per year.
- Payment flow: user sends Easypaisa to 03363268833 (Mukesh Kumar), submits TID +
  optional screenshot -> order = Pending -> Admin (top nav) verifies TID in
  Easypaisa and Approves -> Pro activates.
- PWA: manifest + service worker; installable on Android from Chrome menu.

## Data note (v1)
Designs, uploads and orders are stored in the visitor's own browser
(localStorage) — no server or database needed to launch. For multi-device
accounts/cloud storage, a backend (v2) can be added later.

## Rename
Change the name in index.html (title/brand), app.js APP_NAME, manifest.json.
