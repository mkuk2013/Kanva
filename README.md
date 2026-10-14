# Kanva — Design, Present, Wow (v2)

Canva-style online design platform with original code, templates and name.
Owner: Mukesh Kumar · Payments: Easypaisa 03363268833 (Mukesh Kumar)

## What's inside (v2)
- **Login system** — email sign up / log in / log out, per-user accounts,
  projects, plans and brand kit. Demo account button for instant try.
  (Static build: accounts live in the browser. For accounts that sync across
  all devices, connect a backend like Supabase in v3.)
- **Canva-style dashboard** — sidebar (Home, Your projects, Templates,
  Brand Kit, Plans, Trash), search, "What will you design today?" hero with
  design-type shortcuts, recent designs, projects with rename/duplicate/trash,
  trash restore, template categories + search.
- **Editor** — Canva-style top bar (File, Resize, undo/redo, doc title,
  Share, Download), contextual editing toolbar, Templates / Elements /
  Text / Photos / Uploads / Styles / Layers panels, zoom pill, Ctrl+S save,
  keyboard shortcuts, share link for any design.
- **20 templates** (10 Free, 10 Pro) in 6 categories; free stock Photos tab;
  shapes, lines/arrows, frames, bar chart, badges, 20 stickers.
- **Export** PNG (standard / HD Pro), JPG, PDF. Free exports carry a small
  "Made with Kanva" mark; Pro = HD, no mark.
- **Plans** — Free (5 projects) / Pro Rs 599 per month, Rs 4,999 per year.
  Payment: Easypaisa to 03363268833 (Mukesh Kumar) → user submits TID +
  screenshot → Admin panel (sidebar) verifies → Pro activates for that user.
- **PWA** — manifest + service worker, installable on Android (HTTPS needed).

## Deploy
Any static hosting (Netlify, GitHub Pages, Hostcry). Upload all files to the
site root over HTTPS. Icons live at repo root: "Kanva icon 192.png" and
"Kanva icon 512.png" (names must match manifest.json references).
