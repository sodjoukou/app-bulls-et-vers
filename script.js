// ─── BULLS & VERS — script.js ───
// Firebase ESM — à charger avec type="module" dans le HTML

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, onSnapshot,
  query, orderBy, doc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ─── FIREBASE CONFIG ───
const db = getFirestore(initializeApp({
  apiKey:            "AIzaSyAxwTDYLGYraaSzySeMKBNmmsu0R8ZEX48",
  authDomain:        "bulls-et-vers.firebaseapp.com",
  projectId:         "bulls-et-vers",
  storageBucket:     "bulls-et-vers.firebasestorage.app",
  messagingSenderId: "297396725042",
  appId:             "1:297396725042:web:504a84b3a01bcc793a232b"
}));

// ─── CONSTANTS ───
const EMOJIS = ['❤️','😍','😂','😢','🔥','👏','✨','🌹','💫','🤩','😮','💯'];

// ─── STATE ───
let currentUser  = null;
let bds          = [];
let poems        = [];
let messages     = [];
let reactingMsgId = null;
let unsubBDs, unsubPoems, unsubMsgs;

// ─── HELPERS ───
const syncDot = document.getElementById('sync-dot');
const syncOk  = () => syncDot.className = 'sync-dot ok';
const syncErr = () => syncDot.className = 'sync-dot err';
const esc     = t  => String(t || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

// ═══════════════════════════════════════════
//  LOGIN / LOGOUT
// ═══════════════════════════════════════════
window.login = function (user) {
  currentUser = user;
  document.getElementById('login-screen').classList.add('hidden');
  ['topbar','nav-tabs','content'].forEach(id => {
    document.getElementById(id).style.display = id === 'content' ? 'block' : 'flex';
  });

  const isEmilie = user === 'emilie';
  document.getElementById('topbar-avatar').textContent  = isEmilie ? 'É' : 'M';
  document.getElementById('topbar-avatar').className    = 'avatar ' + (isEmilie ? 'her' : 'me');
  document.getElementById('topbar-name').textContent    = isEmilie ? 'Émilie 🌹' : 'Moi';

  startListeners();
};

window.logout = function () {
  currentUser = null;
  [unsubBDs, unsubPoems, unsubMsgs].forEach(u => u && u());

  document.getElementById('login-screen').classList.remove('hidden');
  ['topbar','nav-tabs','content'].forEach(id =>
    document.getElementById(id).style.display = 'none'
  );
  switchTab('bd', true);
};

// ═══════════════════════════════════════════
//  FIRESTORE LISTENERS
// ═══════════════════════════════════════════
function startListeners () {
  unsubBDs = onSnapshot(
    query(collection(db, 'bds'), orderBy('createdAt', 'desc')),
    snap => { bds = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderBDs(); syncOk(); },
    syncErr
  );

  unsubPoems = onSnapshot(
    query(collection(db, 'poems'), orderBy('createdAt', 'desc')),
    snap => { poems = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderPoems(); syncOk(); },
    syncErr
  );

  unsubMsgs = onSnapshot(
    query(collection(db, 'messages'), orderBy('createdAt', 'asc')),
    snap => {
      const prev = messages.length;
      messages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderChat();
      if (messages.length > prev && !document.querySelector('[data-tab="chat"]').classList.contains('active'))
        document.getElementById('chat-notif').style.display = 'inline-block';
      syncOk();
    },
    syncErr
  );
}

// ═══════════════════════════════════════════
//  TABS
// ═══════════════════════════════════════════
window.switchTab = function (tab, silent) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  document.getElementById(`section-${tab}`).classList.add('active');

  if (tab === 'chat' && !silent) {
    document.getElementById('chat-notif').style.display = 'none';
    setTimeout(scrollChat, 100);
  }
};

// ═══════════════════════════════════════════
//  MODALS
// ═══════════════════════════════════════════
window.openModal  = id => document.getElementById(id).classList.add('open');
window.closeModal = id => document.getElementById(id).classList.remove('open');

// close on overlay click
document.querySelectorAll('.overlay').forEach(o =>
  o.addEventListener('click', e => { if (e.target === o) closeModal(o.id); })
);

// ═══════════════════════════════════════════
//  IMAGE PREVIEW
// ═══════════════════════════════════════════
window.previewImg = function (inputId, previewId) {
  const file = document.getElementById(inputId).files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const p = document.getElementById(previewId);
    p.src = e.target.result;
    p.style.display = 'block';
  };
  reader.readAsDataURL(file);
};

// ═══════════════════════════════════════════
//  BD — CRUD
// ═══════════════════════════════════════════
window.openAddBD = function () {
  ['f-bd-title','f-bd-author','f-bd-desc'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('f-bd-genre').value = '';
  document.getElementById('f-bd-preview').style.display = 'none';
  document.getElementById('f-bd-img').value = '';
  openModal('modal-add-bd');
};

window.saveBD = async function () {
  const title = document.getElementById('f-bd-title').value.trim();
  if (!title) { alert('Titre requis.'); return; }

  const imgEl = document.getElementById('f-bd-preview');
  try {
    await addDoc(collection(db, 'bds'), {
      title,
      author:    document.getElementById('f-bd-author').value.trim() || 'Inconnu',
      genre:     document.getElementById('f-bd-genre').value          || 'Autre',
      desc:      document.getElementById('f-bd-desc').value.trim(),
      img:       imgEl.src?.startsWith('data:') ? imgEl.src : null,
      addedBy:   currentUser,
      createdAt: serverTimestamp()
    });
    closeModal('modal-add-bd');
  } catch (e) { alert('Erreur : ' + e.message); }
};

function renderBDs () {
  const grid = document.getElementById('bd-grid');
  document.getElementById('bd-count').textContent = `${bds.length} titre(s)`;

  if (!bds.length) {
    grid.innerHTML = `<div class="empty"><div class="eico">📚</div><p>Aucune BD encore.</p></div>`;
    return;
  }

  grid.innerHTML = bds.map((b, i) => `
    <div class="bd-card" style="animation-delay:${i * .05}s" onclick="viewBD('${b.id}')">
      <div class="bd-thumb">
        ${b.img ? `<img src="${b.img}" alt=""/>` : '<span style="opacity:.3">📖</span>'}
      </div>
      <div class="bd-body">
        <div class="bd-card-title">${esc(b.title)}</div>
        <div class="bd-card-author">${esc(b.author)}</div>
        <span class="bd-genre-badge">${esc(b.genre)}</span>
      </div>
    </div>`).join('');
}

window.viewBD = function (id) {
  const b = bds.find(x => x.id === id);
  if (!b) return;
  document.getElementById('vbd-title').textContent = b.title;
  document.getElementById('vbd-cover').innerHTML   = b.img
    ? `<img src="${b.img}" alt=""/>`
    : '<span style="opacity:.2">📖</span>';
  document.getElementById('vbd-meta').innerHTML    = `<span>✍ ${esc(b.author)}</span><span>▸ ${esc(b.genre)}</span>`;
  document.getElementById('vbd-desc').textContent  = b.desc || 'Aucune description.';
  openModal('modal-view-bd');
};

// ═══════════════════════════════════════════
//  POEMS — CRUD
// ═══════════════════════════════════════════
window.openAddPoem = function () {
  ['f-p-title','f-p-author','f-p-tag','f-p-text'].forEach(id =>
    document.getElementById(id).value = ''
  );
  openModal('modal-add-poem');
};

window.savePoem = async function () {
  const title = document.getElementById('f-p-title').value.trim();
  const text  = document.getElementById('f-p-text').value.trim();
  if (!title || !text) { alert('Titre et texte requis.'); return; }

  try {
    await addDoc(collection(db, 'poems'), {
      title, text,
      author:    document.getElementById('f-p-author').value.trim() || 'Anonyme',
      tag:       document.getElementById('f-p-tag').value.trim()    || 'Poésie',
      addedBy:   currentUser,
      createdAt: serverTimestamp()
    });
    closeModal('modal-add-poem');
  } catch (e) { alert('Erreur : ' + e.message); }
};

function renderPoems () {
  const grid = document.getElementById('poem-grid');
  document.getElementById('poem-count').textContent = `${poems.length} poème(s)`;

  if (!poems.length) {
    grid.innerHTML = `<div class="empty"><div class="eico">✒️</div><p>Aucun poème encore.</p></div>`;
    return;
  }

  grid.innerHTML = poems.map((p, i) => `
    <div class="poem-card" style="animation-delay:${i * .05}s" onclick="viewPoem('${p.id}')">
      <div class="poem-num">${String(i + 1).padStart(2, '0')}</div>
      <div class="poem-info">
        <div class="poem-card-title">${esc(p.title)}</div>
        <p class="poem-card-excerpt">${esc(p.text)}</p>
      </div>
      <span class="poem-tag-pill">${esc(p.tag)}</span>
    </div>`).join('');
}

window.viewPoem = function (id) {
  const p = poems.find(x => x.id === id);
  if (!p) return;
  document.getElementById('vp-title').textContent  = p.title;
  document.getElementById('vp-meta').innerHTML     = `<span>✍ ${esc(p.author)}</span><span>🏷 ${esc(p.tag)}</span>`;
  document.getElementById('vp-text').textContent   = p.text;
  openModal('modal-view-poem');
};

// ═══════════════════════════════════════════
//  CHAT
// ═══════════════════════════════════════════
window.sendMessage = async function (type, refId) {
  const inp  = document.getElementById('chat-input');
  const text = inp.value.trim();
  if (!text && !type) return;

  let msgData = { from: currentUser, createdAt: serverTimestamp(), reactions: {} };

  if (type === 'bd') {
    const b = bds.find(x => x.id === refId);
    if (!b) return;
    Object.assign(msgData, {
      type: 'bd', refId,
      shareTitle: b.title, shareAuthor: b.author, shareImg: b.img || null
    });
    if (text) msgData.text = text;
  } else if (type === 'poem') {
    const p = poems.find(x => x.id === refId);
    if (!p) return;
    Object.assign(msgData, {
      type: 'poem', refId,
      shareTitle: p.title, shareExcerpt: p.text.slice(0, 80)
    });
    if (text) msgData.text = text;
  } else {
    msgData.type = 'text';
    msgData.text = text;
  }

  inp.value = '';
  inp.style.height = '';
  closePickers();

  try { await addDoc(collection(db, 'messages'), msgData); }
  catch (e) { alert('Erreur envoi : ' + e.message); }
};

function renderChat () {
  const container = document.getElementById('chat-messages');

  if (!messages.length) {
    container.innerHTML = `<div class="empty" style="margin:auto"><div class="eico">💬</div><p>Commencez la conversation…</p></div>`;
    return;
  }

  let html = '', lastDay = '';

  messages.forEach(msg => {
    const ts  = msg.createdAt?.toDate ? msg.createdAt.toDate() : new Date();
    const day = ts.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });

    if (day !== lastDay) {
      html += `<div class="chat-day-sep">${day}</div>`;
      lastDay = day;
    }

    const mine = msg.from === currentUser;
    const av   = msg.from === 'emilie' ? 'her-av' : 'mine-av';
    const init = msg.from === 'emilie' ? 'É' : 'M';
    const time = ts.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });

    let bubbleClass = 'msg-bubble', content = '';

    if (msg.type === 'bd') {
      bubbleClass += ' bd-share';
      content = `
        <span class="share-label">📚 BD partagée</span>
        <span class="share-title">${esc(msg.shareTitle)}</span>
        <span class="share-excerpt" style="font-style:normal">${esc(msg.shareAuthor || '')}</span>
        ${msg.text ? `<div style="margin-top:.5rem;font-size:.85rem;border-top:1px solid rgba(0,0,0,.1);padding-top:.4rem">${esc(msg.text)}</div>` : ''}
        <div style="margin-top:.5rem">
          <button onclick="viewBD('${msg.refId}')"
            style="background:var(--rust);color:#fff;border:none;padding:.3rem .7rem;font-family:'DM Mono',monospace;font-size:.6rem;cursor:pointer">
            Voir →
          </button>
        </div>`;
    } else if (msg.type === 'poem') {
      bubbleClass += ' poem-share';
      content = `
        <span class="share-label">✒️ Poème partagé</span>
        <span class="share-title">${esc(msg.shareTitle)}</span>
        <span class="share-excerpt">${esc(msg.shareExcerpt)}…</span>
        ${msg.text ? `<div style="margin-top:.5rem;font-size:.85rem;border-top:1px solid rgba(0,0,0,.1);padding-top:.4rem">${esc(msg.text)}</div>` : ''}
        <div style="margin-top:.5rem">
          <button onclick="viewPoem('${msg.refId}')"
            style="background:var(--gold);color:#fff;border:none;padding:.3rem .7rem;font-family:'DM Mono',monospace;font-size:.6rem;cursor:pointer">
            Lire →
          </button>
        </div>`;
    } else {
      content = esc(msg.text).replace(/\n/g, '<br>');
    }

    // reactions
    const reacts  = msg.reactions || {};
    const rHtml   = Object.entries(reacts)
      .filter(([, u]) => u.length)
      .map(([emoji, users]) =>
        `<span class="reaction-pill ${users.includes(currentUser) ? 'mine-reaction' : ''}"
           onclick="toggleReaction('${msg.id}','${emoji}')">
           ${emoji} ${users.length}
         </span>`
      ).join('');

    html += `
      <div class="msg-row ${mine ? 'mine' : 'her'}">
        <div class="msg-avatar ${av}">${init}</div>
        <div class="msg-bubble-wrap">
          <div class="${bubbleClass}">${content}</div>
          ${rHtml ? `<div class="msg-reactions">${rHtml}</div>` : ''}
          <div class="msg-meta">
            <span>${time}</span>
            <span style="cursor:pointer;opacity:.5" onclick="openReactModal('${msg.id}')">☺</span>
          </div>
        </div>
      </div>`;
  });

  const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 80;
  container.innerHTML = html;
  if (atBottom) scrollChat();
}

function scrollChat () {
  const c = document.getElementById('chat-messages');
  c.scrollTop = c.scrollHeight;
}

window.handleChatKey = function (e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
};

window.autoResize = function (el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
};

// ─── SHARE PICKERS ───
window.toggleSharePicker = function (id) {
  const bdPicker   = document.getElementById('bd-picker');
  const poemPicker = document.getElementById('poem-picker');
  const target     = document.getElementById(id);
  const isOpen     = target.classList.contains('open');

  bdPicker.classList.remove('open');
  poemPicker.classList.remove('open');

  if (!isOpen) {
    target.classList.add('open');
    id === 'bd-picker' ? populateBDPicker() : populatePoemPicker();
  }
};

function closePickers () {
  document.getElementById('bd-picker').classList.remove('open');
  document.getElementById('poem-picker').classList.remove('open');
}

function populateBDPicker () {
  const el = document.getElementById('bd-picker-list');
  if (!bds.length) {
    el.innerHTML = '<p style="font-family:\'DM Mono\',monospace;font-size:.65rem;color:var(--muted);padding:.3rem">Aucune BD.</p>';
    return;
  }
  el.innerHTML = bds.map(b =>
    `<div class="share-item" onclick="sendMessage('bd','${b.id}')">
       ${esc(b.title)}<small>${esc(b.author)}</small>
     </div>`
  ).join('');
}

function populatePoemPicker () {
  const el = document.getElementById('poem-picker-list');
  if (!poems.length) {
    el.innerHTML = '<p style="font-family:\'DM Mono\',monospace;font-size:.65rem;color:var(--muted);padding:.3rem">Aucun poème.</p>';
    return;
  }
  el.innerHTML = poems.map(p =>
    `<div class="share-item" onclick="sendMessage('poem','${p.id}')">
       ${esc(p.title)}<small>${esc(p.tag)}</small>
     </div>`
  ).join('');
}

// ─── REACTIONS ───
window.openReactModal = function (msgId) {
  reactingMsgId = msgId;
  document.getElementById('react-emojis').innerHTML = EMOJIS
    .map(e => `<span class="emoji-opt" onclick="pickReaction('${e}')">${e}</span>`)
    .join('');
  openModal('modal-react');
};

window.pickReaction = function (emoji) {
  toggleReaction(reactingMsgId, emoji);
  closeModal('modal-react');
};

window.toggleReaction = async function (msgId, emoji) {
  const msg = messages.find(m => m.id === msgId);
  if (!msg) return;

  const reactions = { ...msg.reactions || {} };
  reactions[emoji] = [...(reactions[emoji] || [])];

  const idx = reactions[emoji].indexOf(currentUser);
  if (idx > -1) reactions[emoji].splice(idx, 1);
  else          reactions[emoji].push(currentUser);

  try { await updateDoc(doc(db, 'messages', msgId), { reactions }); }
  catch (e) { console.error(e); }
};
