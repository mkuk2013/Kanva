# Design Studio App — Blueprint (Canva-style, original name & code)
Prepared: 2026-10-14 | Owner: Mukesh Kumar

## Concept
Website + PWA (installable on phone, works like an app) — online graphic design editor
inspired by Canva's workflow, built with original code, templates and assets.
NOT a copy of Canva's branding, templates or stock library (that would be copyright).

## Core Editor Features (v1 — fully functional)
- Preset sizes: Instagram Post 1080x1080, Story/Reel 1080x1920, FB Post 1200x630,
  YouTube Thumbnail 1280x720, Logo 500x500, Presentation 1920x1080, A4, Custom size
- Drag, resize, rotate any object; multi-select; snap guides
- Text: add heading/subheading/body, 20+ fonts, size, bold/italic, color, spacing, alignment, shadow
- Elements: shapes (rect, circle, triangle, star, line, arrow), icons/emojis, frames
- Backgrounds: solid colors, gradients, patterns, image backgrounds
- Photos: built-in gradient/photo placeholders + user uploads (own photos/logos)
- Uploads: PNG/JPG/SVG upload, re-use in any design
- Layers panel: reorder, lock, hide, duplicate, delete; bring forward / send back
- Undo / Redo, Zoom in/out, Copy/Paste object
- Templates library: 20+ ready templates (social post, sale, birthday, business, YouTube, etc.)
  — Free templates open to all, Pro templates locked for Pro users
- My Designs: save / open / rename / delete projects (browser storage in v1, account cloud in v2)
- Export: PNG (HD), JPG, PDF — Free = standard + small watermark option, Pro = HD no watermark
- Brand kit (Pro): save logo, brand colors, fonts

## Plans
- FREE: core editor, free templates/elements, own uploads, PNG/JPG export (standard), 5 saved projects
- PRO (sample pricing — Mukesh to confirm): Rs 599/month, Rs 4,999/year
  Pro: all templates/elements, HD export no watermark, unlimited projects, background remover (basic),
  brand kit, premium fonts

## Payment — Easypaisa (manual verification, same proven pattern as Apna IT School)
- Pay to: Easypaisa 03363268833 — Account Title: Mukesh Kumar
- Flow: User selects Pro plan -> sees number + title -> sends money in Easypaisa app ->
  enters Transaction ID (TID) + uploads payment screenshot -> order = Pending ->
  Admin (Mukesh) verifies -> Pro activates. No fake auto-gateway; Easypaisa has no public
  instant API for individuals, so manual verification is the honest launch route.

## Tech
- Frontend editor: HTML/CSS/JS + Fabric.js canvas engine (PWA: manifest + service worker, offline)
- v1: single deployable web app (Netlify/GitHub Pages ready), data in localStorage/IndexedDB
- v2 (if needed): Laravel/Node backend for accounts, cloud designs, admin panel for payment approvals

## Name — pending Mukesh choice
Options: Kanva / Weblitex Studio / PixelKaro
Domain idea: designkaro.weblitex.com or studio.weblitex.com (free subdomain to start)
