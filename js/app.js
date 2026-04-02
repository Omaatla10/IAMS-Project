'use strict';

/* ── Storage ── */
const DB = {
  get:  k      => JSON.parse(localStorage.getItem('iams_'+k)||'null'),
  set:  (k,v)  => localStorage.setItem('iams_'+k, JSON.stringify(v)),
  push: (k,v)  => { const a=DB.get(k)||[]; a.push(v); DB.set(k,a); return a; },
};

/* ── Auth ── */
const Auth = {
  current: ()   => DB.get('user'),
  login:   u    => DB.set('user', u),
  logout:  ()   => {
    DB.set('user',null);
    const inPages = window.location.pathname.includes('/pages/');
    window.location.href = inPages ? '../index.html' : 'index.html';
  },
  require: role => {
    const u = Auth.current();
    if (!u) { go('../pages/login.html'); return null; }
    if (role && u.role !== role) { go('../pages/login.html'); return null; }
    return u;
  }
};

/* ── Navigation helper ── */
function go(path) { window.location.href = path; }
function root() { return window.location.pathname.includes('/pages/') ? '../' : './'; }

/* ── Alert helper ── */
function showAlert(containerId, msg, type='info') {
  const c = document.getElementById(containerId);
  if (!c) return;
  const el = document.createElement('div');
  el.className = `alert alert-${type}`;
  el.innerHTML = `${msg}<button class="alert-dismiss" onclick="this.parentElement.remove()">✕</button>`;
  c.prepend(el);
  setTimeout(()=>el.remove(), 6000);
}

/* ── Sidebar toggle ── */
function initSidebar() {
  const toggle  = document.getElementById('sbToggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sbOverlay');
  if (!toggle||!sidebar) return;
  function open()  { sidebar.classList.add('open'); overlay?.classList.add('open'); document.body.style.overflow='hidden'; }
  function close() { sidebar.classList.remove('open'); overlay?.classList.remove('open'); document.body.style.overflow=''; }
  toggle.addEventListener('click', ()=> sidebar.classList.contains('open') ? close() : open());
  overlay?.addEventListener('click', close);
}

/* ── Render sidebar user info ── */
function renderSidebarUser() {
  const u = Auth.current();
  if (!u) return;
  const nameEl = document.getElementById('sbUserName');
  const roleEl = document.getElementById('sbUserRole');
  const avEl   = document.getElementById('sbUserAv');
  if (nameEl) nameEl.textContent = u.fullName || u.orgName || u.email.split('@')[0];
  if (roleEl) roleEl.textContent = u.role;
  if (avEl)   avEl.textContent   = u.role==='student'?'🎓': u.role==='organization'?'🏢':'⚙️';
  // Highlight active nav link
  const path = window.location.pathname.split('/').pop();
  document.querySelectorAll('.sb-link[data-page]').forEach(a => {
    if (a.dataset.page === path) a.classList.add('active');
  });
}

/* ── Split comma string ── */
function split(str) { return (str||'').split(',').map(s=>s.trim()).filter(Boolean); }

/* ── Matching algorithm ──
   Score = skill_overlap/org_required * 70
           + pref_bonus 20
           + gpa_bonus (max 10)
── */
function runMatching() {
  const students   = DB.get('students')      || [];
  const orgs       = DB.get('organizations') || [];
  const existing   = DB.get('placements')    || [];
  const placedIds  = new Set(existing.map(p=>p.studentId));
  const unmatched  = students.filter(s=>!placedIds.has(s.id));

  const cap = {};
  orgs.forEach(o => {
    const taken = existing.filter(p=>p.orgId===o.id).length;
    cap[o.id] = Math.max(0,(parseInt(o.positions)||1)-taken);
  });

  const newP = [];
  unmatched.forEach(s => {
    const sSkills = new Set(split(s.skills).map(x=>x.toLowerCase()));
    const sPrefs  = split(s.preferences).map(x=>x.toLowerCase());
    let best=null, bestScore=-1;

    orgs.forEach(o => {
      if ((cap[o.id]||0)<=0) return;
      const oSkills = split(o.requiredSkills);
      let skillScore = 10;
      if (sSkills.size && oSkills.length) {
        const overlap = oSkills.filter(sk=>sSkills.has(sk.toLowerCase())).length;
        skillScore = (overlap/oSkills.length)*70;
      }
      const pref    = sPrefs.includes((o.industry||'').toLowerCase()) ? 20 : 0;
      const gpa     = Math.min((parseFloat(s.gpa)||0)*2.5, 10);
      const score   = Math.min(Math.round(skillScore+pref+gpa), 100);
      if (score>bestScore) { bestScore=score; best=o; }
    });

    if (best) {
      newP.push({ id:'p_'+Date.now()+'_'+Math.random().toString(36).slice(2,6), studentId:s.id, orgId:best.id, score:bestScore, status:'pending', createdAt:new Date().toISOString() });
      cap[best.id]--;
    }
  });

  DB.set('placements', [...existing, ...newP]);
  return newP.length;
}

/* ── Seed demo data ── */
function seedDemo() {
  if (DB.get('seeded')) return;
  const orgs = [
    {id:'o1',userId:'uo1',email:'bih@example.com',orgName:'Botswana Innovation Hub',industry:'Technology',positions:'3',requiredSkills:'Python, JavaScript, SQL',contactPerson:'Dr. Keamogetse Ntshole',phone:'+267 3181 234',description:'A government-supported technology hub driving innovation across Botswana.',createdAt:new Date().toISOString()},
    {id:'o2',userId:'uo2',email:'mascom@example.com',orgName:'Mascom Wireless',industry:'Telecommunications',positions:'2',requiredSkills:'Networking, Linux, Python',contactPerson:'Tshepho Moagi',phone:'+267 3950 000',description:"Botswana's leading telecommunications provider with nationwide coverage.",createdAt:new Date().toISOString()},
    {id:'o3',userId:'uo3',email:'fnbb@example.com',orgName:'First National Bank Botswana',industry:'Finance',positions:'2',requiredSkills:'SQL, Excel, Data Analysis',contactPerson:'Mpho Selelo',phone:'+267 3677 000',description:"One of Botswana's largest commercial banks offering diverse financial services.",createdAt:new Date().toISOString()},
    {id:'o4',userId:'uo4',email:'bpc@example.com',orgName:'Botswana Power Corporation',industry:'Engineering',positions:'1',requiredSkills:'Python, AutoCAD, Electrical',contactPerson:'Lesego Phiri',phone:'+267 3603 000',description:'National utility responsible for power generation and distribution.',createdAt:new Date().toISOString()},
  ];
  const students = [
    {id:'s1',userId:'us1',email:'lasswell@ub.ac.bw',fullName:'Lasswell Mahosi',studentId:'202301477',department:'Computer Science',gpa:'3.7',skills:'Python, MySQL, JavaScript, HTML',preferences:'Technology, Finance',phone:'+267 71234567',createdAt:new Date().toISOString()},
    {id:'s2',userId:'us2',email:'jayson@ub.ac.bw',fullName:'Jayson Maleya',studentId:'202308195',department:'Computer Science',gpa:'3.4',skills:'Python, Networking, Linux',preferences:'Telecommunications, Technology',phone:'+267 72345678',createdAt:new Date().toISOString()},
    {id:'s3',userId:'us3',email:'kgotla@ub.ac.bw',fullName:'Kgotla Mogaetsho',studentId:'202005511',department:'Computer Science',gpa:'3.2',skills:'SQL, Excel, Data Analysis',preferences:'Finance, Technology',phone:'+267 73456789',createdAt:new Date().toISOString()},
    {id:'s4',userId:'us4',email:'ronald@ub.ac.bw',fullName:'Ronald Keoikantse Tumisang',studentId:'201502162',department:'Computer Science',gpa:'3.5',skills:'Python, SQL, JavaScript',preferences:'Technology, Engineering',phone:'+267 74567890',createdAt:new Date().toISOString()},
    {id:'s5',userId:'us5',email:'sipho@ub.ac.bw',fullName:'Siphosethu Tsela',studentId:'202300252',department:'Computer Science',gpa:'3.6',skills:'HTML, CSS, JavaScript, MySQL',preferences:'Technology',phone:'+267 75678901',createdAt:new Date().toISOString()},
    {id:'s6',userId:'us6',email:'omatla@ub.ac.bw',fullName:'Omatla Tendai Manyanda',studentId:'202004949',department:'Computer Science',gpa:'3.3',skills:'Python, AutoCAD, Electrical',preferences:'Engineering, Technology',phone:'+267 76789012',createdAt:new Date().toISOString()},
  ];
  const users = [
    {id:'uc1',email:'coordinator@ub.ac.bw',password:'coord123',role:'coordinator',fullName:'Dr. Thabo Molosiwa',staffId:'STAFF001',department:'Computer Science',phone:'+267 3554000'},
    ...orgs.map(o=>({id:o.userId,email:o.email,password:'org123',role:'organization',orgId:o.id})),
    ...students.map(s=>({id:s.userId,email:s.email,password:'student123',role:'student',studentId:s.id})),
  ];
  DB.set('organizations',orgs); DB.set('students',students); DB.set('users',users); DB.set('placements',[]); DB.set('seeded',true);
}

document.addEventListener('DOMContentLoaded',()=>{ seedDemo(); initSidebar(); renderSidebarUser(); });
