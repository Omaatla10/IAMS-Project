'use strict';

// ══════════════════════════════════════════════════
//  IAMS Release 2.0 — app.js
//  University of Botswana · CSI341
// ══════════════════════════════════════════════════

const SUPABASE_URL  = 'https://odmsergmblmoudxoyppq.supabase.co';
const SUPABASE_ANON = 'sb_publishable_x6-e27epf4HXE6OM2TAssg_bjPqxH1h';
const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

async function _q(fn) {
  try { const { data, error } = await fn(); if (error) throw error; return data || []; }
  catch(e) { console.error('Supabase:', e.message); return []; }
}

// ── AUTH ──────────────────────────────────────────
const Auth = {
  current: () => {
    const r = localStorage.getItem('iams_user');
    if (!r) return null;
    try { return JSON.parse(r); } catch { localStorage.removeItem('iams_user'); return null; }
  },
  login:  (u) => localStorage.setItem('iams_user', JSON.stringify(u)),
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

// ── LOGIN ─────────────────────────────────────────
async function loginUser(email, password) {
  const { data, error } = await _sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error('Incorrect email or password.');
  const uid = data.user.id;
  const profiles = await _q(() => _sb.from('profiles').select('*').eq('id', uid));
  const prof = profiles[0];
  if (!prof) throw new Error('Account not found. Please register.');
  let user = { id: uid, email, role: prof.role, avatar_url: prof.avatar_url || null };
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
  await logActivity('login', `Signed in as ${prof.role}`);
  return user;
}

// ── REGISTER ──────────────────────────────────────
async function registerUser(email, password, role) {
  const { data, error } = await _sb.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  const uid = data.user.id;
  await _q(() => _sb.from('profiles').insert({ id: uid, email, role }));
  let user = { id: uid, email, role };
  if (role === 'student') {
    const r = await _q(() => _sb.from('students').insert({ user_id: uid, email, full_name: '', student_id: '', department: '', gpa: '', skills: '', preferences: '', phone: '' }).select());
    if (r[0]) Object.assign(user, r[0], { id: uid });
  } else if (role === 'organization') {
    const r = await _q(() => _sb.from('organizations').insert({ user_id: uid, email, org_name: '', industry: '', positions: 1, required_skills: '', contact_person: '', phone: '', description: '' }).select());
    if (r[0]) Object.assign(user, r[0], { id: uid });
  } else if (role === 'coordinator') {
    const r = await _q(() => _sb.from('coordinators').insert({ user_id: uid, email, full_name: '', staff_id: 'STAFF' + uid.slice(-4).toUpperCase(), department: '', phone: '' }).select());
    if (r[0]) Object.assign(user, r[0], { id: uid });
  }
  Auth.login(user);
  return user;
}

// ── CHANGE PASSWORD [R2] ──────────────────────────
async function changePassword(newPassword) {
  const { error } = await _sb.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
  await logActivity('password_change', 'Password updated');
}

// ── DATA FETCHERS ─────────────────────────────────
async function getStudents()       { return _q(() => _sb.from('students').select('*').order('full_name')); }
async function getOrganizations()  { return _q(() => _sb.from('organizations').select('*').order('org_name')); }
async function getPlacements()     { return _q(() => _sb.from('placements').select('*')); }
async function getStudentByUserId(uid) { const r = await _q(() => _sb.from('students').select('*').eq('user_id', uid)); return r[0] || null; }
async function getOrgByUserId(uid)     { const r = await _q(() => _sb.from('organizations').select('*').eq('user_id', uid)); return r[0] || null; }
async function getCoordByUserId(uid)   { const r = await _q(() => _sb.from('coordinators').select('*').eq('user_id', uid)); return r[0] || null; }

// R2 — logbook / reports / assessments
async function getLogbooks(studentId)    { return _q(() => _sb.from('logbooks').select('*').eq('student_id', studentId).order('week_number')); }
async function getAllLogbooks()           { return _q(() => _sb.from('logbooks').select('*').order('created_at', { ascending: false })); }
async function submitLogbook(data)       { return _q(() => _sb.from('logbooks').insert(data).select()); }
async function updateLogbook(id, data)   { return _q(() => _sb.from('logbooks').update(data).eq('id', id).select()); }
async function getSupervisorReports(studentId) { return _q(() => _sb.from('supervisor_reports').select('*').eq('student_id', studentId)); }
async function getAllSupervisorReports()        { return _q(() => _sb.from('supervisor_reports').select('*')); }
async function submitSupervisorReport(data)    { return _q(() => _sb.from('supervisor_reports').insert(data).select()); }
async function getUniversityAssessments(studentId) { return _q(() => _sb.from('university_assessments').select('*').eq('student_id', studentId)); }
async function getAllAssessments()                  { return _q(() => _sb.from('university_assessments').select('*')); }
async function submitAssessment(data)               { return _q(() => _sb.from('university_assessments').insert(data).select()); }
async function updateAssessment(id, data)           { return _q(() => _sb.from('university_assessments').update(data).eq('id', id).select()); }
async function getFinalReports(studentId)  { return _q(() => _sb.from('final_reports').select('*').eq('student_id', studentId)); }
async function getAllFinalReports()         { return _q(() => _sb.from('final_reports').select('*')); }
async function submitFinalReport(data)     { return _q(() => _sb.from('final_reports').insert(data).select()); }

// R2 — notifications
async function getNotifications(uid)     { return _q(() => _sb.from('notifications').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(30)); }
async function markNotifRead(id)         { return _q(() => _sb.from('notifications').update({ is_read: true }).eq('id', id)); }
async function markAllNotifsRead(uid)    { return _q(() => _sb.from('notifications').update({ is_read: true }).eq('user_id', uid).eq('is_read', false)); }
async function createNotif(userId, title, message, type = 'info') {
  if (!userId) return;
  await _q(() => _sb.from('notifications').insert({ user_id: userId, title, message, type, is_read: false }));
}
async function getUnreadCount(uid) {
  try { const { count } = await _sb.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', uid).eq('is_read', false); return count || 0; }
  catch { return 0; }
}

// R2 — activity log
async function logActivity(action, details = '') {
  const u = Auth.current();
  if (!u) return;
  await _q(() => _sb.from('activity_log').insert({ user_id: u.id, role: u.role, action, details }));
}
async function getActivityLog(limit = 50) { return _q(() => _sb.from('activity_log').select('*').order('created_at', { ascending: false }).limit(limit)); }

// ── PROFILE SAVE ──────────────────────────────────
async function updateProfileMetadata(uid, fields) {
  if (!fields || !Object.keys(fields).length) return;
  await _q(() => _sb.from('profiles').update(fields).eq('id', uid));
}
async function saveStudentProfile(uid, data) {
  const existing = await getStudentByUserId(uid);
  if (existing) await _q(() => _sb.from('students').update(data).eq('user_id', uid));
  else await _q(() => _sb.from('students').insert({ user_id: uid, email: Auth.current()?.email || '', ...data }));
  if (data.avatar_url) await updateProfileMetadata(uid, { avatar_url: data.avatar_url });
  const u = await getStudentByUserId(uid);
  Auth.login({ ...Auth.current(), ...u, id: Auth.current().id });
  await logActivity('profile_update', 'Student profile updated');
}
async function saveOrgProfile(uid, data) {
  const existing = await getOrgByUserId(uid);
  if (existing) await _q(() => _sb.from('organizations').update(data).eq('user_id', uid));
  else await _q(() => _sb.from('organizations').insert({ user_id: uid, email: Auth.current()?.email || '', ...data }));
  if (data.avatar_url) await updateProfileMetadata(uid, { avatar_url: data.avatar_url });
  const u = await getOrgByUserId(uid);
  Auth.login({ ...Auth.current(), ...u, id: Auth.current().id });
  await logActivity('profile_update', 'Organization profile updated');
}
async function saveCoordProfile(uid, data) {
  const existing = await getCoordByUserId(uid);
  if (existing) await _q(() => _sb.from('coordinators').update(data).eq('user_id', uid));
  else await _q(() => _sb.from('coordinators').insert({ user_id: uid, email: Auth.current()?.email || '', ...data }));
  if (data.avatar_url) await updateProfileMetadata(uid, { avatar_url: data.avatar_url });
  const u = await getCoordByUserId(uid);
  Auth.login({ ...Auth.current(), ...u, id: Auth.current().id });
}

// ── FILE STORAGE ──────────────────────────────────
const STORAGE_BUCKET = 'user-assets';
async function uploadStorageFile(path, file) {
  const { data, error } = await _sb.storage.from(STORAGE_BUCKET).upload(path, file, { cacheControl: '3600', upsert: true });
  if (error) throw error;
  return _sb.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}
async function saveAvatar(uid, file) {
  const url = await uploadStorageFile(`avatars/${uid}.${file.name.split('.').pop()}`, file);
  await updateProfileMetadata(uid, { avatar_url: url });
  Auth.login({ ...Auth.current(), avatar_url: url });
  return url;
}
async function saveFinalReportFile(uid, file) {
  const url = await uploadStorageFile(`final-reports/${uid}_${Date.now()}.${file.name.split('.').pop()}`, file);
  return url;
}

// ── MATCHING ALGORITHM ────────────────────────────
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
      const pref  = sPrefs.includes((org.industry || '').toLowerCase()) ? 20 : 0;
      const gpa   = Math.min((parseFloat(student.gpa) || 0) * 2, 10);
      const score = Math.min(Math.round(ss + pref + gpa), 100);
      if (score > bestScore) { bestScore = score; best = org; }
    });
    if (best) { inserts.push({ student_id: student.id, org_id: best.id, score: bestScore, status: 'pending', user_id: student.user_id }); cap[best.id]--; }
  });
  if (inserts.length > 0) {
    await _q(() => _sb.from('placements').insert(inserts.map(i => ({ student_id: i.student_id, org_id: i.org_id, score: i.score, status: i.status }))));
    for (const ins of inserts) {
      const org = orgs.find(o => o.id === ins.org_id);
      await createNotif(ins.user_id, '🎯 Placement Match Found', `You have been matched to ${org?.org_name || 'an organization'} with a score of ${ins.score}%. Awaiting coordinator confirmation.`, 'info');
    }
    await logActivity('run_matching', `Matched ${inserts.length} students`);
  }
  return inserts.length;
}

async function confirmPlacement(id) {
  await _q(() => _sb.from('placements').update({ status: 'confirmed' }).eq('id', id));
  const rows = await _q(() => _sb.from('placements').select('*').eq('id', id));
  const p = rows[0];
  if (p) {
    const stu = (await getStudents()).find(x => x.id === p.student_id);
    const org = (await getOrganizations()).find(x => x.id === p.org_id);
    if (stu) await createNotif(stu.user_id, '✅ Placement Confirmed', `Your placement at ${org?.org_name || 'the organization'} has been confirmed by the coordinator.`, 'success');
  }
  await logActivity('confirm_placement', `Confirmed placement ${id}`);
}

async function rejectPlacement(id, reason = '') {
  await _q(() => _sb.from('placements').update({ status: 'rejected', rejection_reason: reason }).eq('id', id));
  const rows = await _q(() => _sb.from('placements').select('*').eq('id', id));
  const p = rows[0];
  if (p) {
    const stu = (await getStudents()).find(x => x.id === p.student_id);
    const org = (await getOrganizations()).find(x => x.id === p.org_id);
    if (stu) await createNotif(stu.user_id, '⚠️ Placement Update', `Your placement at ${org?.org_name || 'the organization'} has been updated. ${reason ? 'Reason: ' + reason : 'Contact your coordinator.'}`, 'warning');
  }
  await logActivity('reject_placement', `Rejected placement. Reason: ${reason}`);
}

async function clearPlacements() {
  await _q(() => _sb.from('placements').delete().neq('id', '00000000-0000-0000-0000-000000000000'));
  await logActivity('clear_placements', 'All placements cleared');
}

// ── CSV EXPORT [R2] ───────────────────────────────
async function exportPlacementsCSV() {
  const [placements, students, orgs] = await Promise.all([getPlacements(), getStudents(), getOrganizations()]);
  const rows = [['Student Name','Student ID','Department','GPA','Organization','Industry','Score','Status']];
  placements.forEach(p => {
    const s = students.find(x => x.id === p.student_id);
    const o = orgs.find(x => x.id === p.org_id);
    rows.push([s?.full_name||'', s?.student_id||'', s?.department||'', s?.gpa||'', o?.org_name||'', o?.industry||'', p.score||'', p.status||'']);
  });
  dlCSV(rows, 'IAMS_Placements');
  await logActivity('export_csv', `Exported ${placements.length} placements`);
}
async function exportStudentsCSV() {
  const [students, placements, orgs] = await Promise.all([getStudents(), getPlacements(), getOrganizations()]);
  const rows = [['Full Name','Student ID','Email','Department','GPA','Skills','Preferences','Phone','Placed At','Status']];
  students.forEach(s => {
    const p = placements.find(x => x.student_id === s.id);
    const o = p ? orgs.find(x => x.id === p.org_id) : null;
    rows.push([s.full_name||'', s.student_id||'', s.email||'', s.department||'', s.gpa||'', s.skills||'', s.preferences||'', s.phone||'', o?.org_name||'Unmatched', p?.status||'—']);
  });
  dlCSV(rows, 'IAMS_Students');
}
function dlCSV(rows, name) {
  const csv = rows.map(r => r.map(c => `"${String(c||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `${name}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

// ── NOTIFICATION BADGE ────────────────────────────
async function updateNotifBadge() {
  const u = Auth.current();
  if (!u) return;
  const count = await getUnreadCount(u.id);
  document.querySelectorAll('.notif-badge').forEach(el => {
    el.textContent = count || '';
    el.style.display = count > 0 ? 'inline-flex' : 'none';
  });
}

// ── HELPERS ───────────────────────────────────────
function split(str) { return (str || '').split(',').map(s => s.trim()).filter(Boolean); }
function go(path)   { window.location.href = path; }
function esc(s)     { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function relTime(d) {
  if (!d) return '—';
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff/60000), h = Math.floor(m/60), dy = Math.floor(h/24);
  if (dy > 0) return `${dy}d ago`; if (h > 0) return `${h}h ago`; if (m > 0) return `${m}m ago`; return 'just now';
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

function showAlert(containerId, msg, type = 'info') {
  const c = document.getElementById(containerId);
  if (!c) return;
  const el = document.createElement('div');
  el.className = `alert alert-${type}`;
  el.innerHTML = `${msg}<button class="alert-dismiss" onclick="this.parentElement.remove()">×</button>`;
  c.prepend(el);
  setTimeout(() => el?.remove(), 7000);
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
  if (nameEl) nameEl.textContent = u.full_name || u.org_name || u.email?.split('@')[0];
  if (roleEl) roleEl.textContent = u.role;
  if (avEl) {
    if (u.avatar_url) avEl.innerHTML = `<img src="${u.avatar_url}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`;
    else avEl.textContent = u.role === 'student' ? 'S' : u.role === 'organization' ? 'O' : 'C';
  }
  const path = window.location.pathname.split('/').pop();
  document.querySelectorAll('.sb-link[data-page]').forEach(a => { if (a.dataset.page === path) a.classList.add('active'); });
}

document.addEventListener('DOMContentLoaded', () => { initSidebar(); renderSidebarUser(); });
