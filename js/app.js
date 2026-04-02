'use strict';

const SUPABASE_URL  = 'https://odmsergmblmoudxoyppq.supabase.co';
const SUPABASE_ANON = 'sb_publishable_x6-e27epf4HXE6OM2TAssg_bjPqxH1h';

const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

async function _q(fn) {
  try { const { data, error } = await fn(); if (error) throw error; return data || []; }
  catch(e) { console.error('Supabase:', e.message); return []; }
}

// ════════════════════════════════════════════
//  AUTH
// ════════════════════════════════════════════
const Auth = {
  current: () => { const r = localStorage.getItem('iams_user'); return r ? JSON.parse(r) : null; },
  login:   (u) => localStorage.setItem('iams_user', JSON.stringify(u)),
  logout: async () => {
    await _sb.auth.signOut();
    localStorage.removeItem('iams_user');
    const inPages = window.location.pathname.includes('/pages/');
    window.location.href = inPages ? '../index.html' : 'index.html';
  },
  require: (role) => {
    const u = Auth.current();
    if (!u) { window.location.href = '../pages/login.html'; return null; }
    if (role && u.role !== role) { window.location.href = '../pages/login.html'; return null; }
    return u;
  }
};

// ════════════════════════════════════════════
//  LOGIN
// ════════════════════════════════════════════
async function loginUser(email, password) {
  const { data, error } = await _sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error('Incorrect email or password.');
  const uid = data.user.id;
  const profiles = await _q(() => _sb.from('profiles').select('*').eq('id', uid));
  const prof = profiles[0];
  if (!prof) throw new Error('Account not found. Please register.');
  let user = { id: uid, email, role: prof.role };
  if (prof.role === 'student') {
    const r = await _q(() => _sb.from('students').select('*').eq('user_id', uid));
    if (r[0]) Object.assign(user, r[0], { id: uid });
  } else if (prof.role === 'organization') {
    const r = await _q(() => _sb.from('organizations').select('*').eq('user_id', uid));
    if (r[0]) Object.assign(user, r[0], { id: uid });
  } else if (prof.role === 'coordinator') {
    const r = await _q(() => _sb.from('coordinators').select('*').eq('user_id', uid));
    if (r[0]) Object.assign(user, r[0], { id: uid });
  }
  Auth.login(user);
  return user;
}

// ════════════════════════════════════════════
//  REGISTER
// ════════════════════════════════════════════
async function registerUser(email, password, role) {
  const { data, error } = await _sb.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  const uid = data.user.id;
  await _q(() => _sb.from('profiles').insert({ id: uid, email, role }));
  let user = { id: uid, email, role };
  if (role === 'student') {
    const r = await _q(() => _sb.from('students').insert({ user_id: uid, email, full_name: '', student_id: 'STU' + uid.slice(-6), department: '', gpa: '', skills: '', preferences: '', phone: '' }).select());
    if (r[0]) Object.assign(user, r[0], { id: uid });
  } else if (role === 'organization') {
    const r = await _q(() => _sb.from('organizations').insert({ user_id: uid, email, org_name: '', industry: '', positions: 1, required_skills: '', contact_person: '', phone: '', description: '' }).select());
    if (r[0]) Object.assign(user, r[0], { id: uid });
  } else if (role === 'coordinator') {
    const r = await _q(() => _sb.from('coordinators').insert({ user_id: uid, email, full_name: '', staff_id: 'STAFF' + uid.slice(-4), department: '', phone: '' }).select());
    if (r[0]) Object.assign(user, r[0], { id: uid });
  }
  Auth.login(user);
  return user;
}

// ════════════════════════════════════════════
//  DATA FETCHERS
// ════════════════════════════════════════════
async function getStudents()      { return _q(() => _sb.from('students').select('*').order('full_name')); }
async function getOrganizations() { return _q(() => _sb.from('organizations').select('*').order('org_name')); }
async function getPlacements()    { return _q(() => _sb.from('placements').select('*')); }
async function getStudentByUserId(uid) { const r = await _q(() => _sb.from('students').select('*').eq('user_id', uid)); return r[0] || null; }
async function getOrgByUserId(uid)     { const r = await _q(() => _sb.from('organizations').select('*').eq('user_id', uid)); return r[0] || null; }
async function getCoordByUserId(uid)   { const r = await _q(() => _sb.from('coordinators').select('*').eq('user_id', uid)); return r[0] || null; }

// ════════════════════════════════════════════
//  PROFILE SAVE
// ════════════════════════════════════════════
async function saveStudentProfile(uid, data) {
  await _q(() => _sb.from('students').update(data).eq('user_id', uid));
  const u = await getStudentByUserId(uid);
  Auth.login({ ...Auth.current(), ...u, id: Auth.current().id });
}
async function saveOrgProfile(uid, data) {
  await _q(() => _sb.from('organizations').update(data).eq('user_id', uid));
  const u = await getOrgByUserId(uid);
  Auth.login({ ...Auth.current(), ...u, id: Auth.current().id });
}
async function saveCoordProfile(uid, data) {
  await _q(() => _sb.from('coordinators').update(data).eq('user_id', uid));
  const u = await getCoordByUserId(uid);
  Auth.login({ ...Auth.current(), ...u, id: Auth.current().id });
}

// ════════════════════════════════════════════
//  MATCHING ALGORITHM
// ════════════════════════════════════════════
async function runMatching() {
  const students = await getStudents();
  const orgs     = await getOrganizations();
  const existing = await getPlacements();
  const placedIds = new Set(existing.map(p => p.student_id));
  const unmatched = students.filter(s => !placedIds.has(s.id));
  const cap = {};
  orgs.forEach(o => { const taken = existing.filter(p => p.org_id === o.id).length; cap[o.id] = Math.max(0, (parseInt(o.positions) || 1) - taken); });
  const inserts = [];
  unmatched.forEach(student => {
    const sSkills = new Set(split(student.skills).map(x => x.toLowerCase()));
    const sPrefs  = split(student.preferences).map(x => x.toLowerCase());
    let best = null, bestScore = -1;
    orgs.forEach(org => {
      if ((cap[org.id] || 0) <= 0) return;
      const oSkills = split(org.required_skills);
      let ss = 10;
      if (sSkills.size && oSkills.length) { const ov = oSkills.filter(sk => sSkills.has(sk.toLowerCase())).length; ss = (ov / oSkills.length) * 70; }
      const pref = sPrefs.includes((org.industry || '').toLowerCase()) ? 20 : 0;
      const gpa  = Math.min((parseFloat(student.gpa) || 0) * 2.5, 10);
      const score = Math.min(Math.round(ss + pref + gpa), 100);
      if (score > bestScore) { bestScore = score; best = org; }
    });
    if (best) { inserts.push({ student_id: student.id, org_id: best.id, score: bestScore, status: 'pending' }); cap[best.id]--; }
  });
  if (inserts.length > 0) await _q(() => _sb.from('placements').insert(inserts));
  return inserts.length;
}

async function confirmPlacement(id) { await _q(() => _sb.from('placements').update({ status: 'confirmed' }).eq('id', id)); }
async function clearPlacements()    { await _q(() => _sb.from('placements').delete().neq('id', '00000000-0000-0000-0000-000000000000')); }

// ════════════════════════════════════════════
//  SHARED HELPERS
// ════════════════════════════════════════════
function split(str) { return (str || '').split(',').map(s => s.trim()).filter(Boolean); }
function go(path)   { window.location.href = path; }

function showAlert(containerId, msg, type = 'info') {
  const c = document.getElementById(containerId);
  if (!c) return;
  const el = document.createElement('div');
  el.className = `alert alert-${type}`;
  el.innerHTML = `${msg}<button class="alert-dismiss" onclick="this.parentElement.remove()">✕</button>`;
  c.prepend(el);
  setTimeout(() => el.remove(), 6000);
}

function initSidebar() {
  const toggle  = document.getElementById('sbToggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sbOverlay');
  if (!toggle || !sidebar) return;
  const open  = () => { sidebar.classList.add('open');    overlay?.classList.add('open');    document.body.style.overflow = 'hidden'; };
  const close = () => { sidebar.classList.remove('open'); overlay?.classList.remove('open'); document.body.style.overflow = ''; };
  toggle.addEventListener('click', () => sidebar.classList.contains('open') ? close() : open());
  overlay?.addEventListener('click', close);
}

function renderSidebarUser() {
  const u = Auth.current();
  if (!u) return;
  const nameEl = document.getElementById('sbUserName');
  const roleEl = document.getElementById('sbUserRole');
  const avEl   = document.getElementById('sbUserAv');
  if (nameEl) nameEl.textContent = u.full_name || u.org_name || u.fullName || u.orgName || u.email?.split('@')[0];
  if (roleEl) roleEl.textContent = u.role;
  if (avEl)   avEl.textContent   = u.role === 'student' ? '🎓' : u.role === 'organization' ? '🏢' : '⚙️';
  const path = window.location.pathname.split('/').pop();
  document.querySelectorAll('.sb-link[data-page]').forEach(a => { if (a.dataset.page === path) a.classList.add('active'); });
}

document.addEventListener('DOMContentLoaded', () => { initSidebar(); renderSidebarUser(); });
