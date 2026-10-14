/* ============================================================
   Kanva — Canva-style design editor (original code)
   Name is a single config value: change APP_NAME + <title> to rename.
   ============================================================ */
const APP_NAME = 'Kanva';
const EASYPAISA_NUMBER = '03363268833';
const EASYPAISA_TITLE = 'Mukesh Kumar';
const PRICES = { monthly: 599, yearly: 4999 };

const SIZES = [
  { id:'ig-post',   name:'Instagram Post',   w:1080, h:1080 },
  { id:'ig-story',  name:'Story / Reel Cover', w:1080, h:1920 },
  { id:'fb-post',   name:'Facebook Post',    w:1200, h:630 },
  { id:'yt-thumb',  name:'YouTube Thumbnail', w:1280, h:720 },
  { id:'logo',      name:'Logo',             w:500,  h:500 },
  { id:'poster',    name:'Poster (A4 ratio)', w:794, h:1123 },
  { id:'pres',      name:'Presentation',     w:1920, h:1080 },
  { id:'banner',    name:'Facebook Cover',   w:1640, h:924 },
];
const FONTS = ['Poppins','Inter','Montserrat','Roboto','Oswald','Bebas Neue','Playfair Display','Pacifico','Dancing Script','Anton','Lobster','Arial','Georgia','Verdana','Courier New'];

let canvas, zoom = 1, history = [], hIndex = -1, saving = false;
let currentSize = SIZES[0];
let uploads = JSON.parse(localStorage.getItem('dk_uploads') || '[]');

/* ---------- plan ---------- */
function getPlan(){ return localStorage.getItem('dk_plan') || 'free'; }
function isPro(){ return getPlan() === 'pro'; }
function refreshPlanUI(){
  const b = document.getElementById('planBadge');
  if (isPro()) { b.textContent = '⚡ PRO PLAN'; b.className = 'plan-badge pro'; }
  else { b.textContent = 'FREE PLAN'; b.className = 'plan-badge free'; }
  renderTemplateLists();
}
function requirePro(feature){
  if (isPro()) return true;
  toast('🔒 ' + feature + ' is a Pro feature');
  openPricing();
  return false;
}

/* ---------- view switching ---------- */
function showView(v){
  document.getElementById('view-home').style.display = v === 'home' ? '' : 'none';
  document.getElementById('view-editor').style.display = v === 'editor' ? '' : 'none';
  window.scrollTo(0,0);
}
function openEditor(sizeId, tplId){
  showView('editor');
  if (!canvas) initCanvas();
  if (sizeId) changeSize(sizeId, true);
  if (tplId) applyTemplate(tplId);
  setTimeout(fitZoom, 60);
}

/* ---------- canvas ---------- */
function initCanvas(){
  canvas = new fabric.Canvas('c', { preserveObjectStacking: true, backgroundColor: '#ffffff' });
  canvas.setWidth(currentSize.w); canvas.setHeight(currentSize.h);
  const sel = document.getElementById('sizeSelect');
  sel.innerHTML = SIZES.map(s => `<option value="${s.id}">${s.name} · ${s.w}×${s.h}</option>`).join('');
  const fontSel = document.getElementById('pFont');
  fontSel.innerHTML = FONTS.map(f => `<option value="${f}" style="font-family:'${f}'">${f}</option>`).join('');
  canvas.on('selection:created', syncProps); canvas.on('selection:updated', syncProps);
  canvas.on('selection:cleared', () => { document.getElementById('propControls').style.display='none'; document.getElementById('noSel').style.display=''; renderLayers(); });
  ['object:added','object:removed','object:modified'].forEach(ev => canvas.on(ev, () => { if(!saving){ pushHistory(); } renderLayers(); }));
  buildSidebars(); renderUploads(); pushHistory(true);
}
function changeSize(id, skipFit){
  const s = SIZES.find(x => x.id === id); if (!s) return;
  currentSize = s;
  document.getElementById('sizeSelect').value = id;
  canvas.setWidth(s.w); canvas.setHeight(s.h);
  canvas.renderAll(); if (!skipFit) fitZoom();
}
function fitZoom(){
  const stage = document.getElementById('stage'); if (!stage || !canvas) return;
  const availW = stage.clientWidth - 70, availH = stage.clientHeight - 70;
  zoom = Math.max(.08, Math.min(availW / currentSize.w, availH / currentSize.h, 1.4));
  applyZoom();
}
function applyZoom(){
  document.getElementById('canvasHolder').style.transform = `scale(${zoom})`;
  document.getElementById('zoomLabel').textContent = Math.round(zoom * 100) + '%';
}
function zoomIn(){ zoom = Math.min(2.5, zoom * 1.15); applyZoom(); }
function zoomOut(){ zoom = Math.max(.08, zoom / 1.15); applyZoom(); }

/* ---------- history ---------- */
function pushHistory(init){
  if (saving) return;
  const json = JSON.stringify(canvas.toJSON(['selectable','evented','name']));
  if (!init && history[hIndex] === json) return;
  history = history.slice(0, hIndex + 1); history.push(json);
  if (history.length > 60) history.shift();
  hIndex = history.length - 1;
}
function loadHistory(i){
  if (i < 0 || i >= history.length) return;
  saving = true; hIndex = i;
  canvas.loadFromJSON(history[i], () => { canvas.renderAll(); saving = false; renderLayers(); });
}
function undo(){ loadHistory(hIndex - 1); }
function redo(){ loadHistory(hIndex + 1); }

/* ---------- objects ---------- */
function center(o){ o.set({ left: currentSize.w/2 - (o.width*o.scaleX)/2, top: currentSize.h/2 - (o.height*o.scaleY)/2 }); canvas.add(o); canvas.setActiveObject(o); canvas.renderAll(); return o; }
function addTextPreset(kind){
  const base = { fontFamily:'Poppins', fill:'#18122b', textAlign:'center', name:'Text' };
  let o;
  if (kind==='heading') o = new fabric.Textbox('Add a heading', { ...base, fontSize: Math.round(currentSize.w*.075), fontWeight:800, width: currentSize.w*.85 });
  if (kind==='sub') o = new fabric.Textbox('Add a subheading', { ...base, fontSize: Math.round(currentSize.w*.04), fontWeight:600, width: currentSize.w*.8 });
  if (kind==='body') o = new fabric.Textbox('Add a little bit of body text here. Double-click to edit.', { ...base, fontSize: Math.round(currentSize.w*.024), fontFamily:'Inter', width: currentSize.w*.7 });
  center(o);
}
function addStyledText(text, font, size, color, weight, italic){
  const o = new fabric.Textbox(text, { fontFamily:font, fontSize:size, fill:color, fontWeight:weight||700, fontStyle: italic?'italic':'normal', textAlign:'center', width: currentSize.w*.85, name:'Text' });
  center(o);
}
function addShape(kind){
  const fill = '#7c3aed'; let o;
  const s = currentSize.w * .28;
  if (kind==='rect') o = new fabric.Rect({ width:s, height:s*.65, fill, name:'Rectangle' });
  if (kind==='round') o = new fabric.Rect({ width:s, height:s*.65, fill, rx:22, ry:22, name:'Rounded Rect' });
  if (kind==='circle') o = new fabric.Circle({ radius:s/2, fill, name:'Circle' });
  if (kind==='triangle') o = new fabric.Triangle({ width:s, height:s, fill, name:'Triangle' });
  if (kind==='star') o = starShape(s/2, fill);
  if (kind==='heart') o = new fabric.Path('M 100 30 C 100 10 60 -10 32 12 C 4 34 10 70 100 140 C 190 70 196 34 168 12 C 140 -10 100 10 100 30 Z', { fill:'#ec4899', scaleX:s/200, scaleY:s/200, name:'Heart' });
  if (kind==='line') o = new fabric.Rect({ width:s*1.4, height:Math.max(4,currentSize.w*.008), fill:'#18122b', name:'Line' });
  if (kind==='ring') o = new fabric.Circle({ radius:s/2, fill:'transparent', stroke:fill, strokeWidth:14, name:'Ring' });
  if (o) center(o);
}
function starShape(r, fill){
  const pts = [];
  for (let i=0;i<10;i++){ const rad = i%2===0 ? r : r*.48, a = (Math.PI/5)*i - Math.PI/2; pts.push({ x: rad*Math.cos(a)+r, y: rad*Math.sin(a)+r }); }
  return new fabric.Polygon(pts, { fill, name:'Star' });
}
function addSticker(emoji){
  const o = new fabric.Text(emoji, { fontSize: Math.round(currentSize.w*.14), name:'Sticker' });
  center(o);
}
function addImageURL(url){
  fabric.Image.fromURL(url, img => {
    const max = currentSize.w * .6, sc = Math.min(max / img.width, max / img.height, 1);
    img.set({ scaleX: sc, scaleY: sc, name:'Image', crossOrigin:'anonymous' });
    center(img);
  }, { crossOrigin:'anonymous' });
}

/* ---------- selection ops ---------- */
function active(){ return canvas.getActiveObject(); }
function deleteObj(){ const o = active(); if (o){ canvas.remove(o); canvas.discardActiveObject(); canvas.renderAll(); } }
function duplicateObj(){ const o = active(); if (!o) return; o.clone(cloned => { cloned.set({ left:(cloned.left||0)+24, top:(cloned.top||0)+24, name:(cloned.name||'Copy') }); canvas.add(cloned); canvas.setActiveObject(cloned); canvas.renderAll(); }, ['name']); }
function bringForward(){ const o = active(); if (o){ o.bringForward(); canvas.renderAll(); renderLayers(); } }
function sendBackward(){ const o = active(); if (o){ o.sendBackwards(); canvas.renderAll(); renderLayers(); } }

/* ---------- properties ---------- */
function syncProps(){
  const o = active(); if (!o) return;
  document.getElementById('noSel').style.display = 'none';
  document.getElementById('propControls').style.display = '';
  const isText = o.type === 'textbox' || o.type === 'i-text' || o.type === 'text';
  document.getElementById('textProps').style.display = isText ? '' : 'none';
  const fill = typeof o.fill === 'string' ? o.fill : '#000000';
  document.getElementById('pFill').value = fill; document.getElementById('pFillHex').value = fill;
  document.getElementById('pOpacity').value = Math.round((o.opacity ?? 1) * 100);
  document.getElementById('opVal').textContent = Math.round((o.opacity ?? 1) * 100) + '%';
  if (isText){
    document.getElementById('pFont').value = o.fontFamily || 'Poppins';
    document.getElementById('pFontSize').value = Math.round(o.fontSize || 40);
    document.getElementById('btnBold').style.background = o.fontWeight === 'bold' || o.fontWeight >= 700 ? '#7c3aed' : '';
    document.getElementById('btnItalic').style.background = o.fontStyle === 'italic' ? '#7c3aed' : '';
    document.getElementById('btnUnderline').style.background = o.underline ? '#7c3aed' : '';
  }
  document.getElementById('pStroke').value = typeof o.stroke === 'string' ? o.stroke : '#000000';
  document.getElementById('pStrokeW').value = o.strokeWidth || 0;
  renderLayers();
}
function setFill(v){ const o=active(); if(o){ o.set('fill', v); document.getElementById('pFillHex').value=v; canvas.renderAll(); } }
function setOpacity(v){ const o=active(); if(o){ o.set('opacity', v/100); document.getElementById('opVal').textContent = v+'%'; canvas.renderAll(); } }
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

/* ---------- layers ---------- */
function renderLayers(){
  const list = document.getElementById('layerList'); if (!list || !canvas) return;
  const objs = canvas.getObjects().filter(o => o.name !== '__bg' && o.name !== '__wm').slice().reverse();
  if (!objs.length){ list.innerHTML = '<p class="muted small">No layers yet.</p>'; return; }
  list.innerHTML = objs.map((o) => {
    const idx = canvas.getObjects().indexOf(o);
    const nm = o.name || o.type;
    const label = (o.type==='textbox'||o.type==='i-text'||o.type==='text') && o.text ? o.text.slice(0,18) : nm;
    return `<div class="layer-item ${active()===o?'active':''}" onclick="selectLayer(${idx})">
      <span class="lname">${label}</span>
      <button onclick="event.stopPropagation();toggleVis(${idx})" title="Show/hide">${o.visible===false?'🚫':'👁️'}</button>
      <button onclick="event.stopPropagation();delLayer(${idx})" title="Delete">🗑️</button></div>`;
  }).join('');
}
function selectLayer(i){ const o = canvas.getObjects()[i]; if (o){ canvas.setActiveObject(o); canvas.renderAll(); syncProps(); } }
function toggleVis(i){ const o = canvas.getObjects()[i]; if (o){ o.visible = o.visible === false ? true : false; canvas.renderAll(); renderLayers(); } }
function delLayer(i){ const o = canvas.getObjects()[i]; if (o){ canvas.remove(o); canvas.renderAll(); } }

/* ---------- tabs / sidebars ---------- */
function switchTab(t){
  document.querySelectorAll('.rail-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
  document.querySelectorAll('.tabpage').forEach(p => p.style.display = 'none');
  document.getElementById('tab-' + t).style.display = '';
  if (t === 'layers') renderLayers();
}
function buildSidebars(){
  const sr = document.getElementById('sizeRow');
  sr.innerHTML = SIZES.map(s => `<button class="size-chip" onclick="openEditor('${s.id}')">${s.name}<small>${s.w} × ${s.h}</small></button>`).join('');
  const shapes = [['rect','▭'],['round','▢'],['circle','●'],['triangle','▲'],['star','★'],['heart','❤'],['line','━'],['ring','◎']];
  document.getElementById('shapeGrid').innerHTML = shapes.map(([k,ic]) => `<div class="el-cell" onclick="addShape('${k}')" title="${k}">${ic}</div>`).join('');
  const stickers = ['🎉','⭐','❤️','🔥','👍','😊','🌟','💯','🏆','🎂','💡','🚀','🌈','🦋','🌸','⚡'];
  document.getElementById('stickerGrid').innerHTML = stickers.map(e => `<div class="el-cell" onclick="addSticker('${e}')">${e}</div>`).join('');
  const styles = [
    ['BIG SALE','Bebas Neue',90,'#18122b',700],['Elegant Title','Playfair Display',64,'#18122b',700],
    ['Fun Script','Pacifico',58,'#ec4899',400],['MODERN BOLD','Montserrat',64,'#18122b',900],
    ['Handwritten','Dancing Script',64,'#7c3aed',700],['IMPACT','Anton',84,'#18122b',400],
  ];
  document.getElementById('fontStyles').innerHTML = styles.map(([t,f,s,c,w]) =>
    `<button class="font-style-btn" style="font-family:'${f}';font-size:${Math.min(22,s/3)}px" onclick="addStyledText('${t}','${f}',${s},'${c}',${w})">${t}</button>`).join('');
  const colors = ['#ffffff','#000000','#18122b','#7c3aed','#ec4899','#f59e0b','#ef4444','#22c55e','#3b82f6','#06b6d4','#facc15','#f97316','#a855f7','#64748b','#fef3c7','#dcfce7'];
  document.getElementById('bgColors').innerHTML = colors.map(c => `<div class="swatch" style="background:${c}" onclick="setBgColor('${c}')"></div>`).join('');
  const grads = [['#7c3aed','#ec4899'],['#f59e0b','#ef4444'],['#06b6d4','#3b82f6'],['#22c55e','#06b6d4'],['#f43f5e','#f59e0b'],['#0f172a','#7c3aed'],['#fdfbfb','#ebedee'],['#134e5e','#71b280']];
  document.getElementById('bgGradients').innerHTML = grads.map(([a,b]) => `<div class="swatch" style="background:linear-gradient(135deg,${a},${b})" onclick="setBgGradient('${a}','${b}')"></div>`).join('');
  renderTemplateLists();
}
function setBgColor(c){ canvas.setBackgroundColor(c, () => canvas.renderAll()); removeBgRect(); pushHistory(); }
function removeBgRect(){ const bg = canvas.getObjects().find(o => o.name === '__bg'); if (bg) canvas.remove(bg); }
function setBgGradient(a, b){
  removeBgRect(); canvas.setBackgroundColor('transparent', () => {});
  const rect = new fabric.Rect({ left:0, top:0, width: currentSize.w, height: currentSize.h, selectable:false, evented:false, name:'__bg' });
  rect.set('fill', new fabric.Gradient({ type:'linear', gradientUnits:'pixels', coords:{ x1:0, y1:0, x2:currentSize.w, y2:currentSize.h }, colorStops:[{offset:0,color:a},{offset:1,color:b}] }));
  canvas.add(rect); rect.sendToBack(); canvas.renderAll(); pushHistory();
}

/* ---------- uploads ---------- */
function handleUpload(ev){
  [...ev.target.files].forEach(f => {
    const r = new FileReader();
    r.onload = () => { uploads.unshift(r.result); if (uploads.length > 24) uploads.pop(); localStorage.setItem('dk_uploads', JSON.stringify(uploads)); renderUploads(); };
    r.readAsDataURL(f);
  });
  ev.target.value = '';
}
function renderUploads(){
  const g = document.getElementById('uploadGrid'); if (!g) return;
  g.innerHTML = '';
  if (!uploads.length){ g.innerHTML = '<p class="muted small">No uploads yet.</p>'; return; }
  uploads.forEach((u, i) => {
    const img = document.createElement('img'); img.src = u; img.alt = 'upload';
    img.onclick = () => addImageURL(uploads[i]); g.appendChild(img);
  });
}

/* ================= TEMPLATES ================= */
const TEMPLATES = [
  { id:'sale',     title:'Mega Sale',        sub:'50% OFF',            pro:false, bg:['#ef4444','#f97316'] },
  { id:'quote',    title:'Daily Quote',      sub:'Motivation post',    pro:false, bg:['#fef3c7','#fde68a'] },
  { id:'business', title:'Grow Business',    sub:'Promo post',         pro:false, bg:['#0f172a','#155e75'] },
  { id:'food',     title:'Tasty Burger',     sub:'Food offer',         pro:false, bg:['#f59e0b','#ef4444'] },
  { id:'estate',   title:'House For Sale',   sub:'Real estate',        pro:false, bg:['#1d4ed8','#06b6d4'] },
  { id:'edu',      title:'Admissions Open',  sub:'School / institute', pro:false, bg:['#7c3aed','#4f46e5'] },
  { id:'birthday', title:'Happy Birthday',   sub:'Birthday wish',      pro:true,  bg:['#7c3aed','#ec4899'] },
  { id:'yt',       title:'YouTube Thumbnail', sub:'Make money online', pro:true,  bg:['#111827','#374151'] },
  { id:'eid',      title:'Eid Mubarak',      sub:'Greeting card',      pro:true,  bg:['#065f46','#10b981'] },
  { id:'fashion',  title:'New Collection',   sub:'Fashion sale',       pro:true,  bg:['#e7d8c9','#c9a887'] },
];
function T(t, o){ return new fabric.Textbox(t, Object.assign({ textAlign:'center', name:'Text' }, o)); }
function gradRect(a, b){
  const r = new fabric.Rect({ left:0, top:0, width:currentSize.w, height:currentSize.h, selectable:false, evented:false, name:'__bg' });
  r.set('fill', new fabric.Gradient({ type:'linear', gradientUnits:'pixels', coords:{ x1:0, y1:0, x2:currentSize.w, y2:currentSize.h }, colorStops:[{offset:0,color:a},{offset:1,color:b}] }));
  canvas.add(r); return r;
}
function solidBg(c){ canvas.setBackgroundColor(c, () => canvas.renderAll()); }
function addAt(o, xPct, yPct){ o.set({ left: currentSize.w*xPct - (o.width*(o.scaleX||1))/2, top: currentSize.h*yPct }); canvas.add(o); return o; }

const BUILDERS = {
  sale(){ gradRect('#ef4444','#f97316'); const W=currentSize.w;
    addAt(T('MEGA SALE', { fontFamily:'Bebas Neue', fontSize:W*.16, fill:'#fff', fontWeight:700, width:W*.9 }), .5, .14);
    addAt(T('50% OFF', { fontFamily:'Anton', fontSize:W*.24, fill:'#facc15', width:W*.9, shadow:new fabric.Shadow({color:'rgba(0,0,0,.3)',blur:6,offsetX:4,offsetY:5}) }), .5, .34);
    addAt(T('On Everything — Limited Time Offer!', { fontFamily:'Inter', fontSize:W*.032, fill:'#fff', width:W*.85 }), .5, .62);
    const btn = new fabric.Rect({ width:W*.42, height:W*.1, fill:'#18122b', rx:40, ry:40, name:'Button' }); addAt(btn, .5, .76);
    addAt(T('SHOP NOW', { fontFamily:'Poppins', fontSize:W*.04, fill:'#fff', fontWeight:700, width:W*.42 }), .5, .785);
  },
  quote(){ solidBg('#fef9ec'); const W=currentSize.w;
    addAt(T('“', { fontFamily:'Playfair Display', fontSize:W*.3, fill:'#f59e0b', width:W*.4 }), .5, .06);
    addAt(T('Stay positive,\nwork hard,\nmake it happen.', { fontFamily:'Playfair Display', fontSize:W*.075, fill:'#1c1917', fontWeight:700, width:W*.82, lineHeight:1.2 }), .5, .36);
    addAt(T('— DAILY MOTIVATION', { fontFamily:'Montserrat', fontSize:W*.026, fill:'#92400e', width:W*.7 }), .5, .78);
  },
  business(){ gradRect('#0f172a','#155e75'); const W=currentSize.w;
    const bar = new fabric.Rect({ width:W*.16, height:W*.014, fill:'#22d3ee', name:'Accent' }); addAt(bar, .5, .16);
    addAt(T('GROW YOUR\nBUSINESS', { fontFamily:'Montserrat', fontSize:W*.105, fill:'#fff', fontWeight:900, width:W*.88, lineHeight:1.1 }), .5, .24);
    addAt(T('Professional services that bring you more customers, more sales, more growth.', { fontFamily:'Inter', fontSize:W*.03, fill:'#a5f3fc', width:W*.8 }), .5, .58);
    addAt(T('📞 0300-1234567   🌐 yourwebsite.com', { fontFamily:'Poppins', fontSize:W*.032, fill:'#fff', fontWeight:600, width:W*.85 }), .5, .8);
  },
  food(){ gradRect('#f59e0b','#ef4444'); const W=currentSize.w;
    addAt(new fabric.Text('🍔', { fontSize:W*.34, name:'Sticker' }), .5, .08);
    addAt(T('TASTY BURGER', { fontFamily:'Anton', fontSize:W*.13, fill:'#fff', width:W*.92 }), .5, .5);
    addAt(T('Juicy • Fresh • Delicious', { fontFamily:'Pacifico', fontSize:W*.045, fill:'#fef3c7', width:W*.85 }), .5, .66);
    addAt(T('Only Rs 499 — Order Now!', { fontFamily:'Poppins', fontSize:W*.038, fill:'#fff', fontWeight:700, width:W*.85 }), .5, .78);
  },
  estate(){ gradRect('#1d4ed8','#06b6d4'); const W=currentSize.w;
    addAt(new fabric.Text('🏠', { fontSize:W*.26, name:'Sticker' }), .5, .08);
    addAt(T('HOUSE FOR SALE', { fontFamily:'Montserrat', fontSize:W*.1, fill:'#fff', fontWeight:900, width:W*.92 }), .5, .42);
    addAt(T('3 Bed • 2 Bath • Prime Location', { fontFamily:'Inter', fontSize:W*.034, fill:'#dbeafe', width:W*.85 }), .5, .58);
    addAt(T('Call: 0300-1234567', { fontFamily:'Poppins', fontSize:W*.042, fill:'#facc15', fontWeight:700, width:W*.85 }), .5, .72);
  },
  edu(){ solidBg('#ffffff'); const W=currentSize.w;
    const band = new fabric.Rect({ left:0, top:0, width:W, height:currentSize.h*.3, fill:'#7c3aed', selectable:false, name:'Header Band' }); canvas.add(band);
    addAt(T('🎓 ADMISSIONS OPEN', { fontFamily:'Poppins', fontSize:W*.085, fill:'#fff', fontWeight:800, width:W*.94 }), .5, .09);
    addAt(T('Session 2026 – 27', { fontFamily:'Montserrat', fontSize:W*.045, fill:'#4c1d95', fontWeight:700, width:W*.85 }), .5, .42);
    addAt(T('Limited seats — experienced teachers,\nmodern labs and affordable fees.', { fontFamily:'Inter', fontSize:W*.032, fill:'#334155', width:W*.82, lineHeight:1.35 }), .5, .55);
    addAt(T('Enroll Now: 0300-1234567', { fontFamily:'Poppins', fontSize:W*.04, fill:'#7c3aed', fontWeight:700, width:W*.85 }), .5, .8);
  },
  birthday(){ gradRect('#7c3aed','#ec4899'); const W=currentSize.w;
    addAt(new fabric.Text('🎉', { fontSize:W*.16, name:'Sticker' }), .18, .06);
    addAt(new fabric.Text('🎂', { fontSize:W*.16, name:'Sticker' }), .82, .06);
    addAt(T('Happy Birthday', { fontFamily:'Pacifico', fontSize:W*.115, fill:'#fff', width:W*.92 }), .5, .3);
    addAt(T('TO YOU!', { fontFamily:'Anton', fontSize:W*.09, fill:'#fde68a', width:W*.9 }), .5, .47);
    addAt(T('Wishing you a day full of happiness,\ncake and wonderful surprises.', { fontFamily:'Inter', fontSize:W*.03, fill:'#fce7f3', width:W*.82, lineHeight:1.35 }), .5, .62);
  },
  yt(){ gradRect('#111827','#374151'); const W=currentSize.w;
    addAt(T('HOW TO', { fontFamily:'Anton', fontSize:W*.17, fill:'#fff', width:W*.9 }), .5, .12);
    addAt(T('MAKE MONEY', { fontFamily:'Anton', fontSize:W*.17, fill:'#facc15', width:W*.9 }), .5, .34);
    addAt(T('ONLINE 💰', { fontFamily:'Anton', fontSize:W*.13, fill:'#fff', width:W*.9 }), .5, .56);
    const play = new fabric.Circle({ radius:W*.07, fill:'#ef4444', name:'Play Button' }); addAt(play, .5, .82);
    addAt(new fabric.Text('▶', { fontSize:W*.07, fill:'#fff', name:'Sticker' }), .515, .845);
  },
  eid(){ gradRect('#065f46','#10b981'); const W=currentSize.w;
    addAt(new fabric.Text('🌙', { fontSize:W*.2, name:'Sticker' }), .5, .08);
    addAt(T('Eid Mubarak', { fontFamily:'Playfair Display', fontSize:W*.12, fill:'#fff', fontWeight:700, width:W*.92 }), .5, .36);
    addAt(T('May your life be filled with\npeace, joy and blessings.', { fontFamily:'Inter', fontSize:W*.033, fill:'#d1fae5', width:W*.82, lineHeight:1.4 }), .5, .56);
    addAt(T('— From our family to yours', { fontFamily:'Dancing Script', fontSize:W*.05, fill:'#fde68a', width:W*.85 }), .5, .76);
  },
  fashion(){ solidBg('#f3ead9'); const W=currentSize.w;
    const circ = new fabric.Circle({ radius:W*.21, fill:'#c9a887', name:'Circle Frame' }); addAt(circ, .5, .1);
    addAt(new fabric.Text('👗', { fontSize:W*.17, name:'Sticker' }), .5, .19);
    addAt(T('NEW COLLECTION', { fontFamily:'Playfair Display', fontSize:W*.09, fill:'#3f2f1d', fontWeight:700, width:W*.92 }), .5, .56);
    addAt(T('Fashion Sale 2026 — Up to 40% Off', { fontFamily:'Montserrat', fontSize:W*.03, fill:'#7c5c36', width:W*.85 }), .5, .7);
  },
};
function applyTemplate(id){
  const tpl = TEMPLATES.find(t => t.id === id); if (!tpl) return;
  if (tpl.pro && !isPro()){ requirePro('This template'); return; }
  if (!canvas) openEditor(null, null);
  saving = true; canvas.clear(); canvas.setBackgroundColor('#ffffff', () => {});
  BUILDERS[id](); saving = false; history = []; hIndex = -1; pushHistory(true);
  canvas.discardActiveObject(); canvas.renderAll(); renderLayers();
  toast('✅ Template loaded — tap anything to edit it');
}
function openTpl(id){
  const tpl = TEMPLATES.find(t => t.id === id);
  if (tpl && tpl.pro && !isPro()){ requirePro('This template'); return; }
  openEditor(tpl && tpl.id === 'yt' ? 'yt-thumb' : 'ig-post', id);
}
function renderTemplateLists(){
  const card = t => `<div class="tpl-card" style="background:linear-gradient(135deg,${t.bg[0]},${t.bg[1]})" onclick="openTpl('${t.id}')">
      ${t.pro ? '<span class="lock-badge">⚡ PRO</span>' : ''}
      <div><div class="tpl-title">${t.title}</div><div class="tpl-sub">${t.sub}</div></div></div>`;
  const home = document.getElementById('tplGridHome'); if (home) home.innerHTML = TEMPLATES.map(card).join('');
  const list = document.getElementById('tplList');
  if (list) list.innerHTML = TEMPLATES.map(t => `<div class="tpl-mini" style="background:linear-gradient(135deg,${t.bg[0]},${t.bg[1]})" onclick="applyTemplate('${t.id}')">
      ${t.pro ? '<span class="lock-badge">⚡ PRO</span>' : ''}<div class="tpl-title" style="font-family:Poppins;font-weight:700;color:#fff;text-shadow:0 1px 6px rgba(0,0,0,.4)">${t.title}</div></div>`).join('');
}

/* ================= SAVE / MY DESIGNS ================= */
function getDesigns(){ return JSON.parse(localStorage.getItem('dk_designs') || '[]'); }
function saveDesign(){
  const designs = getDesigns();
  if (!isPro() && designs.length >= 5){ requirePro('Unlimited saved projects'); return; }
  const name = prompt('Design name:', 'Untitled Design ' + new Date().toLocaleDateString());
  if (name === null) return;
  canvas.discardActiveObject(); canvas.renderAll();
  designs.unshift({ id: Date.now(), name: name || 'Untitled', sizeId: currentSize.id,
    json: JSON.stringify(canvas.toJSON(['selectable','evented','name'])),
    bg: canvas.backgroundColor || '#ffffff',
    thumb: canvas.toDataURL({ format:'jpeg', quality:.6, multiplier: Math.min(260/currentSize.w, 1) }),
    updated: new Date().toLocaleString() });
  localStorage.setItem('dk_designs', JSON.stringify(designs));
  toast('💾 Design saved in My Designs');
}
function openMyDesigns(){
  const designs = getDesigns();
  document.getElementById('designGrid').innerHTML = designs.length ? designs.map(d =>
    `<div class="design-card"><img src="${d.thumb}" alt=""><div class="dc-body"><div class="dc-name">${d.name}</div>
     <div class="muted small">${d.updated}</div><div class="dc-btns">
     <button onclick="loadDesign(${d.id})">Open</button><button onclick="deleteDesign(${d.id})">Delete</button></div></div></div>`).join('')
    : '<p class="muted">No saved designs yet. Create one and press Save.</p>';
  renderOrders(); openModal('designsModal');
}
function loadDesign(id){
  const d = getDesigns().find(x => x.id === id); if (!d) return;
  closeModal('designsModal'); openEditor(d.sizeId, null);
  saving = true;
  canvas.loadFromJSON(d.json, () => { canvas.setBackgroundColor(typeof d.bg === 'string' ? d.bg : '#ffffff', () => {}); canvas.renderAll(); saving = false; history = []; hIndex = -1; pushHistory(true); renderLayers(); toast('📂 Design opened'); });
}
function deleteDesign(id){
  localStorage.setItem('dk_designs', JSON.stringify(getDesigns().filter(x => x.id !== id)));
  openMyDesigns();
}
function getOrders(){ return JSON.parse(localStorage.getItem('dk_orders') || '[]'); }
function renderOrders(){
  const orders = getOrders(); const el = document.getElementById('orderList'); if (!el) return;
  el.innerHTML = orders.length ? orders.map(o => `<div class="order-item">
    <span class="st ${o.status}">${o.status.toUpperCase()}</span> <b>${o.plan === 'yearly' ? 'Pro Yearly' : 'Pro Monthly'} — Rs ${o.amount}</b><br>
    TID: ${o.tid} · ${o.date}</div>`).join('') : '<p class="muted small">No orders yet.</p>';
}

/* ================= EXPORT ================= */
function toggleExportMenu(){ const m = document.getElementById('exportMenu'); m.style.display = m.style.display === 'none' ? '' : 'none'; }
document.addEventListener('click', e => { if (!e.target.closest('.export-wrap')) { const m = document.getElementById('exportMenu'); if (m) m.style.display = 'none'; } });
function downloadURI(uri, name){ const a = document.createElement('a'); a.href = uri; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
function withWatermark(fn){
  canvas.discardActiveObject();
  let wm = null;
  if (!isPro()){ wm = new fabric.Text('Made with Kanva', { left: currentSize.w - 8, top: currentSize.h - 8, fontSize: Math.max(13, currentSize.w*.016), fill:'rgba(0,0,0,.45)', fontFamily:'Inter', originX:'right', originY:'bottom', selectable:false, evented:false, name:'__wm' }); canvas.add(wm); }
  canvas.renderAll(); fn();
  if (wm){ canvas.remove(wm); canvas.renderAll(); }
}
function exportPNG(mult){
  if (mult > 1 && !isPro()){ requirePro('HD export'); return; }
  withWatermark(() => downloadURI(canvas.toDataURL({ format:'png', multiplier: mult }), 'kanva-design.png'));
  toast('⬇️ PNG downloaded' + (mult > 1 ? ' (HD)' : ''));
}
function exportJPG(){
  withWatermark(() => downloadURI(canvas.toDataURL({ format:'jpeg', quality:.92, multiplier: 1 }), 'kanva-design.jpg'));
  toast('⬇️ JPG downloaded');
}
function exportPDF(){
  withWatermark(() => {
    const { jsPDF } = window.jspdf;
    const orient = currentSize.w >= currentSize.h ? 'landscape' : 'portrait';
    const pdf = new jsPDF({ orientation: orient, unit:'px', format:[currentSize.w, currentSize.h], hotfixes:['px_scaling'] });
    pdf.addImage(canvas.toDataURL({ format:'jpeg', quality:.92 }), 'JPEG', 0, 0, currentSize.w, currentSize.h);
    pdf.save('kanva-design.pdf');
  });
  toast('⬇️ PDF downloaded');
}

/* ================= PAYMENT / PRO ================= */
function openPricing(){ openPayment('monthly'); }
function openPayment(plan){
  document.getElementById('pfPlan').value = plan || 'monthly';
  updatePayAmount(); openModal('paymentModal');
}
function updatePayAmount(){
  const p = document.getElementById('pfPlan').value;
  document.getElementById('payAmount').textContent = 'Rs ' + PRICES[p].toLocaleString();
}
function copyNumber(){
  if (navigator.clipboard) navigator.clipboard.writeText(EASYPAISA_NUMBER);
  toast('📋 Easypaisa number copied: ' + EASYPAISA_NUMBER);
}
function submitPayment(e){
  e.preventDefault();
  const plan = document.getElementById('pfPlan').value;
  const order = { id: Date.now(), name: document.getElementById('pfName').value.trim(),
    phone: document.getElementById('pfPhone').value.trim(), plan, amount: PRICES[plan],
    tid: document.getElementById('pfTid').value.trim(), status:'pending', date: new Date().toLocaleString() };
  const shot = document.getElementById('pfShot').files[0];
  const save = () => { const o = getOrders(); o.unshift(order); localStorage.setItem('dk_orders', JSON.stringify(o)); closeModal('paymentModal');
    toast('✅ Order submitted! Pro will activate after verification of TID ' + order.tid); e.target.reset(); };
  if (shot){ const r = new FileReader(); r.onload = () => { order.shot = r.result; save(); }; r.readAsDataURL(shot); }
  else save();
}
function openAdmin(){
  const orders = getOrders(); const el = document.getElementById('adminOrders');
  el.innerHTML = orders.length ? orders.map(o => `<div class="order-item">
    <span class="st ${o.status}">${o.status.toUpperCase()}</span> <b>${o.name}</b> — ${o.phone}<br>
    ${o.plan === 'yearly' ? 'Pro Yearly' : 'Pro Monthly'} · Rs ${o.amount} · TID: <b>${o.tid}</b> · ${o.date}
    ${o.shot ? `<br><img src="${o.shot}" style="max-width:220px;border-radius:8px;margin-top:6px">` : ''}
    ${o.status === 'pending' ? `<div style="margin-top:8px"><button class="btn btn-primary" onclick="setOrder(${o.id},'approved')">✅ Approve</button>
    <button class="btn btn-ghost" onclick="setOrder(${o.id},'rejected')">❌ Reject</button></div>` : ''}
    </div>`).join('') : '<p class="muted">No orders yet.</p>';
  openModal('adminModal');
}
function setOrder(id, status){
  const orders = getOrders(); const o = orders.find(x => x.id === id); if (!o) return;
  o.status = status; localStorage.setItem('dk_orders', JSON.stringify(orders));
  if (status === 'approved'){ localStorage.setItem('dk_plan', 'pro'); refreshPlanUI(); toast('⚡ Pro activated (this device) for ' + o.name); }
  openAdmin();
}

/* ================= UI helpers ================= */
function openModal(id){ document.getElementById(id).style.display = 'flex'; }
function closeModal(id){ document.getElementById(id).style.display = 'none'; }
document.querySelectorAll('.modal-bg').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.style.display = 'none'; }));
let toastTimer;
function toast(msg){
  const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}
document.getElementById('pfPlan').addEventListener('change', updatePayAmount);
document.addEventListener('keydown', e => {
  if (document.getElementById('view-editor').style.display === 'none') return;
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || (active() && active().isEditing);
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z'){ e.preventDefault(); undo(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y'){ e.preventDefault(); redo(); }
  if ((e.key === 'Delete' || e.key === 'Backspace') && !typing){ deleteObj(); }
});
window.addEventListener('resize', () => { if (canvas && document.getElementById('view-editor').style.display !== 'none') fitZoom(); });

/* ---------- PWA install ---------- */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; document.getElementById('installBtn').style.display = ''; });
function installApp(){ if (deferredPrompt){ deferredPrompt.prompt(); deferredPrompt.userChoice.then(() => { deferredPrompt = null; }); } else toast('Open browser menu ⋮ → "Install app / Add to Home screen"'); }

/* ---------- init ---------- */
buildSidebars();
refreshPlanUI();
