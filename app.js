/* ============================================================
   KANVA v2 — Canva-style design platform (original code)
   Auth + Dashboard + Editor + Templates + Easypaisa Pro
   ============================================================ */
const APP_NAME = 'Kanva';
/* Google Sign-In: paste the OAuth Web Client ID (ends with .apps.googleusercontent.com).
   It is a PUBLIC identifier (not a secret) — safe in frontend code. */
const GOOGLE_CLIENT_ID = '';
const EASYPAISA_NUMBER = '03363268833';
const PRICES = { monthly: 599, yearly: 4999 };
const SIZES = [
  { id:'ig-post',  name:'Instagram Post',    w:1080, h:1080, icon:'📸' },
  { id:'ig-story', name:'Story / Reel',      w:1080, h:1920, icon:'📱' },
  { id:'fb-post',  name:'Facebook Post',     w:1200, h:630,  icon:'👍' },
  { id:'yt-thumb', name:'YouTube Thumbnail', w:1280, h:720,  icon:'▶️' },
  { id:'logo',     name:'Logo',              w:500,  h:500,  icon:'⭕' },
  { id:'pres',     name:'Presentation',      w:1920, h:1080, icon:'📊' },
  { id:'poster',   name:'Poster',            w:794,  h:1123, icon:'🖼️' },
  { id:'fb-cover', name:'Facebook Cover',    w:1640, h:924,  icon:'🌆' },
];
const FONTS = ['Poppins','Inter','Montserrat','Roboto','Oswald','Bebas Neue','Playfair Display','Pacifico','Dancing Script','Anton','Lobster','Arial','Georgia','Verdana','Courier New'];

/* ---------------- AUTH ---------------- */
let authMode = 'login';
let currentUser = null;
function hashPw(s){ let h = 5381; for (let i=0;i<s.length;i++) h = ((h<<5)+h+s.charCodeAt(i))>>>0; return 'h'+h.toString(16); }
function getUsers(){ return JSON.parse(localStorage.getItem('kv_users') || '[]'); }
function saveUsers(u){ localStorage.setItem('kv_users', JSON.stringify(u)); }
function toggleAuthMode(e){
  if (e) e.preventDefault();
  authMode = authMode === 'login' ? 'signup' : 'login';
  document.getElementById('auName').style.display = authMode === 'signup' ? '' : 'none';
  document.getElementById('authTitle').textContent = authMode === 'signup' ? 'Create your free account' : 'Log in or sign up';
  document.getElementById('authSubmit').textContent = authMode === 'signup' ? 'Sign up free' : 'Continue';
  document.getElementById('authSwitchText').textContent = authMode === 'signup' ? 'Already have an account?' : 'New to Kanva?';
  document.getElementById('authSwitchLink').textContent = authMode === 'signup' ? 'Log in' : 'Sign up free';
  document.getElementById('authErr').textContent = '';
}
function handleAuth(e){
  e.preventDefault();
  const email = document.getElementById('auEmail').value.trim().toLowerCase();
  const pass = document.getElementById('auPassword').value;
  const name = document.getElementById('auName').value.trim();
  const err = document.getElementById('authErr');
  const users = getUsers();
  if (authMode === 'signup'){
    if (!name){ err.textContent = 'Please enter your full name.'; return; }
    if (users.find(u => u.email === email)){ err.textContent = 'Account already exists — please log in.'; return; }
    const u = { name, email, pass: hashPw(pass), created: Date.now() };
    users.push(u); saveUsers(users); startSession(u);
    toast('🎉 Welcome to Kanva, ' + name.split(' ')[0] + '!');
  } else {
    const u = users.find(u => u.email === email);
    if (!u){ err.textContent = 'No account with this email. Please sign up first.'; authMode='login'; toggleAuthMode(); authMode='signup'; document.getElementById('auEmail').value=email; return; }
    if (u.google && u.pass === 'google'){ err.textContent = 'This account uses Google sign-in — please use the "Continue with Google" button.'; return; }
    if (u.pass !== hashPw(pass)){ err.textContent = 'Incorrect password. Please try again.'; return; }
    startSession(u); toast('👋 Welcome back, ' + u.name.split(' ')[0] + '!');
  }
}
function demoLogin(){
  const users = getUsers();
  let u = users.find(x => x.email === 'demo@kanva.app');
  if (!u){ u = { name:'Demo User', email:'demo@kanva.app', pass: hashPw('demo123'), created: Date.now() }; users.push(u); saveUsers(users); }
  startSession(u); toast('⚡ Logged in with Demo Account');
}
function googleNotice(){ toast('Google sign-in abhi setup ho raha hai — filhal email ya Demo account se login karein 👍'); }
/* ---------- Google Sign-In (Gmail) ---------- */
function decodeJwt(token){
  const part = token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
  const json = decodeURIComponent(atob(part).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
  return JSON.parse(json);
}
function handleGoogleCredential(resp){
  try {
    const p = decodeJwt(resp.credential);
    if (!p || !p.email){ toast('Google login failed — please try again'); return; }
    const email = p.email.toLowerCase();
    const users = getUsers();
    let u = users.find(x => x.email === email);
    if (!u){
      u = { name: p.name || email.split('@')[0], email, pass: 'google', google: true, picture: p.picture || '', created: Date.now() };
      users.push(u);
    } else { u.google = true; if (p.picture) u.picture = p.picture; if (p.name) u.name = p.name; }
    saveUsers(users); startSession(u);
    toast('🎉 Welcome, ' + u.name.split(' ')[0] + ' — signed in with Google');
  } catch(e){ toast('Google login failed — please try again'); }
}
function initGoogle(){
  if (!GOOGLE_CLIENT_ID) return;
  const tryInit = () => {
    if (window.google && google.accounts && google.accounts.id){
      google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential });
      const wrap = document.getElementById('googleBtnWrap');
      if (wrap){
        wrap.style.display = 'flex';
        const fb = document.getElementById('googleFallback'); if (fb) fb.style.display = 'none';
        google.accounts.id.renderButton(wrap, { theme: 'outline', size: 'large', width: 340, text: 'continue_with', shape: 'rectangular', logo_alignment: 'center' });
      }
    } else setTimeout(tryInit, 400);
  };
  tryInit();
}
function startSession(u){
  currentUser = { name: u.name, email: u.email, picture: u.picture || '' };
  localStorage.setItem('kv_session', u.email);
  enterApp();
  const shared = parseShareHash();
  if (shared) openSharedDesign(shared);
}
function logout(){
  localStorage.removeItem('kv_session'); currentUser = null;
  document.getElementById('view-app').style.display = 'none';
  document.getElementById('view-editor').style.display = 'none';
  document.getElementById('view-auth').style.display = '';
}
function restoreSession(){
  const email = localStorage.getItem('kv_session');
  if (!email) return false;
  const u = getUsers().find(x => x.email === email);
  if (!u) return false;
  currentUser = { name: u.name, email: u.email, picture: u.picture || '' };
  enterApp();
  const shared = parseShareHash();
  if (shared) openSharedDesign(shared);
  return true;
}

/* ---------------- PER-USER STORAGE ---------------- */
function designsKey(){ return 'kv_designs_' + (currentUser ? currentUser.email : 'guest'); }
function getDesigns(){ return JSON.parse(localStorage.getItem(designsKey()) || '[]'); }
function saveDesigns(d){ localStorage.setItem(designsKey(), JSON.stringify(d)); }
function planKey(){ return 'kv_plan_' + (currentUser ? currentUser.email : 'guest'); }
function getPlan(){ return localStorage.getItem(planKey()) || 'free'; }
function isPro(){ return getPlan() === 'pro'; }
function getOrders(){ return JSON.parse(localStorage.getItem('kv_orders') || '[]'); }
function brandKey(){ return 'kv_brand_' + (currentUser ? currentUser.email : 'guest'); }
function getBrand(){ return JSON.parse(localStorage.getItem(brandKey()) || '{"colors":[],"logo":"","font":"Poppins"}'); }
function saveBrand(b){ localStorage.setItem(brandKey(), JSON.stringify(b)); }
function requirePro(feature){ if (isPro()) return true; toast('🔒 ' + feature + ' is a Pro feature'); openPayment('monthly'); return false; }

/* ---------------- APP SHELL ---------------- */
function enterApp(){
  document.getElementById('view-auth').style.display = 'none';
  document.getElementById('view-editor').style.display = 'none';
  document.getElementById('view-app').style.display = '';
  const initials = currentUser.name.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
  ['userAvatar','userAvatar2','userAvatar3'].forEach(id => { const el = document.getElementById(id); if (!el) return;
    if (currentUser.picture){ el.style.backgroundImage = 'url(' + currentUser.picture + ')'; el.style.backgroundSize = 'cover'; el.textContent = ''; }
    else { el.style.backgroundImage = ''; el.textContent = initials; } });
  document.getElementById('userName').textContent = currentUser.name;
  if (!document.querySelector('.side-nav .admin-nav')){
    document.querySelector('.side-nav').insertAdjacentHTML('beforeend', '<a class="snav admin-nav" onclick="openAdmin()">🛠️ Admin orders</a>');
  }
  refreshPlanUI(); renderDashboard(); goPage('home');
}
function showApp(){ document.getElementById('view-editor').style.display='none'; document.getElementById('view-app').style.display=''; renderDashboard(); }
function goPage(p){
  document.querySelectorAll('.snav[data-page]').forEach(a => a.classList.toggle('active', a.dataset.page === p));
  ['home','projects','templates','brand','pricing','trash'].forEach(x => { const el = document.getElementById('page-'+x); if (el) el.style.display = x === p ? '' : 'none'; });
  if (p === 'projects') renderProjects();
  if (p === 'templates') renderTemplateGrids();
  if (p === 'brand') renderBrand();
  if (p === 'trash') renderTrash();
  window.scrollTo(0,0);
}
function refreshPlanUI(){
  const pro = isPro();
  ['planBadge','planBadge2'].forEach(id => { const b = document.getElementById(id); if (b){ b.textContent = pro ? '⚡ PRO' : 'FREE'; b.className = 'plan-badge ' + (pro ? 'pro' : 'free'); } });
  const up = document.getElementById('userPlan'); if (up) up.textContent = pro ? 'Pro plan ⚡' : 'Free plan';
  renderTemplateGrids();
}
function renderDashboard(){
  document.getElementById('typeRow').innerHTML = SIZES.map(s =>
    `<button class="type-item" onclick="openEditor('${s.id}')"><span class="type-ic">${s.icon}</span>${s.name}</button>`).join('') +
    `<button class="type-item" onclick="customSize()"><span class="type-ic">✂️</span>Custom size</button>`;
  document.getElementById('createMenu').innerHTML = SIZES.map(s =>
    `<button onclick="openEditor('${s.id}')">${s.icon} ${s.name} <small>${s.w} × ${s.h} px</small></button>`).join('') +
    `<button onclick="customSize()">✂️ Custom size</button>`;
  const designs = getDesigns().filter(d => !d.trashed).slice(0, 10);
  document.getElementById('recentRow').innerHTML = designs.length ? designs.map(d =>
    `<div class="recent-card" onclick="loadDesign(${d.id})"><img src="${d.thumb}" alt=""><div class="rc-name">${escapeHtml(d.name)}</div><div class="rc-date">${d.updated}</div></div>`).join('')
    : '<div class="empty-note">No designs yet — pick a size above or start from a template below. Your designs will appear here.</div>';
  renderTemplateGrids(); renderProjects(); renderOrders(); renderTrash();
}
function toggleCreateMenu(){ const m = document.getElementById('createMenu'); m.style.display = m.style.display === 'none' ? '' : 'none'; }
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* search */
let searchQuery = '';
function onSearch(v){
  searchQuery = v.trim().toLowerCase();
  ['globalSearch'].forEach(id => { const el = document.getElementById(id); if (el && el.value !== v) el.value = v; });
  const hero = document.querySelector('.hero-search input'); if (hero && hero.value !== v) hero.value = v;
  if (searchQuery) goPage('templates'); else renderTemplateGrids();
  renderTemplateGrids();
}

/* ---------------- PROJECTS / TRASH ---------------- */
function renderProjects(){
  const g = document.getElementById('projectGrid'); if (!g) return;
  const designs = getDesigns().filter(d => !d.trashed);
  g.innerHTML = designs.length ? designs.map(d =>
    `<div class="design-card"><img src="${d.thumb}" alt=""><div class="dc-body">
      <div class="dc-name">${escapeHtml(d.name)}</div><div class="dc-date">${d.sizeName || ''} · ${d.updated}</div>
      <div class="dc-btns"><button onclick="loadDesign(${d.id})">Open</button>
      <button onclick="renameDesign(${d.id})">Rename</button>
      <button onclick="duplicateDesign(${d.id})">Duplicate</button>
      <button class="danger" onclick="trashDesign(${d.id})">Trash</button></div></div></div>`).join('')
    : '<div class="empty-note">No projects yet. Click “Create new” to start your first design.</div>';
}
function renderTrash(){
  const g = document.getElementById('trashGrid'); if (!g) return;
  const designs = getDesigns().filter(d => d.trashed);
  g.innerHTML = designs.length ? designs.map(d =>
    `<div class="design-card"><img src="${d.thumb}" alt=""><div class="dc-body">
      <div class="dc-name">${escapeHtml(d.name)}</div><div class="dc-date">${d.updated}</div>
      <div class="dc-btns"><button onclick="restoreDesign(${d.id})">Restore</button>
      <button class="danger" onclick="destroyDesign(${d.id})">Delete forever</button></div></div></div>`).join('')
    : '<div class="empty-note">Trash is empty.</div>';
}
function renameDesign(id){ const ds = getDesigns(); const d = ds.find(x => x.id === id); if (!d) return; const n = prompt('Rename design:', d.name); if (n){ d.name = n; saveDesigns(ds); renderProjects(); renderDashboard(); } }
function duplicateDesign(id){ const ds = getDesigns(); const d = ds.find(x => x.id === id); if (!d) return; if (!isPro() && ds.filter(x => !x.trashed).length >= 5){ requirePro('Unlimited projects'); return; } const c = JSON.parse(JSON.stringify(d)); c.id = Date.now(); c.name = d.name + ' copy'; c.updated = new Date().toLocaleString(); ds.unshift(c); saveDesigns(ds); renderProjects(); toast('⧉ Design duplicated'); }
function trashDesign(id){ const ds = getDesigns(); const d = ds.find(x => x.id === id); if (d){ d.trashed = true; saveDesigns(ds); renderProjects(); renderDashboard(); toast('🗑️ Moved to Trash — restore it anytime'); } }
function restoreDesign(id){ const ds = getDesigns(); const d = ds.find(x => x.id === id); if (d){ d.trashed = false; saveDesigns(ds); renderTrash(); renderProjects(); } }
function destroyDesign(id){ if (!confirm('Delete this design forever?')) return; saveDesigns(getDesigns().filter(x => x.id !== id)); renderTrash(); }
function renderOrders(){
  const el = document.getElementById('orderList'); if (!el) return;
  const orders = getOrders().filter(o => !currentUser || o.email === currentUser.email);
  el.innerHTML = orders.length ? orders.map(o => `<div class="order-item"><span class="st ${o.status}">${o.status.toUpperCase()}</span> <b>${o.plan === 'yearly' ? 'Pro Yearly' : 'Pro Monthly'} — Rs ${o.amount}</b><br>TID: ${escapeHtml(o.tid)} · ${o.date}</div>`).join('') : '<p class="muted small">No orders yet.</p>';
}

/* ---------------- BRAND KIT ---------------- */
function renderBrand(){
  const pro = isPro();
  document.getElementById('brandLocked').style.display = pro ? 'none' : '';
  document.getElementById('brandKit').style.display = pro ? '' : 'none';
  if (!pro) return;
  const b = getBrand();
  document.getElementById('brandColors').innerHTML = b.colors.length ? b.colors.map((c,i) =>
    `<div class="brand-color" style="background:${c}" title="${c} — click to remove" onclick="removeBrandColor(${i})"></div>`).join('') : '<p class="muted small">No brand colors yet.</p>';
  document.getElementById('brandLogoBox').innerHTML = b.logo ? `<img src="${b.logo}" alt="brand logo">` : '<p class="muted small">No logo uploaded.</p>';
  const sel = document.getElementById('bkFont');
  sel.innerHTML = FONTS.map(f => `<option value="${f}" ${f === b.font ? 'selected' : ''}>${f}</option>`).join('');
}
function addBrandColor(){ const b = getBrand(); b.colors.push(document.getElementById('bkColor').value); saveBrand(b); renderBrand(); toast('🎨 Brand color added'); }
function removeBrandColor(i){ const b = getBrand(); b.colors.splice(i,1); saveBrand(b); renderBrand(); }
function setBrandLogo(ev){ const f = ev.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { const b = getBrand(); b.logo = r.result; saveBrand(b); renderBrand(); toast('🏷️ Brand logo saved'); }; r.readAsDataURL(f); }
function setBrandFont(f){ const b = getBrand(); b.font = f; saveBrand(b); toast('🔤 Brand font set to ' + f); }

/* ================= EDITOR ================= */
let canvas, zoom = 1, history = [], hIndex = -1, saving = false;
let currentSize = SIZES[0], currentDesignId = null;
let uploads = JSON.parse(localStorage.getItem('kv_uploads') || '[]');

function openEditor(sizeId, tplId){
  if (typeof fabric === 'undefined'){ toast('⚠️ Editor library load nahi hui — internet check karke page refresh karein'); return; }
  document.getElementById('view-app').style.display = 'none';
  document.getElementById('view-auth').style.display = 'none';
  document.getElementById('view-editor').style.display = '';
  if (!canvas) initCanvas();
  if (sizeId) setSize(sizeId);
  if (tplId) applyTemplate(tplId);
  setTimeout(fitZoom, 60);
}
function customSize(){
  const w = parseInt(prompt('Width in pixels (e.g. 1000):', '1000'));
  const h = parseInt(prompt('Height in pixels (e.g. 1000):', '1000'));
  if (!w || !h) return;
  openEditor(null, null);
  currentSize = { id:'custom', name:'Custom ' + w + '×' + h, w, h, icon:'✂️' };
  canvas.setWidth(w); canvas.setHeight(h); updateSizeLbl(); fitZoom();
}
function setSize(id){
  const s = SIZES.find(x => x.id === id); if (!s) return;
  currentSize = s; canvas.setWidth(s.w); canvas.setHeight(s.h); updateSizeLbl();
}
function updateSizeLbl(){ const el = document.getElementById('curSizeLbl'); if (el) el.textContent = '· ' + currentSize.w + '×' + currentSize.h; }
function openResize(){
  const list = SIZES.map((s,i) => (i+1) + '. ' + s.name + ' (' + s.w + '×' + s.h + ')').join('\n');
  const pick = prompt('Resize design to:\n' + list + '\n\nType a number:', '1');
  const s = SIZES[parseInt(pick) - 1]; if (!s) return;
  const oldW = currentSize.w, oldH = currentSize.h;
  setSize(s.id);
  const sx = s.w / oldW, sy = s.h / oldH;
  canvas.getObjects().forEach(o => { o.left *= sx; o.top *= sy; o.scaleX *= sx; o.scaleY *= sy; o.setCoords(); });
  canvas.renderAll(); fitZoom(); pushHistory(); toast('📐 Resized to ' + s.name);
}
function initCanvas(){
  canvas = new fabric.Canvas('c', { preserveObjectStacking: true, backgroundColor: '#ffffff' });
  canvas.setWidth(currentSize.w); canvas.setHeight(currentSize.h); updateSizeLbl();
  document.getElementById('pFont').innerHTML = FONTS.map(f => `<option value="${f}" style="font-family:'${f}'">${f}</option>`).join('');
  canvas.on('selection:created', syncProps); canvas.on('selection:updated', syncProps);
  canvas.on('selection:cleared', () => { document.getElementById('ctxControls').style.display='none'; document.getElementById('ctxHint').style.display=''; renderLayers(); });
  ['object:added','object:removed','object:modified'].forEach(ev => canvas.on(ev, () => { if (!saving){ pushHistory(); markUnsaved(); } renderLayers(); }));
  buildSidebars(); renderUploads(); renderPhotos(); pushHistory(true);
}
function markUnsaved(){ document.getElementById('savedNote').textContent = '● Unsaved changes'; }
function docTitleChanged(){ markUnsaved(); }
function fitZoom(){
  const stage = document.getElementById('stage'); if (!stage || !canvas) return;
  zoom = Math.max(.07, Math.min((stage.clientWidth - 76) / currentSize.w, (stage.clientHeight - 76) / currentSize.h, 1.5));
  applyZoom();
}
function applyZoom(){ document.getElementById('canvasHolder').style.transform = `scale(${zoom})`; document.getElementById('zoomLabel').textContent = Math.round(zoom * 100) + '%'; }
function zoomIn(){ zoom = Math.min(2.5, zoom * 1.15); applyZoom(); }
function zoomOut(){ zoom = Math.max(.07, zoom / 1.15); applyZoom(); }

/* history */
function pushHistory(init){
  if (saving) return;
  const json = JSON.stringify(canvas.toJSON(['selectable','evented','name']));
  if (!init && history[hIndex] === json) return;
  history = history.slice(0, hIndex + 1); history.push(json);
  if (history.length > 60) history.shift();
  hIndex = history.length - 1;
}
function loadHist(i){
  if (i < 0 || i >= history.length) return;
  saving = true; hIndex = i;
  canvas.loadFromJSON(history[i], () => { canvas.renderAll(); saving = false; renderLayers(); });
}
function undo(){ loadHist(hIndex - 1); }
function redo(){ loadHist(hIndex + 1); }

/* objects */
function center(o){ o.set({ left: currentSize.w/2 - (o.width*o.scaleX)/2, top: currentSize.h/2 - (o.height*o.scaleY)/2 }); canvas.add(o); canvas.setActiveObject(o); canvas.renderAll(); return o; }
function brandFont(){ const b = getBrand(); return isPro() && b.font ? b.font : 'Poppins'; }
function addTextPreset(kind){
  const base = { fontFamily: brandFont(), fill:'#0d1216', textAlign:'center', name:'Text' };
  let o;
  if (kind==='heading') o = new fabric.Textbox('Add a heading', { ...base, fontSize: Math.round(currentSize.w*.075), fontWeight:800, width: currentSize.w*.85 });
  if (kind==='sub') o = new fabric.Textbox('Add a subheading', { ...base, fontSize: Math.round(currentSize.w*.04), fontWeight:600, width: currentSize.w*.8 });
  if (kind==='body') o = new fabric.Textbox('Add a little bit of body text here. Double-click to edit.', { ...base, fontSize: Math.round(currentSize.w*.024), fontFamily:'Inter', width: currentSize.w*.7 });
  center(o);
}
function addStyledText(text, font, size, color, weight){
  center(new fabric.Textbox(text, { fontFamily:font, fontSize:size, fill:color, fontWeight:weight||700, textAlign:'center', width: currentSize.w*.85, name:'Text' }));
}
function starObj(r, fill){
  const pts = [];
  for (let i=0;i<10;i++){ const rad = i%2===0 ? r : r*.48, a = (Math.PI/5)*i - Math.PI/2; pts.push({ x: rad*Math.cos(a)+r, y: rad*Math.sin(a)+r }); }
  return new fabric.Polygon(pts, { fill, name:'Star' });
}
function addShape(kind){
  const fill = '#8b3dff'; let o; const s = currentSize.w * .28;
  if (kind==='rect') o = new fabric.Rect({ width:s, height:s*.65, fill, name:'Rectangle' });
  if (kind==='round') o = new fabric.Rect({ width:s, height:s*.65, fill, rx:22, ry:22, name:'Rounded Rect' });
  if (kind==='circle') o = new fabric.Circle({ radius:s/2, fill, name:'Circle' });
  if (kind==='triangle') o = new fabric.Triangle({ width:s, height:s, fill, name:'Triangle' });
  if (kind==='star') o = starObj(s/2, fill);
  if (kind==='heart') o = new fabric.Path('M 100 30 C 100 10 60 -10 32 12 C 4 34 10 70 100 140 C 190 70 196 34 168 12 C 140 -10 100 10 100 30 Z', { fill:'#ec4899', scaleX:s/200, scaleY:s/200, name:'Heart' });
  if (kind==='ring') o = new fabric.Circle({ radius:s/2, fill:'transparent', stroke:fill, strokeWidth:14, name:'Ring' });
  if (kind==='blob') o = new fabric.Circle({ radius:s/2, fill:'#00c4cc', name:'Blob' });
  if (o) center(o);
}
function addLine(kind){
  const W = currentSize.w; let o;
  if (kind==='line') o = new fabric.Rect({ width:W*.5, height:Math.max(4,W*.008), fill:'#0d1216', name:'Line' });
  if (kind==='dash') o = new fabric.Line([0,0,W*.5,0], { stroke:'#0d1216', strokeWidth:Math.max(3,W*.006), strokeDashArray:[14,10], name:'Dashed Line' });
  if (kind==='arrow'){
    const shaft = new fabric.Rect({ left:0, top:8, width:W*.42, height:Math.max(5,W*.01), fill:'#0d1216', name:'Arrow' });
    const head = new fabric.Triangle({ left:W*.42, top:0, width:W*.05, height:W*.05, fill:'#0d1216', angle:90, name:'Arrow' });
    o = new fabric.Group([shaft, head], { name:'Arrow' });
  }
  if (o) center(o);
}
function addFrame(kind){
  const s = currentSize.w * .42; let o;
  if (kind==='frame') o = new fabric.Rect({ width:s, height:s*.75, fill:'rgba(139,61,255,.08)', stroke:'#8b3dff', strokeWidth:6, name:'Frame' });
  if (kind==='cframe') o = new fabric.Circle({ radius:s/2, fill:'rgba(0,196,204,.1)', stroke:'#00c4cc', strokeWidth:6, name:'Circle Frame' });
  if (kind==='chart'){
    const bars = [0.4, 0.7, 0.55, 1].map((f, i) => new fabric.Rect({ left: i*46, top: 120 - 110*f, width: 30, height: 110*f, fill: ['#8b3dff','#00c4cc','#ec4899','#f5a623'][i], name:'Chart' }));
    bars.push(new fabric.Rect({ left:-8, top:120, width:190, height:4, fill:'#0d1216', name:'Chart' }));
    o = new fabric.Group(bars, { name:'Bar Chart' }); o.scaleToWidth(s*.8);
  }
  if (kind==='badge'){
    const star = starObj(s/2, '#f5a623'); star.set({ name:'Badge' });
    const t = new fabric.Text('NEW', { fontSize:s*.22, fill:'#fff', fontFamily:'Poppins', fontWeight:800, left:s*.24, top:s*.38, name:'Badge' });
    o = new fabric.Group([star, t], { name:'Badge' });
  }
  if (o) center(o);
}
function addSticker(emoji){ center(new fabric.Text(emoji, { fontSize: Math.round(currentSize.w*.14), name:'Sticker' })); }
function addImageURL(url){
  fabric.Image.fromURL(url, img => {
    if (!img || !img.width) { toast('⚠️ Photo load nahi hui — internet check karein'); return; }
    const max = currentSize.w * .62, sc = Math.min(max / img.width, max / img.height, 1);
    img.set({ scaleX: sc, scaleY: sc, name:'Photo' }); center(img);
  }, { crossOrigin:'anonymous' });
}

/* selection ops + properties */
function active(){ return canvas ? canvas.getActiveObject() : null; }
function deleteObj(){ const o = active(); if (o){ canvas.remove(o); canvas.discardActiveObject(); canvas.renderAll(); } }
function duplicateObj(){ const o = active(); if (!o) return; o.clone(cl => { cl.set({ left:(cl.left||0)+24, top:(cl.top||0)+24, name:cl.name||'Copy' }); canvas.add(cl); canvas.setActiveObject(cl); canvas.renderAll(); }, ['name']); }
function bringForward(){ const o = active(); if (o){ o.bringForward(); canvas.renderAll(); renderLayers(); } }
function sendBackward(){ const o = active(); if (o){ o.sendBackwards(); canvas.renderAll(); renderLayers(); } }
function syncProps(){
  const o = active(); if (!o) return;
  document.getElementById('ctxHint').style.display = 'none';
  const cc = document.getElementById('ctxControls'); cc.style.display = 'flex';
  const isText = ['textbox','i-text','text'].includes(o.type);
  document.getElementById('textCtx').style.display = isText ? '' : 'none';
  if (typeof o.fill === 'string') document.getElementById('pFill').value = o.fill;
  document.getElementById('pOpacity').value = Math.round((o.opacity ?? 1) * 100);
  if (isText){
    document.getElementById('pFont').value = o.fontFamily || 'Poppins';
    document.getElementById('pFontSize').value = Math.round(o.fontSize || 40);
    document.getElementById('btnBold').style.background = (o.fontWeight === 'bold' || o.fontWeight >= 700) ? '#efe9ff' : '';
    document.getElementById('btnItalic').style.background = o.fontStyle === 'italic' ? '#efe9ff' : '';
    document.getElementById('btnUnderline').style.background = o.underline ? '#efe9ff' : '';
  }
  if (typeof o.stroke === 'string') document.getElementById('pStroke').value = o.stroke;
  document.getElementById('pStrokeW').value = o.strokeWidth || 0;
  renderLayers();
}
function setFill(v){ const o=active(); if(o){ o.set('fill', v); canvas.renderAll(); } }
function setOpacity(v){ const o=active(); if(o){ o.set('opacity', v/100); canvas.renderAll(); } }
function setFont(v){ const o=active(); if(o){ o.set('fontFamily', v); canvas.renderAll(); } }
function setFontSize(v){ const o=active(); if(o){ o.set('fontSize', parseInt(v)||40); canvas.renderAll(); } }
function toggleBold(){ const o=active(); if(o){ const b = !(o.fontWeight==='bold'||o.fontWeight>=700); o.set('fontWeight', b?'bold':'normal'); canvas.renderAll(); syncProps(); } }
function toggleItalic(){ const o=active(); if(o){ o.set('fontStyle', o.fontStyle==='italic'?'normal':'italic'); canvas.renderAll(); syncProps(); } }
function toggleUnderline(){ const o=active(); if(o){ o.set('underline', !o.underline); canvas.renderAll(); syncProps(); } }
function setAlign(a){ const o=active(); if(o){ o.set('textAlign', a); canvas.renderAll(); } }
function setStroke(v){ const o=active(); if(o){ o.set('stroke', v); if(!o.strokeWidth) o.set('strokeWidth', 2); canvas.renderAll(); } }
function setStrokeW(v){ const o=active(); if(o){ o.set('strokeWidth', parseInt(v)||0); canvas.renderAll(); } }
function setShadow(kind){
  const o = active(); if (!o) return;
  if (kind==='none') o.set('shadow', null);
  if (kind==='soft') o.set('shadow', new fabric.Shadow({ color:'rgba(0,0,0,.35)', blur:14, offsetX:4, offsetY:5 }));
  if (kind==='hard') o.set('shadow', new fabric.Shadow({ color:'rgba(0,0,0,.55)', blur:0, offsetX:6, offsetY:6 }));
  if (kind==='glow') o.set('shadow', new fabric.Shadow({ color:'#ec4899', blur:26, offsetX:0, offsetY:0 }));
  canvas.renderAll();
}

/* layers */
function renderLayers(){
  const list = document.getElementById('layerList'); if (!list || !canvas) return;
  const objs = canvas.getObjects().filter(o => o.name !== '__bg' && o.name !== '__wm').slice().reverse();
  if (!objs.length){ list.innerHTML = '<p class="muted small">No layers yet.</p>'; return; }
  list.innerHTML = objs.map(o => {
    const idx = canvas.getObjects().indexOf(o);
    const label = (['textbox','i-text','text'].includes(o.type) && o.text) ? o.text.slice(0,18) : (o.name || o.type);
    return `<div class="layer-item ${active()===o?'active':''}" onclick="selectLayer(${idx})"><span class="lname">${escapeHtml(label)}</span>
      <button onclick="event.stopPropagation();toggleVis(${idx})">${o.visible===false?'🚫':'👁️'}</button>
      <button onclick="event.stopPropagation();delLayer(${idx})">🗑️</button></div>`;
  }).join('');
}
function selectLayer(i){ const o = canvas.getObjects()[i]; if (o){ canvas.setActiveObject(o); canvas.renderAll(); syncProps(); } }
function toggleVis(i){ const o = canvas.getObjects()[i]; if (o){ o.visible = o.visible === false ? true : false; canvas.renderAll(); renderLayers(); } }
function delLayer(i){ const o = canvas.getObjects()[i]; if (o) canvas.remove(o); }

/* sidebars */
function switchTab(t){
  document.querySelectorAll('.rail-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
  document.querySelectorAll('.tabpage').forEach(p => p.style.display = 'none');
  document.getElementById('tab-' + t).style.display = '';
  if (t === 'layers') renderLayers();
}
function buildSidebars(){
  const shapes = [['rect','▭'],['round','▢'],['circle','●'],['triangle','▲'],['star','★'],['heart','❤'],['ring','◎'],['blob','⬤']];
  document.getElementById('shapeGrid').innerHTML = shapes.map(([k,ic]) => `<div class="el-cell" onclick="addShape('${k}')" title="${k}">${ic}</div>`).join('');
  document.getElementById('lineGrid').innerHTML = [['line','━'],['arrow','➔'],['dash','┅']].map(([k,ic]) => `<div class="el-cell" onclick="addLine('${k}')" title="${k}">${ic}</div>`).join('');
  document.getElementById('frameGrid').innerHTML = [['frame','🖼️'],['cframe','⭕'],['chart','📊'],['badge','🏷️']].map(([k,ic]) => `<div class="el-cell" onclick="addFrame('${k}')" title="${k}">${ic}</div>`).join('');
  const stickers = ['🎉','⭐','❤️','🔥','👍','😊','🌟','💯','🏆','🎂','💡','🚀','🌈','🦋','🌸','⚡','💰','📈','🎓','🏠'];
  document.getElementById('stickerGrid').innerHTML = stickers.map(e => `<div class="el-cell" onclick="addSticker('${e}')">${e}</div>`).join('');
  const styles = [['BIG SALE','Bebas Neue',90,'#0d1216',700],['Elegant Title','Playfair Display',64,'#0d1216',700],['Fun Script','Pacifico',58,'#ec4899',400],['MODERN BOLD','Montserrat',64,'#0d1216',900],['Handwritten','Dancing Script',64,'#8b3dff',700],['IMPACT','Anton',84,'#0d1216',400]];
  document.getElementById('fontStyles').innerHTML = styles.map(([t,f,s,c,w]) => `<button class="font-style-btn" style="font-family:'${f}';font-size:${Math.min(21,s/3.4)}px" onclick="addStyledText('${t}','${f}',${s},'${c}',${w})">${t}</button>`).join('');
  const colors = ['#ffffff','#000000','#0d1216','#8b3dff','#ec4899','#f5a623','#ef4444','#22c55e','#3b82f6','#00c4cc','#facc15','#f97316','#a855f7','#64748b','#fef3c7','#dcfce7'];
  document.getElementById('bgColors').innerHTML = colors.map(c => `<div class="swatch" style="background:${c}" onclick="setBgColor('${c}')"></div>`).join('');
  const b = getBrand();
  if (isPro() && b.colors.length){
    document.getElementById('bgColors').innerHTML += b.colors.map(c => `<div class="swatch" style="background:${c};outline:2px solid #f5a623" title="Brand color" onclick="setBgColor('${c}')"></div>`).join('');
  }
  const grads = [['#8b3dff','#ec4899'],['#f5a623','#ef4444'],['#00c4cc','#3b82f6'],['#22c55e','#00c4cc'],['#f43f5e','#f5a623'],['#0f172a','#8b3dff'],['#fdfbfb','#ebedee'],['#134e5e','#71b280']];
  document.getElementById('bgGradients').innerHTML = grads.map(([a,bb]) => `<div class="swatch" style="background:linear-gradient(135deg,${a},${bb})" onclick="setBgGradient('${a}','${bb}')"></div>`).join('');
  renderTemplateLists();
}
function setBgColor(c){ removeBgRect(); canvas.setBackgroundColor(c, () => canvas.renderAll()); pushHistory(); markUnsaved(); }
function removeBgRect(){ const bg = canvas.getObjects().find(o => o.name === '__bg'); if (bg) canvas.remove(bg); }
function setBgGradient(a, b){
  removeBgRect(); canvas.setBackgroundColor('transparent', () => {});
  const rect = new fabric.Rect({ left:0, top:0, width: currentSize.w, height: currentSize.h, selectable:false, evented:false, name:'__bg' });
  rect.set('fill', new fabric.Gradient({ type:'linear', gradientUnits:'pixels', coords:{ x1:0, y1:0, x2:currentSize.w, y2:currentSize.h }, colorStops:[{offset:0,color:a},{offset:1,color:b}] }));
  canvas.add(rect); rect.sendToBack(); canvas.renderAll(); pushHistory(); markUnsaved();
}

/* uploads + photos */
function handleUpload(ev){
  [...ev.target.files].forEach(f => { const r = new FileReader(); r.onload = () => { uploads.unshift(r.result); if (uploads.length > 24) uploads.pop(); localStorage.setItem('kv_uploads', JSON.stringify(uploads)); renderUploads(); }; r.readAsDataURL(f); });
  ev.target.value = '';
}
function renderUploads(){
  const g = document.getElementById('uploadGrid'); if (!g) return;
  g.innerHTML = '';
  if (!uploads.length) g.innerHTML = '<p class="muted small">No uploads yet.</p>';
  uploads.forEach((u, i) => { const img = document.createElement('img'); img.src = u; img.onclick = () => addImageURL(uploads[i]); g.appendChild(img); });
  const b = getBrand(); const bp = document.getElementById('brandLogoPanel');
  if (bp) bp.innerHTML = (isPro() && b.logo) ? `<h4>Brand logo</h4><div class="upload-grid"><img src="${b.logo}" onclick="addImageURL(getBrand().logo)"></div>` : '';
}
const PHOTO_SEEDS = ['nature','city','food','travel','tech','people','animal','fashion','work','art','sport','music'];
function renderPhotos(){
  const g = document.getElementById('photoGrid'); if (!g) return;
  g.innerHTML = PHOTO_SEEDS.map(s => `<img loading="lazy" src="https://picsum.photos/seed/kanva-${s}/300/220" alt="${s}">`).join('');
  [...g.querySelectorAll('img')].forEach((img, i) => { img.onclick = () => addImageURL('https://picsum.photos/seed/kanva-' + PHOTO_SEEDS[i] + '/900/700'); });
}

/* ================= TEMPLATES (20) ================= */
function T(t, o){ return new fabric.Textbox(t, Object.assign({ textAlign:'center', name:'Text' }, o)); }
function gradRect(a, b){
  const r = new fabric.Rect({ left:0, top:0, width:currentSize.w, height:currentSize.h, selectable:false, evented:false, name:'__bg' });
  r.set('fill', new fabric.Gradient({ type:'linear', gradientUnits:'pixels', coords:{ x1:0, y1:0, x2:currentSize.w, y2:currentSize.h }, colorStops:[{offset:0,color:a},{offset:1,color:b}] }));
  canvas.add(r); return r;
}
function solidBg(c){ canvas.setBackgroundColor(c, () => canvas.renderAll()); }
function addAt(o, xPct, yPct){ o.set({ left: currentSize.w*xPct - (o.width*(o.scaleX||1))/2, top: currentSize.h*yPct }); canvas.add(o); return o; }

const TEMPLATES = [
  { id:'sale',     title:'Mega Sale',         sub:'50% OFF',             cat:'Marketing', pro:false, bg:['#ef4444','#f97316'] },
  { id:'quote',    title:'Daily Quote',       sub:'Motivation post',     cat:'Social Media', pro:false, bg:['#fef3c7','#f59e0b'] },
  { id:'business', title:'Grow Business',     sub:'Promo post',          cat:'Marketing', pro:false, bg:['#0f172a','#155e75'] },
  { id:'food',     title:'Tasty Burger',      sub:'Food offer',          cat:'Marketing', pro:false, bg:['#f59e0b','#ef4444'] },
  { id:'estate',   title:'House For Sale',    sub:'Real estate',         cat:'Marketing', pro:false, bg:['#1d4ed8','#06b6d4'] },
  { id:'edu',      title:'Admissions Open',   sub:'School / institute',  cat:'Education', pro:false, bg:['#8b3dff','#4f46e5'] },
  { id:'motivate', title:'Think Big',         sub:'Success quote',       cat:'Social Media', pro:false, bg:['#111827','#000000'] },
  { id:'story',    title:'Flash Sale Story',  sub:'Story format',        cat:'Social Media', pro:false, bg:['#db2777','#7c3aed'] },
  { id:'course',   title:'Online Course',     sub:'Course promo',        cat:'Education', pro:false, bg:['#0ea5e9','#22c55e'] },
  { id:'menu',     title:'Restaurant Menu',   sub:'Menu header',         cat:'Marketing', pro:false, bg:['#292524','#78350f'] },
  { id:'birthday', title:'Happy Birthday',    sub:'Birthday wish',       cat:'Events', pro:true, bg:['#8b3dff','#ec4899'] },
  { id:'yt',       title:'YouTube Thumbnail', sub:'Make money online',   cat:'Video', pro:true, bg:['#111827','#374151'] },
  { id:'eid',      title:'Eid Mubarak',       sub:'Greeting card',       cat:'Events', pro:true, bg:['#065f46','#10b981'] },
  { id:'fashion',  title:'New Collection',    sub:'Fashion sale',        cat:'Social Media', pro:true, bg:['#e7d8c9','#c9a887'] },
  { id:'wedding',  title:'Wedding Invite',    sub:'Ayesha & Ahmed',      cat:'Events', pro:true, bg:['#fdf6ec','#e8c39e'] },
  { id:'gym',      title:'Fitness Gym',       sub:'No pain no gain',     cat:'Marketing', pro:true, bg:['#18181b','#dc2626'] },
  { id:'travel',   title:'Travel Pakistan',   sub:'Hunza valley trip',   cat:'Social Media', pro:true, bg:['#0369a1','#2dd4bf'] },
  { id:'music',    title:'Music Night Live',  sub:'Concert poster',      cat:'Events', pro:true, bg:['#1e1b4b','#db2777'] },
  { id:'baby',     title:'Baby Shower',       sub:'Welcome baby',        cat:'Events', pro:true, bg:['#fbcfe8','#93c5fd'] },
  { id:'vlog',     title:'My Daily Vlog',     sub:'Vlog thumbnail',      cat:'Video', pro:true, bg:['#f97316','#db2777'] },
];
const BUILDERS = {
  sale(){ gradRect('#ef4444','#f97316'); const W=currentSize.w;
    addAt(T('MEGA SALE', { fontFamily:'Bebas Neue', fontSize:W*.16, fill:'#fff', fontWeight:700, width:W*.9 }), .5, .14);
    addAt(T('50% OFF', { fontFamily:'Anton', fontSize:W*.24, fill:'#facc15', width:W*.9, shadow:new fabric.Shadow({color:'rgba(0,0,0,.3)',blur:6,offsetX:4,offsetY:5}) }), .5, .34);
    addAt(T('On Everything — Limited Time Offer!', { fontFamily:'Inter', fontSize:W*.032, fill:'#fff', width:W*.85 }), .5, .62);
    const btn = new fabric.Rect({ width:W*.42, height:W*.1, fill:'#0d1216', rx:40, ry:40, name:'Button' }); addAt(btn, .5, .76);
    addAt(T('SHOP NOW', { fontFamily:'Poppins', fontSize:W*.04, fill:'#fff', fontWeight:700, width:W*.42 }), .5, .785); },
  quote(){ solidBg('#fef9ec'); const W=currentSize.w;
    addAt(T('“', { fontFamily:'Playfair Display', fontSize:W*.3, fill:'#f59e0b', width:W*.4 }), .5, .05);
    addAt(T('Stay positive,\nwork hard,\nmake it happen.', { fontFamily:'Playfair Display', fontSize:W*.075, fill:'#1c1917', fontWeight:700, width:W*.82, lineHeight:1.2 }), .5, .36);
    addAt(T('— DAILY MOTIVATION', { fontFamily:'Montserrat', fontSize:W*.026, fill:'#92400e', width:W*.7 }), .5, .78); },
  business(){ gradRect('#0f172a','#155e75'); const W=currentSize.w;
    const bar = new fabric.Rect({ width:W*.16, height:W*.014, fill:'#22d3ee', name:'Accent' }); addAt(bar, .5, .16);
    addAt(T('GROW YOUR\nBUSINESS', { fontFamily:'Montserrat', fontSize:W*.105, fill:'#fff', fontWeight:900, width:W*.88, lineHeight:1.1 }), .5, .24);
    addAt(T('Professional services that bring you more customers, more sales, more growth.', { fontFamily:'Inter', fontSize:W*.03, fill:'#a5f3fc', width:W*.8 }), .5, .58);
    addAt(T('📞 0300-1234567   🌐 yourwebsite.com', { fontFamily:'Poppins', fontSize:W*.032, fill:'#fff', fontWeight:600, width:W*.85 }), .5, .8); },
  food(){ gradRect('#f59e0b','#ef4444'); const W=currentSize.w;
    addAt(new fabric.Text('🍔', { fontSize:W*.34, name:'Sticker' }), .5, .07);
    addAt(T('TASTY BURGER', { fontFamily:'Anton', fontSize:W*.13, fill:'#fff', width:W*.92 }), .5, .5);
    addAt(T('Juicy • Fresh • Delicious', { fontFamily:'Pacifico', fontSize:W*.045, fill:'#fef3c7', width:W*.85 }), .5, .66);
    addAt(T('Only Rs 499 — Order Now!', { fontFamily:'Poppins', fontSize:W*.038, fill:'#fff', fontWeight:700, width:W*.85 }), .5, .78); },
  estate(){ gradRect('#1d4ed8','#06b6d4'); const W=currentSize.w;
    addAt(new fabric.Text('🏠', { fontSize:W*.26, name:'Sticker' }), .5, .07);
    addAt(T('HOUSE FOR SALE', { fontFamily:'Montserrat', fontSize:W*.1, fill:'#fff', fontWeight:900, width:W*.92 }), .5, .42);
    addAt(T('3 Bed • 2 Bath • Prime Location', { fontFamily:'Inter', fontSize:W*.034, fill:'#dbeafe', width:W*.85 }), .5, .58);
    addAt(T('Call: 0300-1234567', { fontFamily:'Poppins', fontSize:W*.042, fill:'#facc15', fontWeight:700, width:W*.85 }), .5, .72); },
  edu(){ solidBg('#ffffff'); const W=currentSize.w;
    const band = new fabric.Rect({ left:0, top:0, width:W, height:currentSize.h*.3, fill:'#8b3dff', selectable:false, name:'Header Band' }); canvas.add(band);
    addAt(T('🎓 ADMISSIONS OPEN', { fontFamily:'Poppins', fontSize:W*.082, fill:'#fff', fontWeight:800, width:W*.94 }), .5, .09);
    addAt(T('Session 2026 – 27', { fontFamily:'Montserrat', fontSize:W*.045, fill:'#4c1d95', fontWeight:700, width:W*.85 }), .5, .42);
    addAt(T('Limited seats — experienced teachers,\nmodern labs and affordable fees.', { fontFamily:'Inter', fontSize:W*.032, fill:'#334155', width:W*.82, lineHeight:1.35 }), .5, .55);
    addAt(T('Enroll Now: 0300-1234567', { fontFamily:'Poppins', fontSize:W*.04, fill:'#8b3dff', fontWeight:700, width:W*.85 }), .5, .8); },
  motivate(){ solidBg('#0a0a0a'); const W=currentSize.w;
    addAt(T('THINK', { fontFamily:'Anton', fontSize:W*.2, fill:'#fff', width:W*.9 }), .5, .2);
    addAt(T('BIG.', { fontFamily:'Anton', fontSize:W*.2, fill:'#facc15', width:W*.9 }), .5, .42);
    addAt(T('Your only limit is your mindset.', { fontFamily:'Inter', fontSize:W*.032, fill:'#d4d4d8', width:W*.8 }), .5, .68);
    addAt(T('@yourpage', { fontFamily:'Montserrat', fontSize:W*.024, fill:'#71717a', width:W*.6 }), .5, .8); },
  story(){ gradRect('#db2777','#7c3aed'); const W=currentSize.w;
    addAt(T('FLASH', { fontFamily:'Anton', fontSize:W*.17, fill:'#fff', width:W*.92 }), .5, .16);
    addAt(T('SALE ⚡', { fontFamily:'Anton', fontSize:W*.17, fill:'#fde047', width:W*.92 }), .5, .3);
    addAt(T('UP TO 70% OFF\nToday only — swipe up!', { fontFamily:'Poppins', fontSize:W*.04, fill:'#fff', fontWeight:600, width:W*.85, lineHeight:1.3 }), .5, .52);
    addAt(new fabric.Text('🛍️', { fontSize:W*.2, name:'Sticker' }), .5, .72); },
  course(){ gradRect('#0ea5e9','#22c55e'); const W=currentSize.w;
    addAt(new fabric.Text('💻', { fontSize:W*.2, name:'Sticker' }), .5, .08);
    addAt(T('LEARN WEB\nDEVELOPMENT', { fontFamily:'Montserrat', fontSize:W*.095, fill:'#fff', fontWeight:900, width:W*.9, lineHeight:1.12 }), .5, .34);
    addAt(T('Complete online course — beginner to pro, with certificate.', { fontFamily:'Inter', fontSize:W*.03, fill:'#ecfeff', width:W*.82 }), .5, .62);
    addAt(T('Enroll Today — Rs 2,999 only', { fontFamily:'Poppins', fontSize:W*.036, fill:'#fef08a', fontWeight:700, width:W*.85 }), .5, .76); },
  menu(){ solidBg('#1c1917'); const W=currentSize.w;
    addAt(T('— THE FOOD HOUSE —', { fontFamily:'Montserrat', fontSize:W*.026, fill:'#d6d3d1', width:W*.8 }), .5, .1);
    addAt(T('Our Menu', { fontFamily:'Playfair Display', fontSize:W*.13, fill:'#fbbf24', fontWeight:700, width:W*.9 }), .5, .2);
    addAt(T('Burgers · Pizza · BBQ · Fast Food\nFresh & hot, every day 12pm – 12am', { fontFamily:'Inter', fontSize:W*.032, fill:'#e7e5e4', width:W*.82, lineHeight:1.45 }), .5, .42);
    addAt(new fabric.Text('🍕', { fontSize:W*.18, name:'Sticker' }), .3, .68);
    addAt(new fabric.Text('🍟', { fontSize:W*.18, name:'Sticker' }), .7, .68); },
  birthday(){ gradRect('#8b3dff','#ec4899'); const W=currentSize.w;
    addAt(new fabric.Text('🎉', { fontSize:W*.15, name:'Sticker' }), .17, .06);
    addAt(new fabric.Text('🎂', { fontSize:W*.15, name:'Sticker' }), .83, .06);
    addAt(T('Happy Birthday', { fontFamily:'Pacifico', fontSize:W*.115, fill:'#fff', width:W*.92 }), .5, .3);
    addAt(T('TO YOU!', { fontFamily:'Anton', fontSize:W*.09, fill:'#fde68a', width:W*.9 }), .5, .47);
    addAt(T('Wishing you a day full of happiness,\ncake and wonderful surprises.', { fontFamily:'Inter', fontSize:W*.03, fill:'#fce7f3', width:W*.82, lineHeight:1.35 }), .5, .62); },
  yt(){ gradRect('#111827','#374151'); const W=currentSize.w;
    addAt(T('HOW TO', { fontFamily:'Anton', fontSize:W*.16, fill:'#fff', width:W*.9 }), .5, .12);
    addAt(T('MAKE MONEY', { fontFamily:'Anton', fontSize:W*.16, fill:'#facc15', width:W*.9 }), .5, .33);
    addAt(T('ONLINE 💰', { fontFamily:'Anton', fontSize:W*.12, fill:'#fff', width:W*.9 }), .5, .54);
    const play = new fabric.Circle({ radius:W*.065, fill:'#ef4444', name:'Play Button' }); addAt(play, .5, .8);
    addAt(new fabric.Text('▶', { fontSize:W*.065, fill:'#fff', name:'Sticker' }), .515, .825); },
  eid(){ gradRect('#065f46','#10b981'); const W=currentSize.w;
    addAt(new fabric.Text('🌙', { fontSize:W*.2, name:'Sticker' }), .5, .07);
    addAt(T('Eid Mubarak', { fontFamily:'Playfair Display', fontSize:W*.12, fill:'#fff', fontWeight:700, width:W*.92 }), .5, .36);
    addAt(T('May your life be filled with\npeace, joy and blessings.', { fontFamily:'Inter', fontSize:W*.033, fill:'#d1fae5', width:W*.82, lineHeight:1.4 }), .5, .56);
    addAt(T('— From our family to yours', { fontFamily:'Dancing Script', fontSize:W*.05, fill:'#fde68a', width:W*.85 }), .5, .76); },
  fashion(){ solidBg('#f3ead9'); const W=currentSize.w;
    const circ = new fabric.Circle({ radius:W*.2, fill:'#c9a887', name:'Circle Frame' }); addAt(circ, .5, .1);
    addAt(new fabric.Text('👗', { fontSize:W*.16, name:'Sticker' }), .5, .19);
    addAt(T('NEW COLLECTION', { fontFamily:'Playfair Display', fontSize:W*.088, fill:'#3f2f1d', fontWeight:700, width:W*.92 }), .5, .56);
    addAt(T('Fashion Sale 2026 — Up to 40% Off', { fontFamily:'Montserrat', fontSize:W*.03, fill:'#7c5c36', width:W*.85 }), .5, .7); },
  wedding(){ solidBg('#fdf8ef'); const W=currentSize.w;
    const fr = new fabric.Rect({ left:W*.06, top:currentSize.h*.06, width:W*.88, height:currentSize.h*.88, fill:'transparent', stroke:'#c9a227', strokeWidth:3, name:'Gold Frame' }); canvas.add(fr);
    addAt(T('THE WEDDING OF', { fontFamily:'Montserrat', fontSize:W*.024, fill:'#92710c', width:W*.7 }), .5, .14);
    addAt(T('Ayesha & Ahmed', { fontFamily:'Dancing Script', fontSize:W*.11, fill:'#7c5a10', width:W*.9 }), .5, .26);
    addAt(T('Saturday, 20 December 2026\nVenue: Royal Palm Hall · 7 PM onwards', { fontFamily:'Playfair Display', fontSize:W*.032, fill:'#57534e', width:W*.8, lineHeight:1.4 }), .5, .52);
    addAt(T('💍', { fontSize:W*.08, name:'Sticker' }), .5, .74); },
  gym(){ gradRect('#18181b','#7f1d1d'); const W=currentSize.w;
    addAt(new fabric.Text('🏋️', { fontSize:W*.2, name:'Sticker' }), .5, .07);
    addAt(T('NO PAIN', { fontFamily:'Anton', fontSize:W*.15, fill:'#fff', width:W*.92 }), .5, .36);
    addAt(T('NO GAIN', { fontFamily:'Anton', fontSize:W*.15, fill:'#ef4444', width:W*.92 }), .5, .52);
    addAt(T('Join Fitness Gym today — first month Rs 1,500', { fontFamily:'Poppins', fontSize:W*.03, fill:'#e4e4e7', fontWeight:600, width:W*.85 }), .5, .72); },
  travel(){ gradRect('#0369a1','#2dd4bf'); const W=currentSize.w;
    addAt(new fabric.Text('🏔️', { fontSize:W*.22, name:'Sticker' }), .5, .07);
    addAt(T('EXPLORE\nHUNZA VALLEY', { fontFamily:'Montserrat', fontSize:W*.1, fill:'#fff', fontWeight:900, width:W*.9, lineHeight:1.12 }), .5, .36);
    addAt(T('3-day guided trip · Hotel · Transport · Food\nStarting Rs 24,999 per person', { fontFamily:'Inter', fontSize:W*.03, fill:'#ecfeff', width:W*.84, lineHeight:1.4 }), .5, .64); },
  music(){ gradRect('#1e1b4b','#db2777'); const W=currentSize.w;
    addAt(new fabric.Text('🎵', { fontSize:W*.18, name:'Sticker' }), .5, .07);
    addAt(T('MUSIC NIGHT', { fontFamily:'Bebas Neue', fontSize:W*.15, fill:'#fff', width:W*.92 }), .5, .32);
    addAt(T('LIVE IN CONCERT', { fontFamily:'Montserrat', fontSize:W*.05, fill:'#fbcfe8', fontWeight:700, width:W*.85 }), .5, .5);
    addAt(T('Sat · 9 PM · City Arena — Tickets at door', { fontFamily:'Inter', fontSize:W*.03, fill:'#e0e7ff', width:W*.85 }), .5, .66); },
  baby(){ solidBg('#fdf2f8'); const W=currentSize.w;
    addAt(new fabric.Text('👶', { fontSize:W*.2, name:'Sticker' }), .5, .08);
    addAt(T('Baby Shower', { fontFamily:'Pacifico', fontSize:W*.11, fill:'#db2777', width:W*.92 }), .5, .36);
    addAt(T('Welcome to the world, little one!\nJoin us to celebrate — Sunday 4 PM', { fontFamily:'Inter', fontSize:W*.032, fill:'#6d28d9', width:W*.84, lineHeight:1.4 }), .5, .56); },
  vlog(){ gradRect('#f97316','#db2777'); const W=currentSize.w;
    addAt(T('MY DAILY', { fontFamily:'Anton', fontSize:W*.16, fill:'#fff', width:W*.9 }), .5, .14);
    addAt(T('VLOG 📹', { fontFamily:'Anton', fontSize:W*.16, fill:'#fef08a', width:W*.9 }), .5, .36);
    addAt(T('A day in my life — watch till the end!', { fontFamily:'Poppins', fontSize:W*.034, fill:'#fff', fontWeight:600, width:W*.85 }), .5, .6); },
};
let activeCat = 'All';
const CATS = ['All','Social Media','Marketing','Events','Education','Video'];
function tplCardHTML(t, clickFn){
  return `<div class="tpl-card" style="background:linear-gradient(135deg,${t.bg[0]},${t.bg[1]})" onclick="${clickFn}('${t.id}')">
    ${t.pro ? '<span class="lock-badge">⚡ PRO</span>' : ''}
    <div><div class="tpl-title">${t.title}</div><div class="tpl-sub">${t.sub}</div></div></div>`;
}
function filteredTpls(){
  return TEMPLATES.filter(t => (activeCat === 'All' || t.cat === activeCat) &&
    (!searchQuery || (t.title + ' ' + t.sub + ' ' + t.cat).toLowerCase().includes(searchQuery)));
}
function renderTemplateGrids(){
  const cr = document.getElementById('catRow');
  if (cr) cr.innerHTML = CATS.map(c => `<button class="cat-chip ${c===activeCat?'active':''}" onclick="setCat('${c}')">${c}</button>`).join('');
  const home = document.getElementById('tplGridHome');
  if (home) home.innerHTML = filteredTpls().map(t => tplCardHTML(t, 'openTpl')).join('') || '<div class="empty-note">No templates match your search.</div>';
  const all = document.getElementById('tplGridAll');
  if (all) all.innerHTML = filteredTpls().map(t => tplCardHTML(t, 'openTpl')).join('') || '<div class="empty-note">No templates match.</div>';
}
function setCat(c){ activeCat = c; renderTemplateGrids(); }
function renderTemplateLists(){
  const list = document.getElementById('tplList');
  if (list) list.innerHTML = TEMPLATES.map(t => `<div class="tpl-mini" style="background:linear-gradient(135deg,${t.bg[0]},${t.bg[1]})" onclick="applyTemplate('${t.id}')">${t.pro ? '<span class="lock-badge">⚡ PRO</span>' : ''}<div class="tpl-title">${t.title}</div></div>`).join('');
  renderTemplateGrids();
}
function applyTemplate(id){
  const tpl = TEMPLATES.find(t => t.id === id); if (!tpl) return;
  if (tpl.pro && !isPro()){ requirePro('This template'); return; }
  if (!canvas) openEditor(null, null);
  saving = true; canvas.clear(); canvas.setBackgroundColor('#ffffff', () => {});
  BUILDERS[id](); saving = false; history = []; hIndex = -1; pushHistory(true);
  currentDesignId = null; document.getElementById('docTitle').value = tpl.title;
  canvas.discardActiveObject(); canvas.renderAll(); renderLayers(); markUnsaved();
  toast('✅ Template loaded — click anything to edit it');
}
function openTpl(id){
  const tpl = TEMPLATES.find(t => t.id === id);
  if (tpl && tpl.pro && !isPro()){ requirePro('This template'); return; }
  startBlank(tpl && (tpl.id === 'yt' || tpl.id === 'vlog') ? 'yt-thumb' : (tpl && tpl.id === 'story' ? 'ig-story' : 'ig-post'));
  applyTemplate(id);
}
function startBlank(sizeId){
  openEditor(null, null);
  if (sizeId) setSize(sizeId);
  saving = true; canvas.clear(); canvas.setBackgroundColor('#ffffff', () => {}); saving = false;
  history = []; hIndex = -1; pushHistory(true);
  currentDesignId = null; document.getElementById('docTitle').value = 'Untitled design';
  canvas.renderAll(); renderLayers(); fitZoom();
}

/* ================= SAVE / LOAD ================= */
function designSnapshot(){
  canvas.discardActiveObject(); canvas.renderAll();
  return { json: JSON.stringify(canvas.toJSON(['selectable','evented','name'])),
    bg: typeof canvas.backgroundColor === 'string' ? canvas.backgroundColor : '#ffffff',
    thumb: canvas.toDataURL({ format:'jpeg', quality:.6, multiplier: Math.min(300/currentSize.w, 1) }) };
}
function saveDesign(manual){
  if (!canvas) return;
  const ds = getDesigns();
  const snap = designSnapshot();
  const title = document.getElementById('docTitle').value.trim() || 'Untitled design';
  if (currentDesignId){
    const d = ds.find(x => x.id === currentDesignId);
    if (d){ Object.assign(d, snap, { name: title, sizeId: currentSize.id, sizeName: currentSize.name, sizeW: currentSize.w, sizeH: currentSize.h, updated: new Date().toLocaleString() }); saveDesigns(ds); }
  } else {
    if (!isPro() && ds.filter(x => !x.trashed).length >= 5){ requirePro('Unlimited projects (Free limit: 5)'); return; }
    const rec = { id: Date.now(), name: title, sizeId: currentSize.id, sizeName: currentSize.name, sizeW: currentSize.w, sizeH: currentSize.h, updated: new Date().toLocaleString(), trashed:false, ...snap };
    ds.unshift(rec); saveDesigns(ds); currentDesignId = rec.id;
  }
  document.getElementById('savedNote').textContent = '☁️ Saved';
  if (manual) toast('💾 Design saved to Your projects');
}
function loadDesign(id){
  const d = getDesigns().find(x => x.id === id); if (!d) return;
  openEditor(null, null);
  if (d.sizeId && SIZES.find(s => s.id === d.sizeId)) setSize(d.sizeId);
  else if (d.sizeW) { currentSize = { id:'custom', name: d.sizeName || 'Custom', w: d.sizeW, h: d.sizeH }; canvas.setWidth(d.sizeW); canvas.setHeight(d.sizeH); updateSizeLbl(); }
  saving = true;
  canvas.loadFromJSON(d.json, () => {
    canvas.setBackgroundColor(d.bg || '#ffffff', () => {});
    canvas.renderAll(); saving = false; history = []; hIndex = -1; pushHistory(true); renderLayers(); fitZoom();
    currentDesignId = d.id; document.getElementById('docTitle').value = d.name;
    document.getElementById('savedNote').textContent = '☁️ Saved';
  });
}

/* ================= SHARE ================= */
function parseShareHash(){
  if (!location.hash.startsWith('#d=')) return null;
  try { return decodeURIComponent(escape(atob(location.hash.slice(3)))); } catch(e){ return null; }
}
function openShare(){
  if (!canvas) return;
  saveDesign(false);
  const link = location.origin + location.pathname + '#d=' + btoa(unescape(encodeURIComponent(JSON.stringify(canvas.toJSON(['selectable','evented','name'])))));
  document.getElementById('shareLink').value = link;
  openModal('shareModal');
}
function copyShare(){ const i = document.getElementById('shareLink'); i.select(); if (navigator.clipboard) navigator.clipboard.writeText(i.value); toast('🔗 Share link copied'); }
function openSharedDesign(json){
  openEditor(null, null);
  saving = true;
  canvas.loadFromJSON(json, () => { canvas.renderAll(); saving = false; history = []; hIndex = -1; pushHistory(true); renderLayers(); fitZoom(); currentDesignId = null; document.getElementById('docTitle').value = 'Shared design (copy)'; toast('🔗 Shared design opened — Save to keep your copy'); });
  history.replaceState(null, '', location.pathname);
}

/* ================= EXPORT ================= */
function toggleExportMenu(){ const m = document.getElementById('exportMenu'); m.style.display = m.style.display === 'none' ? '' : 'none'; }
document.addEventListener('click', e => { if (!e.target.closest('#view-editor .ed-right')) { const m = document.getElementById('exportMenu'); if (m) m.style.display = 'none'; } });
function downloadURI(uri, name){ const a = document.createElement('a'); a.href = uri; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
function withWatermark(fn){
  canvas.discardActiveObject(); let wm = null;
  if (!isPro()){ wm = new fabric.Text('Made with Kanva', { left: currentSize.w - 8, top: currentSize.h - 8, fontSize: Math.max(13, currentSize.w*.016), fill:'rgba(0,0,0,.45)', fontFamily:'Inter', originX:'right', originY:'bottom', selectable:false, evented:false, name:'__wm' }); canvas.add(wm); }
  canvas.renderAll(); fn();
  if (wm){ canvas.remove(wm); canvas.renderAll(); }
  document.getElementById('exportMenu').style.display = 'none';
}
function exportPNG(mult){ if (mult > 1 && !isPro()){ requirePro('HD export'); return; } withWatermark(() => downloadURI(canvas.toDataURL({ format:'png', multiplier: mult }), 'kanva-design.png')); toast('⬇️ PNG downloaded' + (mult > 1 ? ' (HD)' : '')); }
function exportJPG(){ withWatermark(() => downloadURI(canvas.toDataURL({ format:'jpeg', quality:.92 }), 'kanva-design.jpg')); toast('⬇️ JPG downloaded'); }
function exportPDF(){ withWatermark(() => { const { jsPDF } = window.jspdf; const pdf = new jsPDF({ orientation: currentSize.w >= currentSize.h ? 'landscape' : 'portrait', unit:'px', format:[currentSize.w, currentSize.h], hotfixes:['px_scaling'] }); pdf.addImage(canvas.toDataURL({ format:'jpeg', quality:.92 }), 'JPEG', 0, 0, currentSize.w, currentSize.h); pdf.save('kanva-design.pdf'); }); toast('⬇️ PDF downloaded'); }

/* ================= PAYMENT / ADMIN ================= */
function openPayment(plan){ document.getElementById('pfPlan').value = plan || 'monthly'; updatePayAmount(); openModal('paymentModal'); }
function updatePayAmount(){ document.getElementById('payAmount').textContent = 'Rs ' + PRICES[document.getElementById('pfPlan').value].toLocaleString(); }
function copyNumber(){ if (navigator.clipboard) navigator.clipboard.writeText(EASYPAISA_NUMBER); toast('📋 Easypaisa number copied: ' + EASYPAISA_NUMBER); }
function submitPayment(e){
  e.preventDefault();
  const plan = document.getElementById('pfPlan').value;
  const order = { id: Date.now(), email: currentUser ? currentUser.email : '', name: document.getElementById('pfName').value.trim(), phone: document.getElementById('pfPhone').value.trim(), plan, amount: PRICES[plan], tid: document.getElementById('pfTid').value.trim(), status:'pending', date: new Date().toLocaleString() };
  const shot = document.getElementById('pfShot').files[0];
  const save = () => { const o = getOrders(); o.unshift(order); localStorage.setItem('kv_orders', JSON.stringify(o)); closeModal('paymentModal'); toast('✅ Order submitted! Pro activates after TID verification.'); e.target.reset(); renderOrders(); };
  if (shot){ const r = new FileReader(); r.onload = () => { order.shot = r.result; save(); }; r.readAsDataURL(shot); } else save();
}
function openAdmin(){
  const orders = getOrders(); const el = document.getElementById('adminOrders');
  el.innerHTML = orders.length ? orders.map(o => `<div class="order-item"><span class="st ${o.status}">${o.status.toUpperCase()}</span> <b>${escapeHtml(o.name)}</b> (${escapeHtml(o.email || '')}) — ${escapeHtml(o.phone)}<br>${o.plan === 'yearly' ? 'Pro Yearly' : 'Pro Monthly'} · Rs ${o.amount} · TID: <b>${escapeHtml(o.tid)}</b> · ${o.date}
    ${o.shot ? `<br><img src="${o.shot}" style="max-width:220px;border-radius:8px;margin-top:6px">` : ''}
    ${o.status === 'pending' ? `<div style="margin-top:8px"><button class="btn btn-primary" onclick="setOrder(${o.id},'approved')">✅ Approve</button> <button class="btn btn-ghost" onclick="setOrder(${o.id},'rejected')">❌ Reject</button></div>` : ''}</div>`).join('') : '<p class="muted">No orders yet.</p>';
  openModal('adminModal');
}
function setOrder(id, status){
  const orders = getOrders(); const o = orders.find(x => x.id === id); if (!o) return;
  o.status = status; localStorage.setItem('kv_orders', JSON.stringify(orders));
  if (status === 'approved'){ localStorage.setItem('kv_plan_' + o.email, 'pro'); if (currentUser && currentUser.email === o.email) refreshPlanUI(); toast('⚡ Pro activated for ' + o.email); }
  openAdmin(); renderOrders();
}

/* ================= UI helpers / init ================= */
function openModal(id){ document.getElementById(id).style.display = 'flex'; }
function closeModal(id){ document.getElementById(id).style.display = 'none'; }
document.querySelectorAll('.modal-bg').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.style.display = 'none'; }));
let toastTimer;
function toast(msg){ const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3200); }
document.getElementById('pfPlan').addEventListener('change', updatePayAmount);
document.addEventListener('keydown', e => {
  const ed = document.getElementById('view-editor');
  if (!ed || ed.style.display === 'none' || !canvas) return;
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || (active() && active().isEditing);
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z'){ e.preventDefault(); undo(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y'){ e.preventDefault(); redo(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's'){ e.preventDefault(); saveDesign(true); }
  if ((e.key === 'Delete' || e.key === 'Backspace') && !typing) deleteObj();
});
window.addEventListener('resize', () => { if (canvas && document.getElementById('view-editor').style.display !== 'none') fitZoom(); });
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; const b = document.getElementById('installBtn'); if (b) b.style.display = ''; });
function installApp(){ if (deferredPrompt){ deferredPrompt.prompt(); deferredPrompt.userChoice.then(() => { deferredPrompt = null; }); } else toast('Browser menu ⋮ → “Install app / Add to Home screen”'); }

/* init */
renderTemplateGrids();
initGoogle();
if (!restoreSession()){ document.getElementById('view-auth').style.display = ''; }
