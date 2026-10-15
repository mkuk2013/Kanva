/* ============================================================
   KANVA v2 — Canva-style design platform (original code)
   Auth + Dashboard + Editor + Templates + Easypaisa Pro
   ============================================================ */
const APP_NAME = 'Kanva';
/* Google Sign-In: paste the OAuth Web Client ID (ends with .apps.googleusercontent.com).
   It is a PUBLIC identifier (not a secret) — safe in frontend code. */
const GOOGLE_CLIENT_ID = '1025444032477-u8clpon4uka5tuipkq7rd5vs7r137h9a.apps.googleusercontent.com';
const EASYPAISA_NUMBER = '03363268833';
const PRICES = { monthly: 599, yearly: 4999 };
/* Super Admin: only these emails see the Super Admin panel and can manage users */
const SUPER_ADMIN_EMAILS = ['mkuk2013@gmail.com'];
function isSuperAdmin(){ return !!currentUser && SUPER_ADMIN_EMAILS.includes(currentUser.email); }
const SIZES = [
  { id:'ig-post',  name:'Instagram Post',    w:1080, h:1080, icon:'ig' },
  { id:'ig-story', name:'Story / Reel',      w:1080, h:1920, icon:'story' },
  { id:'fb-post',  name:'Facebook Post',     w:1200, h:630,  icon:'fb' },
  { id:'yt-thumb', name:'YouTube Thumbnail', w:1280, h:720,  icon:'yt' },
  { id:'logo',     name:'Logo',              w:500,  h:500,  icon:'logo' },
  { id:'pres',     name:'Presentation',      w:1920, h:1080, icon:'pres' },
  { id:'poster',   name:'Poster',            w:794,  h:1123, icon:'poster' },
  { id:'fb-cover', name:'Facebook Cover',    w:1640, h:924,  icon:'cover' },
];
const FONTS = ['Poppins','Inter','Montserrat','Roboto','Oswald','Bebas Neue','Playfair Display','Pacifico','Dancing Script','Anton','Lobster','Arial','Georgia','Verdana','Courier New'];

/* ---------------- AUTH (Supabase cloud — v3) ----------------
   Accounts/designs/plans/teams/orders live in Supabase Postgres.
   localStorage remains only for the local Demo account + offline cache. */
const SB_URL = 'https://tjwgwdupwytiaocbmzvz.supabase.co';
const SB_KEY = 'sb_publishable_y183kF6ySPvUQzEWtmroLw__d-QCFvW';
let sb = null;
try { sb = window.supabase ? window.supabase.createClient(SB_URL, SB_KEY) : null; } catch(e){ sb = null; }

let authMode = 'login';
let currentUser = null;        // { name, email, picture, demo? }
let cloudUser = null;          // Supabase auth user (null = local/demo mode)
let profileRow = null;         // profiles row: plan + blocked
let designsCache = null;       // cloud designs (UI shape), live array
let teamCache = null;          // my team members (UI shape)
let memberOfOwner = null;      // owner email if I am a team member (Pro via team)
let brandCache = null;         // my brand kit object
let myOrdersCache = [];        // my Easypaisa orders
const designFp = {};           // design id -> fingerprint (diff sync)
const teamFp = {};             // member email -> fingerprint
function isCloud(){ return !!cloudUser; }

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

async function handleAuth(e){
  e.preventDefault();
  const email = document.getElementById('auEmail').value.trim().toLowerCase();
  const pass = document.getElementById('auPassword').value;
  const name = document.getElementById('auName').value.trim();
  const err = document.getElementById('authErr');
  err.textContent = '';
  if (!sb){ err.textContent = 'Server se rabta nahi ho pa raha — internet check karke page refresh karein.'; return; }
  const btn = document.getElementById('authSubmit');
  const oldLbl = btn.textContent; btn.textContent = 'Please wait…'; btn.disabled = true;
  try {
    if (authMode === 'signup'){
      if (!name){ err.textContent = 'Please enter your full name.'; return; }
      const { data, error } = await sb.auth.signUp({ email, password: pass, options: { data: { full_name: name } } });
      if (error){ err.textContent = /rate limit/i.test(error.message) ? 'Bohat zyada signups ho rahe hain — kuch minute baad dobara try karein.' : /already registered/i.test(error.message) ? 'Ye email pehle se registered hai — please Log in karein.' : error.message; return; }
      if (data.session){ const ok = await afterAuth(data.user); if (ok) toast('🎉 Welcome to Kanva, ' + name.split(' ')[0] + '!'); }
      else { err.textContent = '✅ Account ban gaya! Apni email par aye hue confirmation link par click karein, phir yahan login karein.'; if (authMode === 'signup') toggleAuthMode(); }
    } else {
      const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
      if (error){ err.textContent = error.message === 'Invalid login credentials' ? 'Email ya password ghalat hai. Dobara try karein, ya Sign up karein agar account nahi hai.' : /not confirmed/i.test(error.message) ? 'Apni email pehle confirm karein — confirmation link aap ki email par gaya tha, us par click karke phir login karein.' : /rate limit/i.test(error.message) ? 'Bohat zyada koshish ho gayi — kuch minute baad dobara try karein.' : error.message; return; }
      const ok = await afterAuth(data.user);
      if (ok) toast('👋 Welcome back, ' + currentUser.name.split(' ')[0] + '!');
    }
  } catch(ex){ err.textContent = 'Kuch ghalat ho gaya — dobara try karein.'; }
  finally { btn.textContent = oldLbl; btn.disabled = false; }
}

/* After a successful Supabase auth: load profile + all cloud data, then enter the app. */
async function afterAuth(user, silent){
  cloudUser = user;
  const email = (user.email || '').toLowerCase();
  let prof = null;
  try {
    const r = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
    prof = r.data;
  } catch(e){}
  if (!prof){
    const meta = user.user_metadata || {};
    const ins = { id: user.id, email, name: meta.full_name || meta.name || email.split('@')[0], picture: meta.avatar_url || meta.picture || '' };
    try { const r2 = await sb.from('profiles').insert(ins).select().maybeSingle(); prof = r2.data || ins; }
    catch(e){ prof = ins; }
  }
  profileRow = prof;
  if (prof && prof.blocked){
    try { await sb.auth.signOut(); } catch(e){}
    cloudUser = null; profileRow = null;
    toast('🚫 Ye account admin ne block kar diya hai. Please contact support.');
    document.getElementById('view-auth').style.display = '';
    return false;
  }
  currentUser = { name: (prof && prof.name) || email.split('@')[0], email, picture: (prof && prof.picture) || '' };
  await loadCloudData();
  enterApp();
  if (pendingTpl){ const _pt = pendingTpl; pendingTpl = null; setTimeout(() => openTpl(_pt), 450); }
  const shared = parseShareHash();
  if (shared) openSharedDesign(shared);
  return true;
}

function rowToDesign(r){
  const d = r.data || {};
  return { id: r.id, name: r.name, sizeId: r.size_id, sizeName: r.size_name, sizeW: r.size_w, sizeH: r.size_h,
           json: d.json, bg: d.bg, thumb: d.thumb, trashed: !!r.trashed,
           updated: r.updated_at ? new Date(r.updated_at).toLocaleString() : '' };
}
function fingerprintOf(d){
  return [d.name, d.trashed ? 1 : 0, (d.json || '').length, (d.thumb || '').length, d.bg || '', d.sizeW || 0, d.sizeH || 0, d.sizeId || ''].join('|');
}
async function loadCloudData(){
  try {
    const [dz, tOwn, tMem, bk, ord] = await Promise.all([
      sb.from('designs').select('*').eq('user_id', cloudUser.id).order('updated_at', { ascending: false }),
      sb.from('teams').select('*').eq('owner_id', cloudUser.id),
      sb.from('teams').select('*').eq('member_email', currentUser.email),
      sb.from('brand_kits').select('*').eq('user_id', cloudUser.id).maybeSingle(),
      sb.from('orders').select('*').eq('user_id', cloudUser.id).order('created_at', { ascending: false })
    ]);
    designsCache = (dz.data || []).map(rowToDesign);
    Object.keys(designFp).forEach(k => delete designFp[k]);
    designsCache.forEach(d => { designFp[d.id] = fingerprintOf(d); });
    teamCache = (tOwn.data || []).map(r => ({ name: r.member_name || '', email: r.member_email, role: r.role || 'Editor' }));
    Object.keys(teamFp).forEach(k => delete teamFp[k]);
    teamCache.forEach(m => { teamFp[m.email] = [m.name, m.role].join('|'); });
    memberOfOwner = (tMem.data && tMem.data.length) ? tMem.data[0].owner_email : null;
    brandCache = (bk.data && bk.data.data) ? bk.data.data : null;
    myOrdersCache = ord.data || [];
  } catch(e){ designsCache = designsCache || []; teamCache = teamCache || []; }
  await migrateLocalDesigns();
}
/* One-time: upload this device's old (v2) local designs to the cloud. */
async function migrateLocalDesigns(){
  try {
    if (!designsCache || designsCache.length) return;
    const key = 'kv_designs_' + currentUser.email;
    const local = JSON.parse(localStorage.getItem(key) || '[]');
    if (!local.length || localStorage.getItem('kv_migrated3_' + currentUser.email)) return;
    const rows = local.map(d => ({ id: d.id, user_id: cloudUser.id, name: d.name, size_id: d.sizeId, size_name: d.sizeName,
      size_w: d.sizeW, size_h: d.sizeH, data: { json: d.json, bg: d.bg, thumb: d.thumb }, trashed: !!d.trashed }));
    const { error } = await sb.from('designs').insert(rows);
    if (!error){
      designsCache = local.slice();
      designsCache.forEach(d => { designFp[d.id] = fingerprintOf(d); });
      localStorage.setItem('kv_migrated3_' + currentUser.email, '1');
    }
  } catch(e){}
}

function demoLogin(){
  cloudUser = null; profileRow = null; designsCache = null; teamCache = null; brandCache = null; memberOfOwner = null; myOrdersCache = [];
  currentUser = { name: 'Demo User', email: 'demo@kanva.app', picture: '', demo: true };
  enterApp();
  toast('⚡ Logged in with Demo Account');
  if (pendingTpl){ const _pt = pendingTpl; pendingTpl = null; setTimeout(() => openTpl(_pt), 450); }
  const shared = parseShareHash();
  if (shared) openSharedDesign(shared);
}
function googleNotice(){
  toast('⚠️ Google ka button load nahi ho saka — page refresh karke dobara try karein, ya email/Demo se login karein');
}
/* ---------- Google Sign-In (via Supabase Auth) ---------- */
function decodeJwt(token){
  const part = token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
  const json = decodeURIComponent(atob(part).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
  return JSON.parse(json);
}
async function handleGoogleCredential(resp){
  if (!sb){ googleNotice(); return; }
  try {
    const { data, error } = await sb.auth.signInWithIdToken({ provider: 'google', token: resp.credential });
    if (error || !data || !data.user){ toast('Google login ka setup abhi mukammal ho raha hai — filhal email ya Demo se login karein'); return; }
    const ok = await afterAuth(data.user);
    if (ok) toast('🎉 Welcome, ' + currentUser.name.split(' ')[0] + ' — signed in with Google');
  } catch(e){ toast('Google login failed — please try again'); }
}
/* Google button is rendered declaratively by the GIS library itself
   (g_id_onload + g_id_signin markup in index.html). This watchdog only
   reveals our fallback button if Google's button truly fails to render. */
function googleWatchdog(){
  setTimeout(() => {
    const zone = document.querySelector('.g_id_signin');
    const fb = document.getElementById('googleFallback');
    if (fb && (!zone || !zone.querySelector('iframe'))) fb.style.display = '';
  }, 5000);
}
async function logout(){
  try { if (sb && cloudUser) await sb.auth.signOut(); } catch(e){}
  cloudUser = null; profileRow = null; currentUser = null;
  designsCache = null; teamCache = null; brandCache = null; memberOfOwner = null; myOrdersCache = [];
  localStorage.removeItem('kv_session');
  try { document.cookie = 'kv_session=; max-age=0; path=/'; } catch(e){}
  document.getElementById('view-app').style.display = 'none';
  document.getElementById('view-editor').style.display = 'none';
  document.getElementById('view-auth').style.display = '';
}
async function restoreCloudSession(){
  if (!sb) return false;
  try {
    const { data } = await sb.auth.getSession();
    if (data && data.session && data.session.user) return await afterAuth(data.session.user, true);
  } catch(e){}
  return false;
}
if (sb && sb.auth && sb.auth.onAuthStateChange){
  sb.auth.onAuthStateChange((ev) => {
    if (ev === 'SIGNED_OUT' && currentUser && !currentUser.demo){
      currentUser = null; cloudUser = null;
      document.getElementById('view-app').style.display = 'none';
      document.getElementById('view-editor').style.display = 'none';
      document.getElementById('view-auth').style.display = '';
    }
  });
}

/* ---------------- PER-USER STORAGE (cloud-aware) ---------------- */
function designsKey(){ return 'kv_designs_' + (currentUser ? currentUser.email : 'guest'); }
function getDesigns(){
  if (isCloud()) return designsCache || [];
  return JSON.parse(localStorage.getItem(designsKey()) || '[]');
}
function saveDesigns(d){
  if (isCloud()){ designsCache = d; syncDesigns(); return true; }
  try { localStorage.setItem(designsKey(), JSON.stringify(d)); return true; }
  catch(e){ toast('⚠️ Phone storage full hai — purane designs/uploads delete karke dobara save karein'); return false; }
}
/* Diff-sync the in-memory design list to Supabase (only changed rows are written). */
async function syncDesigns(){
  if (!isCloud() || !designsCache) return;
  const seen = {};
  for (const d of designsCache){
    seen[d.id] = true;
    const fp = fingerprintOf(d);
    if (designFp[d.id] !== fp){
      designFp[d.id] = fp;
      try {
        await sb.from('designs').upsert({ id: d.id, user_id: cloudUser.id, name: d.name, size_id: d.sizeId, size_name: d.sizeName,
          size_w: d.sizeW, size_h: d.sizeH, data: { json: d.json, bg: d.bg, thumb: d.thumb }, trashed: !!d.trashed,
          updated_at: new Date().toISOString() }, { onConflict: 'id' });
      } catch(e){}
    }
  }
  for (const id of Object.keys(designFp)){
    if (!seen[id]){ delete designFp[id]; try { await sb.from('designs').delete().eq('id', id); } catch(e){} }
  }
}
function planKey(){ return 'kv_plan_' + (currentUser ? currentUser.email : 'guest'); }
function getPlan(){
  if (isCloud()) return (profileRow && profileRow.plan) || 'free';
  return localStorage.getItem(planKey()) || 'free';
}
function teamKey(){ return 'kv_team_' + (currentUser ? currentUser.email : 'guest'); }
function getTeam(){
  if (isCloud()) return teamCache || [];
  return JSON.parse(localStorage.getItem(teamKey()) || '[]');
}
function saveTeam(t){
  if (isCloud()){ teamCache = t; syncTeam(); return; }
  try { localStorage.setItem(teamKey(), JSON.stringify(t)); } catch(e){ toast('⚠️ Storage full hai'); }
}
async function syncTeam(){
  if (!isCloud() || !teamCache) return;
  const seen = {};
  for (const m of teamCache){
    seen[m.email] = true;
    const fp = [m.name, m.role].join('|');
    if (teamFp[m.email] !== fp){
      teamFp[m.email] = fp;
      try { await sb.from('teams').upsert({ owner_id: cloudUser.id, owner_email: currentUser.email, member_email: m.email, member_name: m.name, role: m.role }, { onConflict: 'owner_id,member_email' }); } catch(e){}
    }
  }
  for (const em of Object.keys(teamFp)){
    if (!seen[em]){ delete teamFp[em]; try { await sb.from('teams').delete().eq('owner_id', cloudUser.id).eq('member_email', em); } catch(e){} }
  }
}
function teamOwnerOf(email){
  if (isCloud()) return (currentUser && email === currentUser.email) ? memberOfOwner : null;
  if (!email) return null;
  try {
    for (let i = 0; i < localStorage.length; i++){
      const k = localStorage.key(i);
      if (k && k.indexOf('kv_team_') === 0){
        const members = JSON.parse(localStorage.getItem(k) || '[]');
        if (members.some(m => m.email === email)) return k.slice('kv_team_'.length);
      }
    }
  } catch(e){}
  return null;
}
function isPro(){ return getPlan() === 'pro' || !!teamOwnerOf(currentUser ? currentUser.email : ''); }
function getOrders(){
  if (isCloud()) return (myOrdersCache || []).map(r => ({ id: r.id, email: r.email, name: '', phone: '', plan: r.plan, amount: r.amount, tid: r.tid, status: r.status, date: r.created_at ? new Date(r.created_at).toLocaleString() : '', shot: r.screenshot || '' }));
  return JSON.parse(localStorage.getItem('kv_orders') || '[]');
}
function brandKey(){ return 'kv_brand_' + (currentUser ? currentUser.email : 'guest'); }
function getBrand(){
  if (isCloud()){
    if (!brandCache) brandCache = { colors: [], logo: '', font: 'Poppins' };
    return brandCache;
  }
  return JSON.parse(localStorage.getItem(brandKey()) || '{"colors":[],"logo":"","font":"Poppins"}');
}
function saveBrand(b){
  if (isCloud()){
    brandCache = b;
    sb.from('brand_kits').upsert({ user_id: cloudUser.id, data: b }, { onConflict: 'user_id' })
      .then(({ error }) => { if (error) toast('⚠️ Brand kit save nahi ho saka — internet check karein'); });
    return;
  }
  localStorage.setItem(brandKey(), JSON.stringify(b));
}
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
  const oldAdminNav = document.querySelector('.side-nav .admin-nav'); if (oldAdminNav) oldAdminNav.remove();
  if (isSuperAdmin() && !document.querySelector('.side-nav .sa-nav')){
    document.querySelector('.side-nav').insertAdjacentHTML('beforeend', '<a class="snav sa-nav" data-page="superadmin" onclick="goPage(\'superadmin\')"><img class="nav-ic" src="' + KV_ICONS.admin + '" alt=""><span class="sn-txt">Super Admin</span></a>');
  }
  refreshPlanUI(); renderDashboard(); goPage('home');
}
function showApp(){ document.getElementById('view-editor').style.display='none'; document.getElementById('view-app').style.display=''; renderDashboard(); }
function goPage(p){
  document.querySelectorAll('.snav[data-page]').forEach(a => a.classList.toggle('active', a.dataset.page === p));
  ['home','projects','templates','brand','team','pricing','trash','superadmin'].forEach(x => { const el = document.getElementById('page-'+x); if (el) el.style.display = x === p ? '' : 'none'; });
  if (p === 'projects') renderProjects();
  if (p === 'templates') renderTemplateGrids();
  if (p === 'brand') renderBrand();
  if (p === 'team') renderTeam();
  if (p === 'trash') renderTrash();
  if (p === 'superadmin') renderSuperAdmin();
  window.scrollTo(0,0);
}
function refreshPlanUI(){
  const pro = isPro();
  ['planBadge','planBadge2'].forEach(id => { const b = document.getElementById(id); if (b){ b.textContent = pro ? '⚡ PRO' : 'FREE'; b.className = 'plan-badge ' + (pro ? 'pro' : 'free'); } });
  const up = document.getElementById('userPlan'); if (up) up.textContent = pro ? 'Pro plan ⚡' : 'Free plan';
  const ub = document.getElementById('upgradeBtn'); if (ub) ub.style.display = pro ? 'none' : '';
  const pb = document.getElementById('pricingUpgradeBtn'); if (pb) pb.style.display = pro ? 'none' : '';
  const pn = document.getElementById('pricingProNote'); if (pn) pn.style.display = pro ? '' : 'none';
  renderTemplateGrids();
}
function renderDashboard(){
  document.getElementById('typeRow').innerHTML = SIZES.map(s =>
    `<button class="type-item" onclick="openEditor('${s.id}')"><span class="type-ic"><img src="${KV_ICONS[s.icon]}" alt=""></span>${s.name}</button>`).join('') +
    `<button class="type-item" onclick="customSize()"><span class="type-ic"><img src="${KV_ICONS.custom}" alt=""></span>Custom size</button>`;
  document.getElementById('createMenu').innerHTML = SIZES.map(s =>
    `<button onclick="toggleCreateMenu();openEditor('${s.id}')"><img class="cm-ic" src="${KV_ICONS[s.icon]}" alt="">${s.name} <small>${s.w} × ${s.h} px</small></button>`).join('') +
    `<button onclick="toggleCreateMenu();customSize()"><img class="cm-ic" src="' + KV_ICONS.custom + '" alt="">Custom size</button>`;
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
function setBrandLogo(ev){ const f = ev.target.files[0]; if (!f) return; processImageFile(f, dataUrl => { const b = getBrand(); b.logo = dataUrl; saveBrand(b); renderBrand(); toast('🏷️ Brand logo saved'); }); }
function setBrandFont(f){ const b = getBrand(); b.font = f; saveBrand(b); toast('🔤 Brand font set to ' + f); }

/* ---------------- TEAM PAGE ---------------- */
function renderTeam(){
  const ownerPro = getPlan() === 'pro';
  const owner = teamOwnerOf(currentUser.email);
  const tl = document.getElementById('teamLocked'); if (tl) tl.style.display = ownerPro ? 'none' : '';
  const tm = document.getElementById('teamMain'); if (tm) tm.style.display = ownerPro ? '' : 'none';
  const mb = document.getElementById('teamMemberBanner');
  if (mb){
    if (owner && !ownerPro){ mb.style.display = ''; mb.innerHTML = '🎉 Tum <b>' + escapeHtml(owner) + '</b> ki team ke member ho — <b>Pro features tumhare liye active hain ⚡</b>'; }
    else mb.style.display = 'none';
  }
  const t = getTeam();
  const tc = document.getElementById('teamCount'); if (tc) tc.textContent = t.length + ' / 500 members';
  if (!ownerPro) return;
  const list = document.getElementById('teamList'); if (!list) return;
  list.innerHTML = t.length ? t.map(m =>
    `<div class="team-item"><div class="avatar team-av">${escapeHtml(m.name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase())}</div>
      <div class="team-info"><b>${escapeHtml(m.name)}</b><span>${escapeHtml(m.email)} · ${escapeHtml(m.role)} · added ${escapeHtml(m.added || '')}</span></div>
      <button class="btn btn-ghost" onclick="removeTeamMember('${m.email}')">Remove</button></div>`).join('')
    : '<p class="muted small">Abhi koi member nahi — upar se pehla member add karein.</p>';
}
function addTeamMember(){
  const name = document.getElementById('tmName').value.trim();
  const email = document.getElementById('tmEmail').value.trim().toLowerCase();
  const role = document.getElementById('tmRole').value;
  if (!name || !email || email.indexOf('@') < 1){ toast('Member ka naam aur sahi email likhein'); return; }
  if (email === currentUser.email){ toast('Apne aap ko team mein add nahi kar sakte 🙂'); return; }
  const t = getTeam();
  if (t.length >= 500){ toast('Team limit poori — zyada se zyada 500 members'); return; }
  if (t.some(m => m.email === email)){ toast('Ye email pehle se team mein hai'); return; }
  t.push({ name, email, role, added: new Date().toLocaleDateString() });
  saveTeam(t); renderTeam();
  document.getElementById('tmName').value = ''; document.getElementById('tmEmail').value = '';
  toast('👥 ' + name + ' team mein add ho gaya — wo isi email se login karke Pro use kar sakta hai');
}
function removeTeamMember(email){
  if (!confirm('Is member ko team se hatayein? Us ka Pro bhi band ho jayega.')) return;
  saveTeam(getTeam().filter(m => m.email !== email)); renderTeam(); toast('Member hata diya gaya');
}

/* ================= EDITOR ================= */
let canvas, zoom = 1, history = [], hIndex = -1, saving = false;
let currentSize = SIZES[0], currentDesignId = null;
let uploads = JSON.parse(localStorage.getItem('kv_uploads') || '[]');

function openEditor(sizeId, tplId){
  if (typeof fabric === 'undefined'){ toast('⚠️ Editor library load nahi hui — internet check karke page refresh karein'); return; }
  thumbAbort = true;
  try { renderTemplateLists(); } catch(e){}
  document.getElementById('view-app').style.display = 'none';
  document.getElementById('view-auth').style.display = 'none';
  document.getElementById('view-editor').style.display = '';
  if (!canvas) initCanvas();
  if (sizeId) setSize(sizeId);
  if (tplId) applyTemplate(tplId);
  const sp = document.querySelector('.sidepanel');
  if (sp && window.innerWidth <= 900) sp.classList.remove('open');
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
  const stageEl = document.getElementById('stage');
  if (stageEl) stageEl.addEventListener('pointerdown', () => { if (window.innerWidth <= 900){ const p = document.querySelector('.sidepanel'); if (p) p.classList.remove('open'); } });
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
  const json = JSON.stringify(canvas.toJSON(['selectable','evented','name','__locked','__f']));
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
  if (kind==='diamond') o = new fabric.Polygon([{x:0,y:-s/2},{x:s/2,y:0},{x:0,y:s/2},{x:-s/2,y:0}], { fill, name:'Diamond' });
  if (kind==='hex'){ const pts=[]; for (let i=0;i<6;i++){ const a=Math.PI/3*i - Math.PI/2; pts.push({ x:(s/2)*Math.cos(a)+(s/2), y:(s/2)*Math.sin(a)+(s/2) }); } o = new fabric.Polygon(pts, { fill:'#22c55e', name:'Hexagon' }); }
  if (kind==='plus'){ const v = new fabric.Rect({ left: s*.36, top: 0, width: s*.28, height: s, fill }); const hbar = new fabric.Rect({ left: 0, top: s*.36, width: s, height: s*.28, fill }); o = new fabric.Group([v, hbar], { name:'Plus' }); }
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
  if (isText){ const cs = document.getElementById('pCharSp'); if (cs) cs.value = o.charSpacing || 0; }
  const bl = document.getElementById('btnLock');
  if (bl){ bl.textContent = o.__locked ? '🔒 Locked' : '🔓 Lock'; bl.style.background = o.__locked ? '#efe9ff' : ''; }
  syncImgCtx();
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

/* ---- Position / Flip / Group / Lock (Canva-style) ---- */
function alignObj(pos){
  const o = active(); if (!o) return;
  const r = o.getBoundingRect();
  let dx = 0, dy = 0;
  if (pos==='left') dx = -r.left;
  if (pos==='center') dx = currentSize.w/2 - (r.left + r.width/2);
  if (pos==='right') dx = currentSize.w - (r.left + r.width);
  if (pos==='top') dy = -r.top;
  if (pos==='middle') dy = currentSize.h/2 - (r.top + r.height/2);
  if (pos==='bottom') dy = currentSize.h - (r.top + r.height);
  o.set({ left: o.left + dx, top: o.top + dy }); o.setCoords(); canvas.renderAll(); pushHistory(); markUnsaved();
}
function flipObj(axis){
  const o = active(); if (!o) return;
  if (axis==='x') o.set('flipX', !o.flipX); else o.set('flipY', !o.flipY);
  canvas.renderAll(); pushHistory(); markUnsaved();
}
function groupObjs(){
  const o = active(); if (!o) return;
  if (o.type === 'activeSelection'){ o.toGroup(); const g = active(); if (g) g.name = 'Group'; canvas.renderAll(); pushHistory(); markUnsaved(); toast('🧩 Group ban gaya — ab sab ek sath move hoga'); }
  else toast('Pehle 2 ya zyada cheezein select karein (canvas par drag karke) phir Group dabayein');
}
function ungroupObj(){
  const o = active(); if (!o) return;
  if (o.type === 'group'){ o.toActiveSelection(); canvas.renderAll(); pushHistory(); markUnsaved(); toast('Group khul gaya'); }
  else toast('Ye group nahi hai');
}
function toggleLock(){
  const o = active(); if (!o) return;
  const locked = !o.__locked; o.__locked = locked;
  o.set({ lockMovementX: locked, lockMovementY: locked, lockRotation: locked, lockScalingX: locked, lockScalingY: locked, hasControls: !locked });
  canvas.renderAll(); syncProps(); pushHistory(); markUnsaved();
  toast(locked ? '🔒 Locked — ye galti se move nahi hoga' : '🔓 Unlocked');
}
/* ---- Text extras ---- */
function setCharSpacing(v){ const o=active(); if(o){ o.set('charSpacing', parseInt(v)||0); canvas.renderAll(); } }
function setTextBg(v){ const o=active(); if(o){ o.set('textBackgroundColor', v); canvas.renderAll(); } }
function clearTextBg(){ const o=active(); if(o){ o.set('textBackgroundColor', ''); canvas.renderAll(); } }
/* ---- Photo filters (Canva "Edit image") ---- */
function applyFilters(){
  const o = active(); if (!o || o.type !== 'image') return;
  const f = o.__f || { b:0, c:0, s:0, bw:false, sepia:false };
  const arr = [];
  if (f.b) arr.push(new fabric.Image.filters.Brightness({ brightness: f.b/100 }));
  if (f.c) arr.push(new fabric.Image.filters.Contrast({ contrast: f.c/100 }));
  if (f.s) arr.push(new fabric.Image.filters.Saturation({ saturation: f.s/100 }));
  if (f.bw) arr.push(new fabric.Image.filters.Grayscale());
  if (f.sepia) arr.push(new fabric.Image.filters.Sepia());
  o.filters = arr; o.applyFilters(); canvas.renderAll(); pushHistory(); markUnsaved();
}
function setFilter(kind, v){
  const o = active(); if (!o || o.type !== 'image') return;
  o.__f = o.__f || { b:0, c:0, s:0, bw:false, sepia:false };
  if (kind==='bw' || kind==='sepia') o.__f[kind] = !o.__f[kind]; else o.__f[kind] = parseInt(v)||0;
  applyFilters(); syncImgCtx();
}
function resetFilters(){ const o = active(); if (!o) return; o.__f = { b:0, c:0, s:0, bw:false, sepia:false }; applyFilters(); syncImgCtx(); toast('Photo filters reset'); }
function syncImgCtx(){
  const o = active(); const ic = document.getElementById('imgCtx'); if (!ic) return;
  const isImg = !!o && o.type === 'image';
  ic.style.display = isImg ? '' : 'none';
  if (isImg){
    const f = o.__f || { b:0, c:0, s:0, bw:false, sepia:false };
    document.getElementById('fBright').value = f.b;
    document.getElementById('fContrast').value = f.c;
    document.getElementById('fSat').value = f.s;
    document.getElementById('btnBW').style.background = f.bw ? '#efe9ff' : '';
    document.getElementById('btnSepia').style.background = f.sepia ? '#efe9ff' : '';
  }
}
/* ---- Draw (freehand) ---- */
let drawing = false;
function toggleDraw(){
  if (!canvas) return;
  drawing = !drawing;
  canvas.isDrawingMode = drawing;
  const btn = document.getElementById('drawBtn');
  if (drawing){
    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
    drawOpt();
    canvas.discardActiveObject(); canvas.renderAll();
  }
  btn.textContent = drawing ? '✅ Drawing ON — band karne ke liye dabayein' : '✏️ Start drawing';
  btn.style.background = drawing ? '#efe9ff' : '';
  toast(drawing ? '✏️ Draw mode ON — canvas par draw karein' : 'Draw mode OFF');
}
function drawOpt(){
  if (canvas && canvas.freeDrawingBrush){
    canvas.freeDrawingBrush.color = document.getElementById('drawColor').value;
    canvas.freeDrawingBrush.width = parseInt(document.getElementById('drawWidth').value) || 8;
  }
}
/* ---- Background patterns ---- */
function setBgPattern(kind){
  const pc = document.createElement('canvas'); pc.width = pc.height = 28;
  const g = pc.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0,0,28,28);
  g.fillStyle = '#ddd3f5'; g.strokeStyle = '#ddd3f5';
  if (kind==='dots'){ g.beginPath(); g.arc(7,7,3.2,0,7); g.arc(21,21,3.2,0,7); g.fill(); }
  if (kind==='grid'){ g.lineWidth = 2; g.strokeRect(0,0,28,28); }
  if (kind==='lines'){ g.lineWidth = 3; g.beginPath(); g.moveTo(-2,30); g.lineTo(30,-2); g.stroke(); }
  removeBgRect(); canvas.setBackgroundColor('#ffffff', () => {});
  const rect = new fabric.Rect({ left:0, top:0, width: currentSize.w, height: currentSize.h, selectable:false, evented:false, name:'__bg' });
  rect.set('fill', new fabric.Pattern({ source: pc, repeat: 'repeat' }));
  canvas.add(rect); rect.sendToBack(); canvas.renderAll(); pushHistory(); markUnsaved();
  toast('🎨 Pattern background lag gaya');
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
  const prevBtn = document.querySelector('.rail-btn.active');
  const prevTab = prevBtn ? prevBtn.dataset.tab : null;
  const panel = document.querySelector('.sidepanel');
  const wasOpen = panel ? panel.classList.contains('open') : false;
  document.querySelectorAll('.rail-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
  document.querySelectorAll('.tabpage').forEach(p => p.style.display = 'none');
  document.getElementById('tab-' + t).style.display = '';
  if (t === 'layers') renderLayers();
  /* Mobile: panel is a slide-over drawer — tap a tool to open, tap it again to close */
  if (window.innerWidth <= 900 && panel){
    if (wasOpen && prevTab === t) panel.classList.remove('open');
    else panel.classList.add('open');
    setTimeout(fitZoom, 240);
  }
}
function buildSidebars(){
  const shapes = [['rect','▭'],['round','▢'],['circle','●'],['triangle','▲'],['star','★'],['heart','❤'],['ring','◎'],['blob','⬤'],['diamond','◆'],['hex','⬢'],['plus','➕']];
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
  const pats = [['dots','⚫ Dots'],['grid','▦ Grid'],['lines','≋ Lines']];
  document.getElementById('bgPatterns').innerHTML = pats.map(([k,l]) => `<div class="swatch pat-swatch" title="${l}" onclick="setBgPattern('${k}')">${l}</div>`).join('');
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
/* Phone photos are huge — shrink them before storing, otherwise the browser
   storage (localStorage) silently rejects them and uploads "don't open". */
function processImageFile(file, cb){
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const max = 1280, sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    if (sc >= 1 && file.size < 900000){ URL.revokeObjectURL(url); const r = new FileReader(); r.onload = () => cb(r.result); r.readAsDataURL(file); return; }
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * sc); c.height = Math.round(img.naturalHeight * sc);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    cb(c.toDataURL('image/jpeg', .85));
  };
  img.onerror = () => { URL.revokeObjectURL(url); const r = new FileReader(); r.onload = () => cb(r.result); r.readAsDataURL(file); };
  img.src = url;
}
function storeUploads(){
  try { localStorage.setItem('kv_uploads', JSON.stringify(uploads)); return true; }
  catch(e){ uploads.pop(); try { localStorage.setItem('kv_uploads', JSON.stringify(uploads)); } catch(e2){} toast('⚠️ Storage full — purani uploads/designs delete karein'); return false; }
}
function handleUpload(ev){
  const files = [...ev.target.files];
  let done = 0;
  files.forEach(f => processImageFile(f, dataUrl => {
    uploads.unshift(dataUrl); if (uploads.length > 24) uploads.pop();
    storeUploads(); renderUploads();
    if (++done === files.length) toast('📤 Upload ho gaya — photo par tap karke design mein add karein');
  }));
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

/* ================= TEMPLATES (30) — original Kanva designs ================= */
function T(t, o){ return new fabric.Textbox(t, Object.assign({ textAlign:'center', name:'Text' }, o)); }
function gradRect(a, b){
  const r = new fabric.Rect({ left:0, top:0, width:currentSize.w, height:currentSize.h, selectable:false, evented:false, name:'__bg' });
  r.set('fill', new fabric.Gradient({ type:'linear', gradientUnits:'pixels', coords:{ x1:0, y1:0, x2:currentSize.w, y2:currentSize.h }, colorStops:[{offset:0,color:a},{offset:1,color:b}] }));
  canvas.add(r); return r;
}
function solidBg(c){ canvas.setBackgroundColor(c, () => canvas.renderAll()); }
function addAt(o, xPct, yPct){ o.set({ left: currentSize.w*xPct - (o.width*(o.scaleX||1))/2, top: currentSize.h*yPct }); canvas.add(o); return o; }
const PH = seed => 'https://picsum.photos/seed/kanva-' + seed + '/1000/1000';
function addPhoto(url, xP, yP, wP, hP, r){
  const cv = canvas;
  const W = currentSize.w, H = currentSize.h;
  const x = W*xP, y = H*yP, w = W*wP, h = H*hP, rad = (r || 0) * W;
  const ph = new fabric.Rect({ left:x, top:y, width:w, height:h, fill:'#c9ced6', rx:rad, ry:rad, name:'Photo' });
  cv.add(ph);
  return new Promise(res => {
    try {
      fabric.Image.fromURL(url, img => {
        if (!img){ res(); return; }
        const s = Math.max(w / img.width, h / img.height);
        img.set({ left:x, top:y, scaleX:s, scaleY:s, name:'Photo',
          clipPath: new fabric.Rect({ left:x, top:y, width:w, height:h, rx:rad, ry:rad, absolutePositioned:true }) });
        cv.add(img); cv.remove(ph); cv.renderAll(); res();
      }, { crossOrigin:'anonymous' });
    } catch(e){ res(); }
  });
}
function shade(xP, yP, wP, hP, color, op){
  const r = new fabric.Rect({ left: currentSize.w*xP, top: currentSize.h*yP, width: currentSize.w*wP, height: currentSize.h*hP, fill: color, opacity: op, selectable:false, name:'Shade' });
  canvas.add(r); return r;
}
function deco(xP, yP, rP, color, op){
  const c = new fabric.Circle({ radius: currentSize.w*rP, left: currentSize.w*xP, top: currentSize.h*yP, fill: color, opacity: op, selectable:false, evented:false, name:'Deco' });
  canvas.add(c); return c;
}
function badge(text, xP, yP, dP, bg, fg){
  const W = currentSize.w, H = currentSize.h, d = W * dP;
  const c = new fabric.Circle({ radius: d/2, left: W*xP - d/2, top: H*yP, fill: bg, name:'Badge', shadow: new fabric.Shadow({ color:'rgba(0,0,0,.25)', blur:8, offsetY:3 }) });
  canvas.add(c);
  const fs = d * (text.length > 5 ? .155 : .2);
  const t = T(text, { fontFamily:'Poppins', fontWeight:800, fill: fg, fontSize: fs, width: d * .94 });
  t.set({ left: W*xP - t.width/2, top: H*yP + d/2 - fs * .58 });
  canvas.add(t); return c;
}
function pill(text, xP, yP, wP, bg, fg, fsP){
  const W = currentSize.w, H = currentSize.h, w = W * wP, fs = W * (fsP || .036), h = fs * 2.15;
  const r = new fabric.Rect({ width: w, height: h, fill: bg, rx: h/2, ry: h/2, name:'Pill' });
  r.set({ left: W*xP - w/2, top: H*yP }); canvas.add(r);
  const t = T(text, { fontFamily:'Poppins', fontWeight:700, fill: fg, fontSize: fs, width: w * .96 });
  t.set({ left: W*xP - t.width/2, top: H*yP + (h - fs * 1.18) / 2 });
  canvas.add(t); return r;
}
function hline(xP, yP, wP, color, weight){
  const r = new fabric.Rect({ left: currentSize.w*xP - currentSize.w*wP/2, top: currentSize.h*yP, width: currentSize.w*wP, height: weight || 3, fill: color, name:'Line' });
  canvas.add(r); return r;
}
function starShape(cxP, cyP, rP, color){
  const W = currentSize.w, H = currentSize.h, R = W*rP, r = R * .45, pts = [];
  for (let i = 0; i < 10; i++){ const ang = -Math.PI/2 + i * Math.PI/5, rad = i % 2 === 0 ? R : r; pts.push({ x: rad * Math.cos(ang), y: rad * Math.sin(ang) }); }
  const s = new fabric.Polygon(pts, { fill: color, name:'Star', left: W*cxP, top: H*cyP, originX:'center', originY:'center' }); canvas.add(s); return s;
}

const TEMPLATES = [
  { id:'sale',     title:'Mega Sale',         sub:'50% OFF',             cat:'Marketing',    pro:false, size:'ig-post',  bg:['#ef4444','#f97316'] },
  { id:'quote',    title:'Daily Quote',       sub:'Motivation post',     cat:'Social Media', pro:false, size:'ig-post',  bg:['#fef3c7','#f59e0b'] },
  { id:'business', title:'Grow Business',     sub:'Promo post',          cat:'Marketing',    pro:false, size:'ig-post',  bg:['#0f172a','#155e75'] },
  { id:'food',     title:'Tasty Burger',      sub:'Food offer',          cat:'Marketing',    pro:false, size:'ig-post',  bg:['#f59e0b','#ef4444'] },
  { id:'estate',   title:'House For Sale',    sub:'Real estate',         cat:'Marketing',    pro:false, size:'fb-post',  bg:['#1d4ed8','#06b6d4'] },
  { id:'edu',      title:'Admissions Open',   sub:'School / institute',  cat:'Education',    pro:false, size:'ig-post',  bg:['#8b3dff','#4f46e5'] },
  { id:'motivate', title:'Think Big',         sub:'Success quote',       cat:'Social Media', pro:false, size:'ig-post',  bg:['#111827','#000000'] },
  { id:'story',    title:'Flash Sale Story',  sub:'Story format',        cat:'Social Media', pro:false, size:'ig-story', bg:['#db2777','#7c3aed'] },
  { id:'course',   title:'Online Course',     sub:'Course promo',        cat:'Education',    pro:false, size:'ig-post',  bg:['#0ea5e9','#22c55e'] },
  { id:'menu',     title:'Restaurant Menu',   sub:'Menu header',         cat:'Marketing',    pro:false, size:'poster',   bg:['#292524','#78350f'] },
  { id:'job',      title:'Job Vacancy',       sub:'We are hiring',       cat:'Marketing',    pro:false, size:'fb-post',  bg:['#1e3a8a','#0ea5e9'] },
  { id:'ramadan',  title:'Ramadan Kareem',    sub:'Blessed month',       cat:'Events',       pro:false, size:'ig-post',  bg:['#1e1b4b','#7c3aed'] },
  { id:'mobile',   title:'Mobile Shop Sale',  sub:'Latest smartphones',  cat:'Marketing',    pro:false, size:'ig-post',  bg:['#0f172a','#6d28d9'] },
  { id:'webinar',  title:'Live Webinar',      sub:'Free online session', cat:'Education',    pro:false, size:'pres',     bg:['#7c2d12','#ea580c'] },
  { id:'bakery',   title:'Fresh Bakery',      sub:'Baked fresh daily',   cat:'Marketing',    pro:false, size:'ig-post',  bg:['#fff7ed','#fdba74'] },
  { id:'birthday', title:'Happy Birthday',    sub:'Birthday wish',       cat:'Events',       pro:true,  size:'ig-post',  bg:['#8b3dff','#ec4899'] },
  { id:'yt',       title:'YouTube Thumbnail', sub:'Make money online',   cat:'Video',        pro:true,  size:'yt-thumb', bg:['#111827','#374151'] },
  { id:'eid',      title:'Eid Mubarak',       sub:'Greeting card',       cat:'Events',       pro:true,  size:'ig-post',  bg:['#065f46','#10b981'] },
  { id:'fashion',  title:'New Collection',    sub:'Fashion sale',        cat:'Social Media', pro:true,  size:'ig-post',  bg:['#e7d8c9','#c9a887'] },
  { id:'wedding',  title:'Wedding Invite',    sub:'Ayesha & Ahmed',      cat:'Events',       pro:true,  size:'poster',   bg:['#fdf6ec','#e8c39e'] },
  { id:'gym',      title:'Fitness Gym',       sub:'No pain no gain',     cat:'Marketing',    pro:true,  size:'ig-post',  bg:['#18181b','#dc2626'] },
  { id:'travel',   title:'Travel Pakistan',   sub:'Hunza valley trip',   cat:'Social Media', pro:true,  size:'ig-post',  bg:['#0369a1','#2dd4bf'] },
  { id:'music',    title:'Music Night Live',  sub:'Concert poster',      cat:'Events',       pro:true,  size:'poster',   bg:['#1e1b4b','#db2777'] },
  { id:'baby',     title:'Baby Shower',       sub:'Welcome baby',        cat:'Events',       pro:true,  size:'ig-post',  bg:['#fbcfe8','#93c5fd'] },
  { id:'vlog',     title:'My Daily Vlog',     sub:'Vlog thumbnail',      cat:'Video',        pro:true,  size:'yt-thumb', bg:['#f97316','#db2777'] },
  { id:'cricket',  title:'Cricket Match Day', sub:'Match announcement',  cat:'Events',       pro:true,  size:'ig-post',  bg:['#14532d','#22c55e'] },
  { id:'salon',    title:'Beauty Salon',      sub:'Salon offer',         cat:'Marketing',    pro:true,  size:'ig-post',  bg:['#fdf2f8','#f9a8d4'] },
  { id:'car',      title:'Car For Sale',      sub:'Used car deal',       cat:'Marketing',    pro:true,  size:'fb-post',  bg:['#111827','#b45309'] },
  { id:'result',   title:'Result Day',        sub:'Topper announcement', cat:'Education',    pro:true,  size:'ig-post',  bg:['#fefce8','#eab308'] },
  { id:'podcast',  title:'Podcast Cover',     sub:'New episode',         cat:'Video',        pro:true,  size:'ig-post',  bg:['#18181b','#7c3aed'] },
];
const BUILDERS = {
  sale(){ gradRect('#ef4444','#f97316'); const W = currentSize.w;
    deco(.06, .04, .16, '#ffffff', .12); deco(.97, .8, .2, '#7f1d1d', .18); deco(.9, .06, .07, '#fde047', .5);
    addAt(T('MEGA SALE', { fontFamily:'Bebas Neue', fontSize:W*.155, fill:'#fff', fontWeight:700, width:W*.92 }), .5, .1);
    badge('50%\nOFF', .82, .3, .3, '#facc15', '#7f1d1d');
    addAt(T('On Everything — Limited Time Offer!', { fontFamily:'Inter', fontSize:W*.033, fill:'#fff', width:W*.8 }), .34, .44);
    hline(.34, .55, .3, '#fde047', 5);
    addAt(T('Fashion · Electronics · Home & More', { fontFamily:'Poppins', fontSize:W*.028, fill:'#ffedd5', width:W*.8 }), .34, .6);
    pill('SHOP NOW', .5, .76, .44, '#0d1216', '#fff', .04);
    addAt(T('www.yourshop.com', { fontFamily:'Montserrat', fontSize:W*.024, fill:'#ffe4e6', width:W*.7 }), .5, .9); },
  quote(){ solidBg('#fef9ec'); const W = currentSize.w;
    deco(.92, .02, .13, '#f59e0b', .16); deco(.02, .86, .1, '#f59e0b', .12);
    addAt(T('“', { fontFamily:'Playfair Display', fontSize:W*.3, fill:'#f59e0b', width:W*.4 }), .5, .04);
    addAt(T('Stay positive,\nwork hard,\nmake it happen.', { fontFamily:'Playfair Display', fontSize:W*.078, fill:'#1c1917', fontWeight:700, width:W*.84, lineHeight:1.2 }), .5, .34);
    hline(.5, .72, .16, '#f59e0b', 4);
    addAt(T('— DAILY MOTIVATION', { fontFamily:'Montserrat', fontSize:W*.026, fill:'#92400e', width:W*.7, charSpacing: 120 }), .5, .78); },
  business(){ const W = currentSize.w;
    const p = addPhoto(PH('concert'), 0, 0, 1, 1, 0);
    shade(0, 0, 1, 1, '#0f172a', .78);
    const bar = new fabric.Rect({ width:W*.16, height:W*.014, fill:'#22d3ee', name:'Accent' }); addAt(bar, .5, .14);
    addAt(T('GROW YOUR\nBUSINESS', { fontFamily:'Montserrat', fontSize:W*.105, fill:'#fff', fontWeight:900, width:W*.88, lineHeight:1.1 }), .5, .22);
    addAt(T('Professional services that bring you more customers, more sales, more growth.', { fontFamily:'Inter', fontSize:W*.031, fill:'#cffafe', width:W*.8, lineHeight:1.4 }), .5, .52);
    pill('GET A FREE QUOTE', .5, .68, .52, '#0891b2', '#fff', .032);
    addAt(T('Call 0300-1234567  ·  yourwebsite.com', { fontFamily:'Poppins', fontSize:W*.03, fill:'#fff', fontWeight:600, width:W*.86 }), .5, .84);
    return p; },
  food(){ gradRect('#f59e0b','#dc2626'); const W = currentSize.w;
    deco(.04, .06, .12, '#ffffff', .14); deco(.95, .12, .08, '#fde047', .55);
    pill('NEW ARRIVAL', .5, .07, .4, '#7f1d1d', '#fde68a', .03);
    addAt(T('TASTY\nBURGER', { fontFamily:'Anton', fontSize:W*.17, fill:'#fff', width:W*.94, lineHeight:1.05 }), .5, .17);
    addAt(T('Juicy · Fresh · Delicious', { fontFamily:'Pacifico', fontSize:W*.048, fill:'#fef3c7', width:W*.86 }), .5, .5);
    badge('Rs 499\nONLY', .8, .58, .28, '#fef08a', '#7f1d1d');
    addAt(T('Free home delivery within city', { fontFamily:'Inter', fontSize:W*.03, fill:'#fff7ed', width:W*.62 }), .36, .64);
    pill('ORDER NOW — 0300-1234567', .5, .82, .66, '#0d1216', '#fff', .032); },
  estate(){ const W = currentSize.w;
    const p = addPhoto(PH('hunza'), 0, 0, .52, 1, 0);
    shade(.52, 0, .48, 1, '#1e3a8a', 1);
    addAt(T('HOUSE\nFOR SALE', { fontFamily:'Montserrat', fontSize:W*.075, fill:'#fff', fontWeight:900, width:W*.42, lineHeight:1.12 }), .76, .1);
    hline(.76, .3, .2, '#facc15', 5);
    addAt(T('3 Bed · 2 Bath\nPrime Location\nReady to Move', { fontFamily:'Inter', fontSize:W*.026, fill:'#dbeafe', width:W*.4, lineHeight:1.5 }), .76, .38);
    badge('Rs 85\nLAC', .76, .58, .2, '#facc15', '#1e3a8a');
    addAt(T('Call: 0300-1234567', { fontFamily:'Poppins', fontSize:W*.026, fill:'#fff', fontWeight:700, width:W*.42 }), .76, .82);
    return p; },
  edu(){ solidBg('#ffffff'); const W = currentSize.w, H = currentSize.h;
    const band = new fabric.Rect({ left:0, top:0, width:W, height:H*.3, fill:'#8b3dff', selectable:false, name:'Header Band' }); canvas.add(band);
    deco(.9, -.04, .12, '#ffffff', .15);
    addAt(T('ADMISSIONS OPEN', { fontFamily:'Poppins', fontSize:W*.078, fill:'#fff', fontWeight:800, width:W*.94 }), .5, .08);
    addAt(T('Session 2026 – 27 · Playgroup to Matric', { fontFamily:'Montserrat', fontSize:W*.03, fill:'#ede9fe', width:W*.9 }), .5, .2);
    addAt(T('Why choose us?', { fontFamily:'Poppins', fontSize:W*.042, fill:'#4c1d95', fontWeight:700, width:W*.85 }), .5, .38);
    addAt(T('Experienced teachers\nModern computer & science labs\nAffordable monthly fees', { fontFamily:'Inter', fontSize:W*.033, fill:'#334155', width:W*.8, lineHeight:1.5 }), .5, .48);
    pill('ENROLL NOW — 0300-1234567', .5, .76, .68, '#8b3dff', '#fff', .034);
    addAt(T('Limited seats available', { fontFamily:'Inter', fontSize:W*.026, fill:'#64748b', width:W*.7 }), .5, .88); },
  motivate(){ solidBg('#0a0a0a'); const W = currentSize.w;
    deco(.5, .3, .34, '#facc15', .07);
    addAt(T('THINK', { fontFamily:'Anton', fontSize:W*.21, fill:'#fff', width:W*.92 }), .5, .16);
    addAt(T('BIG.', { fontFamily:'Anton', fontSize:W*.21, fill:'#facc15', width:W*.92 }), .5, .39);
    hline(.5, .64, .14, '#facc15', 5);
    addAt(T('Your only limit is your mindset.', { fontFamily:'Inter', fontSize:W*.033, fill:'#d4d4d8', width:W*.82 }), .5, .7);
    addAt(T('@yourpage', { fontFamily:'Montserrat', fontSize:W*.024, fill:'#71717a', width:W*.6 }), .5, .82); },
  story(){ const W = currentSize.w, H = currentSize.h;
    const p = addPhoto(PH('mic'), 0, 0, 1, 1, 0);
    shade(0, .52, 1, .48, '#7c3aed', .88);
    shade(0, 0, 1, .3, '#db2777', .55);
    addAt(T('FLASH', { fontFamily:'Anton', fontSize:W*.19, fill:'#fff', width:W*.94 }), .5, .12);
    addAt(T('SALE', { fontFamily:'Anton', fontSize:W*.19, fill:'#fde047', width:W*.94 }), .5, .24);
    badge('70%\nOFF', .5, .42, .3, '#fde047', '#831843');
    addAt(T('Today only — order before midnight!', { fontFamily:'Poppins', fontSize:W*.04, fill:'#fff', fontWeight:600, width:W*.86 }), .5, .66);
    pill('SHOP NOW ↓', .5, .76, .5, '#ffffff', '#9d174d', .038);
    return p; },
  course(){ gradRect('#0369a1','#22c55e'); const W = currentSize.w;
    deco(.95, .05, .15, '#ffffff', .13); deco(.03, .85, .1, '#fef08a', .3);
    pill('ONLINE COURSE', .5, .08, .44, '#fef08a', '#14532d', .03);
    addAt(T('LEARN WEB\nDEVELOPMENT', { fontFamily:'Montserrat', fontSize:W*.098, fill:'#fff', fontWeight:900, width:W*.92, lineHeight:1.12 }), .5, .2);
    addAt(T('Complete course — beginner to pro, with certificate and lifetime access.', { fontFamily:'Inter', fontSize:W*.031, fill:'#ecfeff', width:W*.82, lineHeight:1.4 }), .5, .47);
    hline(.5, .63, .2, '#fef08a', 4);
    addAt(T('40+ lessons · Urdu language · Certificate', { fontFamily:'Poppins', fontSize:W*.028, fill:'#f0fdf4', width:W*.86 }), .5, .68);
    pill('ENROLL TODAY — Rs 2,999 ONLY', .5, .78, .7, '#0d1216', '#fff', .032); },
  menu(){ solidBg('#1c1917'); const W = currentSize.w;
    const fr = new fabric.Rect({ left:W*.045, top:currentSize.h*.045, width:W*.91, height:currentSize.h*.91, fill:'transparent', stroke:'#b45309', strokeWidth:2, name:'Frame' }); canvas.add(fr);
    addAt(T('— THE FOOD HOUSE —', { fontFamily:'Montserrat', fontSize:W*.026, fill:'#d6d3d1', width:W*.8, charSpacing: 150 }), .5, .1);
    addAt(T('Our Menu', { fontFamily:'Playfair Display', fontSize:W*.12, fill:'#fbbf24', fontWeight:700, width:W*.9 }), .5, .17);
    hline(.5, .32, .12, '#b45309', 3);
    addAt(T('STARTERS', { fontFamily:'Montserrat', fontSize:W*.03, fill:'#fbbf24', fontWeight:700, width:W*.7 }), .5, .38);
    addAt(T('Soup of the Day ····· Rs 350\nGarlic Bread ····· Rs 250', { fontFamily:'Inter', fontSize:W*.027, fill:'#e7e5e4', width:W*.74, lineHeight:1.5 }), .5, .43);
    addAt(T('MAIN COURSE', { fontFamily:'Montserrat', fontSize:W*.03, fill:'#fbbf24', fontWeight:700, width:W*.7 }), .5, .56);
    addAt(T('Chicken Karahi ····· Rs 1,450\nBBQ Platter ····· Rs 1,850\nBiryani Special ····· Rs 450', { fontFamily:'Inter', fontSize:W*.027, fill:'#e7e5e4', width:W*.74, lineHeight:1.5 }), .5, .61);
    addAt(T('Open daily 12 PM – 12 AM · 0300-1234567', { fontFamily:'Poppins', fontSize:W*.024, fill:'#a8a29e', width:W*.8 }), .5, .85); },
  job(){ gradRect('#1e3a8a','#0284c7'); const W = currentSize.w;
    pill('WE ARE HIRING', .5, .12, .46, '#facc15', '#1e3a8a', .034);
    addAt(T('SALES EXECUTIVE', { fontFamily:'Montserrat', fontSize:W*.052, fill:'#fff', fontWeight:900, width:W*.9 }), .5, .3);
    addAt(T('2 Positions · Full Time · Umerkot', { fontFamily:'Inter', fontSize:W*.024, fill:'#bae6fd', width:W*.85 }), .5, .44);
    hline(.5, .55, .2, '#facc15', 4);
    addAt(T('Good salary + commission\nExperience preferred, fresh can also apply', { fontFamily:'Inter', fontSize:W*.024, fill:'#e0f2fe', width:W*.85, lineHeight:1.45 }), .5, .62);
    pill('APPLY: 0300-1234567', .5, .8, .56, '#ffffff', '#1e3a8a', .03); },
  ramadan(){ const W = currentSize.w;
    const p = addPhoto(PH('mountain'), 0, 0, 1, 1, 0);
    shade(0, 0, 1, 1, '#1e1b4b', .45);
    addAt(T('Ramadan', { fontFamily:'Playfair Display', fontSize:W*.13, fill:'#fff', fontWeight:700, width:W*.94 }), .5, .3);
    addAt(T('KAREEM', { fontFamily:'Montserrat', fontSize:W*.075, fill:'#fde68a', fontWeight:800, width:W*.9, charSpacing: 300 }), .5, .46);
    hline(.5, .58, .18, '#fde68a', 3);
    addAt(T('May this blessed month bring peace,\nmercy and blessings to your home.', { fontFamily:'Inter', fontSize:W*.03, fill:'#e0e7ff', width:W*.84, lineHeight:1.45 }), .5, .64);
    return p; },
  mobile(){ solidBg('#0f172a'); const W = currentSize.w, H = currentSize.h;
    deco(.92, .02, .16, '#7c3aed', .35); deco(.02, .88, .12, '#2563eb', .3);
    const phone = new fabric.Rect({ left: W*.6, top: H*.12, width: W*.27, height: H*.62, fill:'#1e293b', stroke:'#7c3aed', strokeWidth:3, rx: W*.03, ry: W*.03, name:'Phone' }); canvas.add(phone);
    const scr = new fabric.Rect({ left: W*.635, top: H*.17, width: W*.2, height: H*.44, fill:'#312e81', name:'Screen' }); canvas.add(scr);
    addAt(T('LATEST\nSMARTPHONES', { fontFamily:'Montserrat', fontSize:W*.082, fill:'#fff', fontWeight:900, width:W*.52, lineHeight:1.15 }), .3, .14);
    addAt(T('All brands available\nEasy installments · Official warranty', { fontFamily:'Inter', fontSize:W*.028, fill:'#cbd5e1', width:W*.5, lineHeight:1.45 }), .3, .42);
    badge('UP TO\n30% OFF', .3, .58, .3, '#facc15', '#1e1b4b');
    pill('VISIT OUR SHOP TODAY', .5, .84, .6, '#7c3aed', '#fff', .032); },
  webinar(){ gradRect('#7c2d12','#ea580c'); const W = currentSize.w;
    pill('● LIVE WEBINAR', .24, .1, .34, '#dc2626', '#fff', .03);
    addAt(T('DIGITAL MARKETING\nMASTERCLASS', { fontFamily:'Montserrat', fontSize:W*.062, fill:'#fff', fontWeight:900, width:W*.9, lineHeight:1.15 }), .5, .2);
    addAt(T('Learn how to grow any business online — Facebook ads, WhatsApp selling and more.', { fontFamily:'Inter', fontSize:W*.026, fill:'#ffedd5', width:W*.84, lineHeight:1.45 }), .5, .42);
    pill('SUNDAY · 8 PM · FREE ENTRY', .5, .58, .5, '#fff', '#9a3412', .03);
    addAt(T('Register on WhatsApp: 0300-1234567', { fontFamily:'Poppins', fontSize:W*.026, fill:'#fff', fontWeight:600, width:W*.85 }), .5, .72); },
  bakery(){ solidBg('#fff7ed'); const W = currentSize.w;
    const p = addPhoto(PH('wedding'), .06, .07, .42, .5, .04);
    addAt(T('FRESH\nBAKERY', { fontFamily:'Playfair Display', fontSize:W*.085, fill:'#7c2d12', fontWeight:800, width:W*.44, lineHeight:1.12 }), .74, .1);
    addAt(T('Baked fresh every morning — cakes, pastries & more', { fontFamily:'Inter', fontSize:W*.027, fill:'#9a3412', width:W*.42, lineHeight:1.45 }), .74, .3);
    badge('100%\nFRESH', .74, .48, .2, '#ea580c', '#fff');
    hline(.5, .68, .3, '#fdba74', 4);
    addAt(T('Order your custom cake: 0300-1234567', { fontFamily:'Poppins', fontSize:W*.03, fill:'#7c2d12', fontWeight:600, width:W*.86 }), .5, .74);
    addAt(T('Main Bazaar Road · Open 8 AM – 10 PM', { fontFamily:'Inter', fontSize:W*.025, fill:'#b45309', width:W*.8 }), .5, .82);
    return p; },
  birthday(){ gradRect('#8b3dff','#ec4899'); const W = currentSize.w;
    deco(.08, .06, .05, '#fde047', .8); deco(.9, .1, .04, '#fff', .7); deco(.14, .8, .04, '#fff', .5); deco(.88, .82, .055, '#fde047', .65); deco(.5, .03, .03, '#fff', .6);
    addAt(T('Happy Birthday', { fontFamily:'Pacifico', fontSize:W*.115, fill:'#fff', width:W*.94 }), .5, .22);
    addAt(T('TO YOU!', { fontFamily:'Anton', fontSize:W*.1, fill:'#fde68a', width:W*.92 }), .5, .42);
    hline(.5, .58, .16, '#fff', 3);
    addAt(T('Wishing you a day full of happiness,\ncake and wonderful surprises.', { fontFamily:'Inter', fontSize:W*.031, fill:'#fce7f3', width:W*.84, lineHeight:1.4 }), .5, .64);
    pill('WITH LOVE — FROM ALL OF US', .5, .8, .6, '#ffffff', '#a21caf', .028); },
  yt(){ gradRect('#111827','#374151'); const W = currentSize.w;
    deco(.94, .06, .12, '#ef4444', .25);
    addAt(T('HOW TO', { fontFamily:'Anton', fontSize:W*.15, fill:'#fff', width:W*.92 }), .5, .08);
    addAt(T('MAKE MONEY', { fontFamily:'Anton', fontSize:W*.15, fill:'#facc15', width:W*.92 }), .5, .28);
    addAt(T('ONLINE', { fontFamily:'Anton', fontSize:W*.13, fill:'#fff', width:W*.92 }), .5, .48);
    const play = new fabric.Circle({ radius:W*.055, fill:'#ef4444', name:'Play Button' }); addAt(play, .5, .74);
    addAt(new fabric.Text('▶', { fontSize:W*.05, fill:'#fff', name:'Play Icon' }), .512, .765);
    pill('FULL VIDEO — LINK IN DESCRIPTION', .5, .86, .56, '#facc15', '#111827', .026); },
  eid(){ gradRect('#065f46','#0d9488'); const W = currentSize.w;
    deco(.5, .06, .07, '#fde68a', .9); deco(.44, .045, .055, '#065f46', 1);
    deco(.14, .1, .02, '#fde68a', .8); deco(.84, .16, .016, '#fff', .8); deco(.76, .05, .02, '#fde68a', .6);
    addAt(T('Eid Mubarak', { fontFamily:'Playfair Display', fontSize:W*.125, fill:'#fff', fontWeight:700, width:W*.94 }), .5, .3);
    hline(.5, .5, .18, '#fde68a', 3);
    addAt(T('May your life be filled with\npeace, joy and blessings.', { fontFamily:'Inter', fontSize:W*.033, fill:'#d1fae5', width:W*.84, lineHeight:1.45 }), .5, .56);
    addAt(T('— From our family to yours', { fontFamily:'Dancing Script', fontSize:W*.052, fill:'#fde68a', width:W*.86 }), .5, .76); },
  fashion(){ const W = currentSize.w;
    const p = addPhoto(PH('fashion'), 0, 0, 1, .62, 0);
    shade(0, .62, 1, .38, '#faf6ef', 1);
    addAt(T('NEW COLLECTION', { fontFamily:'Playfair Display', fontSize:W*.082, fill:'#3f2f1d', fontWeight:700, width:W*.94 }), .5, .66);
    addAt(T('Fashion Sale 2026 — Up to 40% Off', { fontFamily:'Montserrat', fontSize:W*.029, fill:'#7c5c36', width:W*.86 }), .5, .79);
    pill('SHOP THE LOOK', .5, .86, .44, '#3f2f1d', '#f5efe4', .028);
    return p; },
  wedding(){ solidBg('#fdf8ef'); const W = currentSize.w, H = currentSize.h;
    const fr = new fabric.Rect({ left:W*.055, top:H*.055, width:W*.89, height:H*.89, fill:'transparent', stroke:'#c9a227', strokeWidth:3, name:'Gold Frame' }); canvas.add(fr);
    const fr2 = new fabric.Rect({ left:W*.075, top:H*.075, width:W*.85, height:H*.85, fill:'transparent', stroke:'#c9a227', strokeWidth:1, name:'Gold Frame' }); canvas.add(fr2);
    deco(.5, .13, .018, '#c9a227', .9);
    addAt(T('THE WEDDING OF', { fontFamily:'Montserrat', fontSize:W*.026, fill:'#92710c', width:W*.7, charSpacing: 260 }), .5, .17);
    addAt(T('Ayesha & Ahmed', { fontFamily:'Dancing Script', fontSize:W*.115, fill:'#7c5a10', width:W*.92 }), .5, .26);
    hline(.5, .47, .14, '#c9a227', 2);
    addAt(T('Saturday, 20 December 2026\nVenue: Royal Palm Hall · 7 PM onwards', { fontFamily:'Playfair Display', fontSize:W*.032, fill:'#57534e', width:W*.82, lineHeight:1.45 }), .5, .52);
    addAt(T('Reception to follow · Your presence is our gift', { fontFamily:'Inter', fontSize:W*.025, fill:'#78716c', width:W*.8 }), .5, .7);
    deco(.5, .8, .018, '#c9a227', .9); },
  gym(){ gradRect('#18181b','#450a0a'); const W = currentSize.w;
    deco(.5, .32, .36, '#dc2626', .12);
    pill('FITNESS GYM', .5, .08, .4, '#dc2626', '#fff', .032);
    addAt(T('NO PAIN', { fontFamily:'Anton', fontSize:W*.165, fill:'#fff', width:W*.94 }), .5, .2);
    addAt(T('NO GAIN', { fontFamily:'Anton', fontSize:W*.165, fill:'#ef4444', width:W*.94 }), .5, .38);
    addAt(T('Train hard. Stay strong. Become unstoppable.', { fontFamily:'Inter', fontSize:W*.03, fill:'#d4d4d8', width:W*.84 }), .5, .58);
    badge('1st MONTH\nRs 1,500', .5, .66, .3, '#facc15', '#18181b');
    addAt(T('Join today — 0300-1234567', { fontFamily:'Poppins', fontSize:W*.028, fill:'#e4e4e7', fontWeight:600, width:W*.8 }), .5, .88); },
  travel(){ const W = currentSize.w;
    const p = addPhoto(PH('laptop'), 0, 0, 1, 1, 0);
    shade(0, .55, 1, .45, '#082f49', .82);
    pill('TRAVEL PAKISTAN', .5, .07, .46, '#facc15', '#082f49', .03);
    addAt(T('EXPLORE\nHUNZA VALLEY', { fontFamily:'Montserrat', fontSize:W*.105, fill:'#fff', fontWeight:900, width:W*.92, lineHeight:1.12 }), .5, .58);
    addAt(T('3-day guided trip · Hotel · Transport · Food — from Rs 24,999', { fontFamily:'Inter', fontSize:W*.029, fill:'#e0f2fe', width:W*.88 }), .5, .8);
    return p; },
  music(){ const W = currentSize.w;
    const p = addPhoto(PH('coffee'), 0, 0, 1, .58, 0);
    shade(0, .58, 1, .42, '#1e1b4b', 1);
    addAt(T('MUSIC NIGHT', { fontFamily:'Bebas Neue', fontSize:W*.115, fill:'#fff', width:W*.94 }), .5, .62);
    addAt(T('LIVE IN CONCERT', { fontFamily:'Montserrat', fontSize:W*.036, fill:'#f9a8d4', fontWeight:700, width:W*.86, charSpacing: 200 }), .5, .74);
    addAt(T('Saturday · 9 PM · City Arena — Tickets at the door', { fontFamily:'Inter', fontSize:W*.026, fill:'#e0e7ff', width:W*.86 }), .5, .82);
    return p; },
  baby(){ solidBg('#fdf2f8'); const W = currentSize.w;
    deco(.1, .08, .07, '#f9a8d4', .55); deco(.88, .06, .05, '#93c5fd', .6); deco(.9, .8, .07, '#f9a8d4', .45); deco(.06, .84, .045, '#fde68a', .7);
    pill("IT'S A CELEBRATION", .5, .09, .5, '#fce7f3', '#be185d', .028);
    addAt(T('Baby Shower', { fontFamily:'Pacifico', fontSize:W*.115, fill:'#db2777', width:W*.94 }), .5, .24);
    addAt(T('Welcome to the world, little one!', { fontFamily:'Poppins', fontSize:W*.036, fill:'#6d28d9', fontWeight:600, width:W*.86 }), .5, .46);
    hline(.5, .58, .14, '#f9a8d4', 3);
    addAt(T('Join us to celebrate — Sunday, 4 PM\nAt our home · Your blessings mean everything', { fontFamily:'Inter', fontSize:W*.03, fill:'#7e22ce', width:W*.84, lineHeight:1.45 }), .5, .63); },
  vlog(){ gradRect('#f97316','#be185d'); const W = currentSize.w;
    deco(.93, .08, .1, '#fff', .18); deco(.05, .8, .08, '#fde047', .4);
    addAt(T('MY DAILY', { fontFamily:'Anton', fontSize:W*.155, fill:'#fff', width:W*.92 }), .5, .1);
    addAt(T('VLOG', { fontFamily:'Anton', fontSize:W*.155, fill:'#fef08a', width:W*.92 }), .5, .3);
    addAt(T('A day in my life — watch till the end!', { fontFamily:'Poppins', fontSize:W*.034, fill:'#fff', fontWeight:600, width:W*.86 }), .5, .55);
    pill('NEW VIDEO EVERY FRIDAY', .5, .72, .54, '#0d1216', '#fff', .028); },
  cricket(){ gradRect('#14532d','#166534'); const W = currentSize.w;
    deco(.5, .3, .34, '#ffffff', .06);
    pill('MATCH DAY', .5, .08, .38, '#facc15', '#14532d', .032);
    addAt(T('PAKISTAN', { fontFamily:'Anton', fontSize:W*.15, fill:'#fff', width:W*.94 }), .5, .18);
    addAt(T('VS INDIA', { fontFamily:'Anton', fontSize:W*.13, fill:'#facc15', width:W*.94 }), .5, .36);
    addAt(T('T20 Thriller — Sunday, 7 PM', { fontFamily:'Poppins', fontSize:W*.036, fill:'#dcfce7', fontWeight:600, width:W*.86 }), .5, .55);
    hline(.5, .66, .18, '#facc15', 4);
    addAt(T('Watch live with friends · City Ground', { fontFamily:'Inter', fontSize:W*.028, fill:'#bbf7d0', width:W*.84 }), .5, .71);
    pill('BLEED GREEN', .5, .8, .42, '#ffffff', '#14532d', .03); },
  salon(){ solidBg('#fdf2f8'); const W = currentSize.w;
    deco(.9, .04, .13, '#f9a8d4', .4); deco(.04, .82, .09, '#fbcfe8', .8);
    addAt(T('BEAUTY', { fontFamily:'Playfair Display', fontSize:W*.13, fill:'#831843', fontWeight:800, width:W*.92 }), .5, .12);
    addAt(T('SALON', { fontFamily:'Montserrat', fontSize:W*.07, fill:'#db2777', fontWeight:800, width:W*.9, charSpacing: 420 }), .5, .3);
    hline(.5, .44, .14, '#db2777', 3);
    addAt(T('Facial · Haircut · Bridal Makeup\nBy expert beauticians', { fontFamily:'Inter', fontSize:W*.031, fill:'#9d174d', width:W*.84, lineHeight:1.5 }), .5, .5);
    badge('BRIDAL\n-30%', .5, .62, .28, '#db2777', '#fff');
    addAt(T('Book now: 0300-1234567', { fontFamily:'Poppins', fontSize:W*.03, fill:'#831843', fontWeight:700, width:W*.84 }), .5, .84); },
  car(){ solidBg('#111827'); const W = currentSize.w;
    deco(.95, .02, .15, '#b45309', .3);
    pill('FOR SALE', .24, .14, .34, '#f59e0b', '#111827', .032);
    addAt(T('TOYOTA COROLLA', { fontFamily:'Montserrat', fontSize:W*.058, fill:'#fff', fontWeight:900, width:W*.92 }), .5, .28);
    addAt(T('2020 Model · Automatic · Petrol', { fontFamily:'Inter', fontSize:W*.026, fill:'#fbbf24', width:W*.88 }), .5, .42);
    hline(.5, .52, .55, '#374151', 2);
    addAt(T('Total genuine condition · New tyres\nComplete file · Family used car', { fontFamily:'Inter', fontSize:W*.025, fill:'#d1d5db', width:W*.86, lineHeight:1.5 }), .5, .58);
    addAt(T('Rs 38,50,000', { fontFamily:'Poppins', fontSize:W*.05, fill:'#f59e0b', fontWeight:800, width:W*.8 }), .28, .76);
    addAt(T('0300-1234567', { fontFamily:'Poppins', fontSize:W*.032, fill:'#fff', fontWeight:700, width:W*.4 }), .76, .78); },
  result(){ solidBg('#fefce8'); const W = currentSize.w;
    starShape(.5, .14, .07, '#eab308');
    addAt(T('RESULT DAY', { fontFamily:'Montserrat', fontSize:W*.085, fill:'#713f12', fontWeight:900, width:W*.94 }), .5, .24);
    addAt(T('Congratulations to our topper!', { fontFamily:'Inter', fontSize:W*.032, fill:'#854d0e', width:W*.86 }), .5, .4);
    badge('98%\nMARKS', .5, .48, .3, '#eab308', '#713f12');
    addAt(T('Ayesha Khan — Class 10', { fontFamily:'Poppins', fontSize:W*.04, fill:'#713f12', fontWeight:700, width:W*.88 }), .5, .72);
    addAt(T('ABC School · Annual Results 2026', { fontFamily:'Inter', fontSize:W*.027, fill:'#a16207', width:W*.84 }), .5, .8); },
  podcast(){ solidBg('#18181b'); const W = currentSize.w, H = currentSize.h;
    [0.3, 0.23, 0.16].forEach((r, i) => { const ring = new fabric.Circle({ radius: W*r, left: W*.5 - W*r, top: H*.3 - W*r, fill:'transparent', stroke: i === 1 ? '#a78bfa' : '#7c3aed', strokeWidth: 3, opacity: .8 - i*.22, selectable:false, name:'Ring' }); canvas.add(ring); });
    deco(.5, .3, .085, '#7c3aed', 1);
    addAt(T('THE WEEKLY', { fontFamily:'Montserrat', fontSize:W*.05, fill:'#a78bfa', fontWeight:800, width:W*.8, charSpacing: 300 }), .5, .52);
    addAt(T('PODCAST', { fontFamily:'Anton', fontSize:W*.17, fill:'#fff', width:W*.94 }), .5, .58);
    addAt(T('New episode every Monday — tech, business & life', { fontFamily:'Inter', fontSize:W*.029, fill:'#d4d4d8', width:W*.84 }), .5, .78);
    pill('LISTEN NOW', .5, .86, .4, '#7c3aed', '#fff', .03); },
};

/* ---- Real rendered template thumbnails ---- */
const THUMB_CACHE = {};
let thumbBusy = false;
let thumbAbort = false;
function templateThumb(t){
  if (t && THUMB_CACHE[t.id]) return 'url(' + THUMB_CACHE[t.id] + ') center/cover no-repeat';
  const bg = (t && t.bg) || ['#8b3dff','#ec4899'];
  return 'linear-gradient(135deg,' + bg[0] + ',' + bg[1] + ')';
}
function swapThumbs(){
  document.querySelectorAll('[data-tpthumb]').forEach(el => {
    const u = THUMB_CACHE[el.getAttribute('data-tpthumb')];
    if (u) el.style.background = 'url(' + u + ') center/cover no-repeat';
  });
}
async function renderOneThumb(t){
  const size = SIZES.find(s => s.id === (t.size || 'ig-post')) || SIZES[0];
  const tc = new fabric.StaticCanvas(null, { width: size.w, height: size.h });
  canvas = tc; currentSize = size;
  tc.setBackgroundColor('#ffffff', () => {});
  const r = BUILDERS[t.id]();
  if (r && r.then) await Promise.race([r, new Promise(res => setTimeout(res, 4000))]);
  if (canvas !== tc){ try { tc.dispose(); } catch(e){} return; }
  tc.renderAll();
  THUMB_CACHE[t.id] = tc.toDataURL({ format:'jpeg', quality:.72, multiplier: Math.min(340 / size.w, 1) });
  try { tc.dispose(); } catch(e){}
}
async function renderAllThumbs(){
  if (thumbBusy || !window.fabric) return;
  const ed = document.getElementById('view-editor');
  if (ed && ed.style.display !== 'none') return;
  if (TEMPLATES.every(t => THUMB_CACHE[t.id])){ swapThumbs(); return; }
  thumbBusy = true; thumbAbort = false;
  const savedCanvas = canvas, savedSize = currentSize;
  for (const t of TEMPLATES){
    if (THUMB_CACHE[t.id]) continue;
    if (thumbAbort) break;
    const edNow = document.getElementById('view-editor');
    if (edNow && edNow.style.display !== 'none') break;
    try { await renderOneThumb(t); swapThumbs(); } catch(e){}
  }
  if (canvas && canvas.isStaticCanvas) canvas = savedCanvas;
  currentSize = savedSize;
  thumbBusy = false;
}
let activeCat = 'All';
const CATS = ['All','Social Media','Marketing','Events','Education','Video'];
function tplCardHTML(t, clickFn){
  return `<div class="tpl-card" style="background:${templateThumb(t)}" data-tpthumb="${t.id}" onclick="${clickFn}('${t.id}')">
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
  renderAllThumbs();
}
function setCat(c){ activeCat = c; renderTemplateGrids(); }
function renderTemplateLists(){
  const list = document.getElementById('tplList');
  if (list) list.innerHTML = TEMPLATES.map(t => `<div class="tpl-mini" style="background:${templateThumb(t)}" data-tpthumb="${t.id}" onclick="applyTemplate('${t.id}')">${t.pro ? '<span class="lock-badge">⚡ PRO</span>' : ''}<div class="tpl-title">${t.title}</div></div>`).join('');
  renderTemplateGrids();
}
async function applyTemplate(id){
  const tpl = TEMPLATES.find(t => t.id === id); if (!tpl) return;
  if (tpl.pro && !isPro()){ requirePro('This template'); return; }
  if (!canvas) openEditor(null, null);
  if (tpl.size && SIZES.find(s => s.id === tpl.size)) setSize(tpl.size);
  saving = true; canvas.clear(); canvas.setBackgroundColor('#ffffff', () => {});
  const r = BUILDERS[id]();
  if (r && r.then) await Promise.race([r, new Promise(res => setTimeout(res, 2500))]);
  saving = false; history = []; hIndex = -1; pushHistory(true);
  currentDesignId = null; document.getElementById('docTitle').value = tpl.title;
  canvas.discardActiveObject(); canvas.renderAll(); renderLayers(); markUnsaved(); fitZoom();
  toast('✅ Template loaded — click anything to edit it');
}
function openTpl(id){
  const tpl = TEMPLATES.find(t => t.id === id);
  if (tpl && tpl.pro && !isPro()){ requirePro('This template'); return; }
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
  return { json: JSON.stringify(canvas.toJSON(['selectable','evented','name','__locked','__f'])),
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
  document.getElementById('savedNote').textContent = '✓ Saved';
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
    document.getElementById('savedNote').textContent = '✓ Saved';
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
  const link = location.origin + location.pathname + '#d=' + btoa(unescape(encodeURIComponent(JSON.stringify(canvas.toJSON(['selectable','evented','name','__locked','__f'])))));
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
/* ---- File menu (asal dropdown) ---- */
function toggleFileMenu(e){
  if (e) e.stopPropagation();
  const m = document.getElementById('fileMenu'); if (!m) return;
  m.style.display = m.style.display === 'none' ? '' : 'none';
}
function hideFileMenu(){ const m = document.getElementById('fileMenu'); if (m) m.style.display = 'none'; }
function newDesign(){
  hideFileMenu();
  if (!confirm('Naya blank design banayein? Agar maujooda design save nahi kiya to wo chala jayega.')) return;
  saving = true; canvas.clear(); canvas.setBackgroundColor('#ffffff', () => {});
  saving = false; history = []; hIndex = -1; pushHistory(true);
  currentDesignId = null; document.getElementById('docTitle').value = 'Untitled design';
  document.getElementById('savedNote').textContent = '● Unsaved changes';
  canvas.renderAll(); renderLayers(); toast('✨ New blank design tayyar hai');
}
function saveAsCopy(){
  hideFileMenu();
  const t = document.getElementById('docTitle');
  t.value = (t.value.trim() || 'Untitled design') + ' copy';
  currentDesignId = null; saveDesign(true);
}
function openProjectsFromEditor(){ hideFileMenu(); showApp(); goPage('projects'); }
function clearCanvasAll(){
  hideFileMenu();
  if (!confirm('Canvas ki tamam cheezein saaf kar dein?')) return;
  saving = true; canvas.clear(); canvas.setBackgroundColor('#ffffff', () => {});
  saving = false; history = []; hIndex = -1; pushHistory(true);
  canvas.renderAll(); renderLayers(); markUnsaved(); toast('🧹 Canvas saaf ho gaya');
}
document.addEventListener('click', e => {
  const fm = document.getElementById('fileMenu');
  if (fm && fm.style.display !== 'none' && !e.target.closest('.file-wrap')) fm.style.display = 'none';
  const em = document.getElementById('exportMenu');
  if (em && em.style.display !== 'none' && !e.target.closest('#exportMenu') && !e.target.closest('.btn-download')) em.style.display = 'none';
});
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
async function submitPayment(e){
  e.preventDefault();
  const plan = document.getElementById('pfPlan').value;
  const tid = document.getElementById('pfTid').value.trim();
  const shotFile = document.getElementById('pfShot').files[0];
  const finish = async (shotData) => {
    if (isCloud()){
      const row = { user_id: cloudUser.id, email: currentUser.email, plan, amount: PRICES[plan], tid, screenshot: shotData || null };
      const { data, error } = await sb.from('orders').insert(row).select().maybeSingle();
      if (error){ toast('⚠️ Order submit nahi ho saka: ' + error.message); return; }
      if (data) myOrdersCache.unshift(data);
    } else {
      const order = { id: Date.now(), email: currentUser ? currentUser.email : '', name: document.getElementById('pfName').value.trim(), phone: document.getElementById('pfPhone').value.trim(), plan, amount: PRICES[plan], tid, status: 'pending', date: new Date().toLocaleString(), shot: shotData || '' };
      const o = JSON.parse(localStorage.getItem('kv_orders') || '[]'); o.unshift(order);
      localStorage.setItem('kv_orders', JSON.stringify(o));
    }
    closeModal('paymentModal');
    toast('✅ Order submitted! Pro activates after TID verification.');
    e.target.reset(); renderOrders();
  };
  if (shotFile) processImageFile(shotFile, dataUrl => finish(dataUrl));
  else finish(null);
}

/* ---- Super Admin data (cloud): all profiles + all orders ---- */
let adminUsersCache = null;   // profiles mapped to UI shape (+ designCount)
let adminOrdersCache = null;  // orders mapped to UI shape
function mapOrderRow(r){
  return { id: r.id, user_id: r.user_id, email: r.email, name: '', phone: '', plan: r.plan, amount: r.amount,
           tid: r.tid, status: r.status, date: r.created_at ? new Date(r.created_at).toLocaleString() : '', shot: r.screenshot || '' };
}
async function loadAdminData(){
  if (!isCloud() || !isSuperAdmin()) return;
  try {
    const [pr, ord, dz] = await Promise.all([
      sb.from('profiles').select('*').order('created_at', { ascending: true }),
      sb.from('orders').select('*').order('created_at', { ascending: false }),
      sb.from('designs').select('user_id')
    ]);
    const counts = {};
    (dz.data || []).forEach(r => { counts[r.user_id] = (counts[r.user_id] || 0) + 1; });
    adminUsersCache = (pr.data || []).map(p => ({ id: p.id, name: p.name || p.email.split('@')[0], email: p.email, picture: p.picture || '', blocked: !!p.blocked, plan: p.plan || 'free', google: false, designCount: counts[p.id] || 0 }));
    adminOrdersCache = (ord.data || []).map(mapOrderRow);
  } catch(e){ adminUsersCache = adminUsersCache || []; adminOrdersCache = adminOrdersCache || []; }
}
async function openAdmin(){
  if (isCloud()) await loadAdminData();
  const orders = isCloud() ? (adminOrdersCache || []) : JSON.parse(localStorage.getItem('kv_orders') || '[]');
  const el = document.getElementById('adminOrders');
  el.innerHTML = orders.length ? orders.map(o => `<div class="order-item"><span class="st ${o.status}">${o.status.toUpperCase()}</span> <b>${escapeHtml(o.name || o.email || '')}</b> (${escapeHtml(o.email || '')})<br>${o.plan === 'yearly' ? 'Pro Yearly' : 'Pro Monthly'} · Rs ${o.amount} · TID: <b>${escapeHtml(o.tid)}</b> · ${o.date}
    ${o.shot ? `<br><img src="${o.shot}" style="max-width:220px;border-radius:8px;margin-top:6px">` : ''}
    ${o.status === 'pending' ? `<div style="margin-top:8px"><button class="btn btn-primary" onclick="setOrder(${o.id},'approved')">✅ Approve</button> <button class="btn btn-ghost" onclick="setOrder(${o.id},'rejected')">❌ Reject</button></div>` : ''}</div>`).join('') : '<p class="muted">No orders yet.</p>';
  openModal('adminModal');
}
async function setOrder(id, status){
  if (isCloud()){
    const o = (adminOrdersCache || []).find(x => x.id === id) || (myOrdersCache || []).map(mapOrderRow).find(x => x.id === id);
    const { error } = await sb.from('orders').update({ status }).eq('id', id);
    if (error){ toast('⚠️ ' + error.message); return; }
    if (status === 'approved' && o && o.user_id){
      await sb.from('profiles').update({ plan: 'pro' }).eq('id', o.user_id);
      if (profileRow && cloudUser && o.user_id === cloudUser.id){ profileRow.plan = 'pro'; refreshPlanUI(); }
      toast('⚡ Pro activated for ' + (o.email || 'user'));
    }
    await loadAdminData();
  } else {
    const orders = JSON.parse(localStorage.getItem('kv_orders') || '[]'); const o = orders.find(x => x.id === id); if (!o) return;
    o.status = status; localStorage.setItem('kv_orders', JSON.stringify(orders));
    if (status === 'approved'){ localStorage.setItem('kv_plan_' + o.email, 'pro'); if (currentUser && currentUser.email === o.email) refreshPlanUI(); toast('⚡ Pro activated for ' + o.email); }
  }
  if (document.getElementById('adminModal').style.display !== 'none') openAdmin();
  renderOrders(); renderSuperAdmin();
}

/* ================= SUPER ADMIN ================= */
function userPlan(email){
  if (isCloud()){ const u = (adminUsersCache || []).find(x => x.email === email); return u ? u.plan : 'free'; }
  return localStorage.getItem('kv_plan_' + email) || 'free';
}
function userDesignCount(email){
  if (isCloud()){ const u = (adminUsersCache || []).find(x => x.email === email); return u ? (u.designCount || 0) : 0; }
  try { return JSON.parse(localStorage.getItem('kv_designs_' + email) || '[]').filter(d => !d.trashed).length; } catch(e){ return 0; }
}
function orderCardHTML(o, withActions){
  return `<div class="order-item"><span class="st ${o.status}">${o.status.toUpperCase()}</span> <b>${escapeHtml(o.name || o.email || '')}</b> (${escapeHtml(o.email || '')})<br>
  ${o.plan === 'yearly' ? 'Pro Yearly' : 'Pro Monthly'} · Rs ${o.amount} · TID: <b>${escapeHtml(o.tid)}</b> · ${o.date}
  ${o.shot ? `<br><img src="${o.shot}" style="max-width:220px;border-radius:8px;margin-top:6px">` : ''}
  ${withActions && o.status === 'pending' ? `<div style="margin-top:8px"><button class="mini-btn pro" onclick="setOrder(${o.id},'approved')">✅ Approve — Pro on karo</button> <button class="mini-btn del" onclick="setOrder(${o.id},'rejected')">❌ Reject</button></div>` : ''}</div>`;
}
async function renderSuperAdmin(){
  if (!isSuperAdmin()) return;
  if (isCloud()) await loadAdminData();
  const users = isCloud() ? (adminUsersCache || []) : [];
  const orders = isCloud() ? (adminOrdersCache || []) : JSON.parse(localStorage.getItem('kv_orders') || '[]');
  const pending = orders.filter(o => o.status === 'pending');
  const revenue = orders.filter(o => o.status === 'approved').reduce((s, o) => s + (o.amount || 0), 0);
  const proCount = users.filter(u => userPlan(u.email) === 'pro').length;
  const stats = [
    ['👥', users.length, 'Total users'],
    ['⚡', proCount, 'Pro members'],
    ['🆓', users.length - proCount, 'Free members'],
    ['⏳', pending.length, 'Pending orders'],
    ['💰', 'Rs ' + revenue.toLocaleString(), 'Revenue (approved)'],
    ['🧾', orders.length, 'Total orders'],
  ];
  const saStats = document.getElementById('saStats');
  if (saStats) saStats.innerHTML = stats.map(([ic, n, l]) => `<div class="stat-card"><b>${ic} ${n}</b><span>${l}</span></div>`).join('');
  const saUsers = document.getElementById('saUsers');
  if (saUsers){
    saUsers.innerHTML = users.length ? users.map(u => {
      const plan = userPlan(u.email);
      const initials = (u.name || '?').split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
      return `<div class="user-row">
        <div class="avatar">${u.picture ? '' : initials}</div>
        <div class="u-info"><b>${escapeHtml(u.name)}</b>${u.blocked ? '<span class="blocked-chip">BLOCKED</span>' : ''}<span>${escapeHtml(u.email)} · ${userDesignCount(u.email)} designs</span></div>
        <span class="plan-badge ${plan === 'pro' ? 'pro' : 'free'}">${plan === 'pro' ? '⚡ PRO' : 'FREE'}</span>
        <div class="u-btns">
          ${plan === 'pro'
            ? `<button class="mini-btn plain" onclick="saSetPlan('${u.email}','free')">Pro hatao (Free kar do)</button>`
            : `<button class="mini-btn pro" onclick="saSetPlan('${u.email}','pro')">⚡ Approve — Pro kar do</button>`}
          ${u.blocked
            ? `<button class="mini-btn unblock" onclick="saToggleBlock('${u.email}')">✅ Unblock</button>`
            : `<button class="mini-btn block" onclick="saToggleBlock('${u.email}')">🚫 Block</button>`}
          ${u.email !== currentUser.email ? `<button class="mini-btn del" onclick="saDeleteUser('${u.email}')">🗑 Delete user</button>` : ''}
        </div></div>`;
    }).join('') : '<div class="empty-note">No users yet — jab log sign up karenge to yahan nazar ayenge.</div>';
    [...saUsers.querySelectorAll('.user-row')].forEach((row, i) => { const u = users[i]; const av = row.querySelector('.avatar'); if (u.picture && av){ av.style.backgroundImage = 'url(' + u.picture + ')'; av.style.backgroundSize = 'cover'; } });
  }
  const saPending = document.getElementById('saPending');
  if (saPending) saPending.innerHTML = pending.length ? pending.map(o => orderCardHTML(o, true)).join('') : '<p class="muted small">No pending orders.</p>';
  const saAll = document.getElementById('saAllOrders');
  if (saAll) saAll.innerHTML = orders.length ? orders.map(o => orderCardHTML(o, false)).join('') : '<p class="muted small">No orders yet.</p>';
}
async function saSetPlan(email, plan){
  if (isCloud()){
    const u = (adminUsersCache || []).find(x => x.email === email); if (!u) return;
    const { error } = await sb.from('profiles').update({ plan }).eq('id', u.id);
    if (error){ toast('⚠️ ' + error.message); return; }
    u.plan = plan;
    if (profileRow && cloudUser && u.id === cloudUser.id){ profileRow.plan = plan; refreshPlanUI(); }
  } else {
    localStorage.setItem('kv_plan_' + email, plan);
    if (currentUser && currentUser.email === email) refreshPlanUI();
  }
  await renderSuperAdmin();
  toast(plan === 'pro' ? '⚡ ' + email + ' is now PRO' : email + ' is now on Free plan');
}
async function saToggleBlock(email){
  if (!isCloud()){ toast('Block cloud accounts par lagta hai — Super Admin apne asal account se login karke khulta hai'); return; }
  const u = (adminUsersCache || []).find(x => x.email === email); if (!u) return;
  const { error } = await sb.from('profiles').update({ blocked: !u.blocked }).eq('id', u.id);
  if (error){ toast('⚠️ ' + error.message); return; }
  u.blocked = !u.blocked;
  await renderSuperAdmin();
  toast(u.blocked ? '🚫 ' + email + ' blocked — ab login nahi ho sakega' : '✅ ' + email + ' unblocked');
}
async function saDeleteUser(email){
  if (!confirm('Delete user ' + email + ' and all their designs? This cannot be undone.')) return;
  if (isCloud()){
    const u = (adminUsersCache || []).find(x => x.email === email); if (!u) return;
    try {
      await sb.from('designs').delete().eq('user_id', u.id);
      await sb.from('brand_kits').delete().eq('user_id', u.id);
      await sb.from('teams').delete().eq('owner_id', u.id);
      await sb.from('profiles').delete().eq('id', u.id);
    } catch(e){}
    adminUsersCache = (adminUsersCache || []).filter(x => x.email !== email);
  } else {
    localStorage.removeItem('kv_plan_' + email);
    localStorage.removeItem('kv_designs_' + email);
    localStorage.removeItem('kv_brand_' + email);
  }
  renderSuperAdmin(); toast('🗑 User deleted: ' + email);
}

/* ================= LANDING PAGE ================= */
let pendingTpl = null;
function focusAuth(signup){
  const card = document.getElementById('authCard');
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (signup === true && authMode === 'login') toggleAuthMode();
  setTimeout(() => { const e = document.getElementById('auEmail'); if (e) e.focus({ preventScroll: true }); }, 550);
}
function showcaseTpl(id){ pendingTpl = id; focusAuth(true); toast('🎨 Pehle free account bana lo — ye template khud editor mein khul jayega'); }
function renderShowcase(){
  const g = document.getElementById('showcaseGrid'); if (!g) return;
  g.innerHTML = TEMPLATES.map(t => `<div class="tpl-card" style="background:${templateThumb(t)}" data-tpthumb="${t.id}" onclick="showcaseTpl('${t.id}')">${t.pro ? '<span class="lock-badge">⚡ PRO</span>' : ''}<div><div class="tpl-title">${t.title}</div><div class="tpl-sub">${t.cat}</div></div></div>`).join('');
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

/* static icon images */
try { document.querySelectorAll('img[data-ic]').forEach(im => { const s = (window.KV_ICONS || {})[im.dataset.ic]; if (s) im.src = s; }); } catch(e){}

/* init — session restore FIRST, and each step isolated so a render
   error can never block login restore again */
(async function boot(){
  let sessionRestored = false;
  try { sessionRestored = await restoreCloudSession(); } catch(e){}
  if (!sessionRestored){ document.getElementById('view-auth').style.display = ''; }
  try { renderTemplateGrids(); } catch(e){}
  try { renderShowcase(); } catch(e){}
})();
googleWatchdog();
