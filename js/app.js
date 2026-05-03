'use strict';

// ══════════════════════════════════════════════════
//  IAMS Release 2.0 — app.js  (UPDATED)
//  University of Botswana · CSI341
//  Fixes:
//    • registerUser: no coordinator self-registration;
//      orgs register as 'pending', save security Q/A
//    • confirmPlacement: notifies org (US-13)
//    • rejectPlacement / revokePlacement: robust re-fetch
//    • forgotPassword helpers: security Q lookup + verify
//    • Org approval workflow: approveOrg / rejectOrgRegistration
//    • Notifications fired for: placement confirmed to org,
//      org approved/rejected, logbook submitted, final report in,
//      supervisor report submitted
//    • updateNotifBadge: auto-refreshes on every page load
// ══════════════════════════════════════════════════

const SUPABASE_URL  = 'https://odmsergmblmoudxoyppq.supabase.co';
const SUPABASE_ANON = 'sb_publishable_x6-e27epf4HXE6OM2TAssg_bjPqxH1h';
const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

async function _q(fn) {
  try {
    const { data, error } = await fn();
    if (error) {
      console.error('Supabase error:', error.code, error.message, error.details);
      throw error;
    }
    return data || [];
  } catch(e) {
    console.error('Supabase query failed:', e.message);
    return [];
  }
}
async function _qOne(fn) {
  const rows = await _q(fn);
  return rows[0] || null;
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

  // ── FIX: use the session token explicitly so RLS resolves correctly ──
  // Give the client one tick to register the session before querying
  await new Promise(r => setTimeout(r, 100));

  const prof = await _qOne(() => _sb.from('profiles').select('*').eq('id', uid));
  if (!prof) throw new Error('Account not found. Please register.');

  // Block pending / rejected organisation accounts
  if (prof.role === 'organization' && prof.registration_status === 'pending') {
    await _sb.auth.signOut();
    throw new Error('Your organisation registration is awaiting coordinator approval.');
  }
  if (prof.role === 'organization' && prof.registration_status === 'rejected') {
    await _sb.auth.signOut();
    throw new Error('Your organisation registration was not approved. Please contact the coordinator.');
  }

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
// NOTE: Coordinator registration is disabled on the public form.
// This function still supports coordinator only for internal/admin use.
async function registerUser(email, password, role, extras = {}) {
  // Block coordinator self-registration via public form
  if (role === 'coordinator') {
    throw new Error('Coordinator accounts are created by the system administrator. Please contact the coordinator to get access.');
  }

  const { data, error } = await _sb.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  const uid = data.user.id;

  const profileStatus = (role === 'organization') ? 'pending' : 'active';

  await _q(() => _sb.from('profiles').insert({
    id: uid,
    email,
    role,
    registration_status: profileStatus,
    security_question:   extras.security_question  || '',
    security_answer:     (extras.security_answer   || '').toLowerCase().trim()
  }));

  let user = { id: uid, email, role };

  if (role === 'student') {
    const r = await _q(() => _sb.from('students').insert({
      user_id:             uid,
      email,
      full_name:           '',
      student_id:          '',
      department:          '',
      gpa:                 '',
      skills:              '',
      preferences:         '',
      location_preference: extras.location_preference || '',
      phone:               '',
      cv_url:              extras.cv_url              || null,
      transcript_url:      extras.transcript_url      || null
    }).select());
    if (r[0]) Object.assign(user, r[0], { id: uid });
    Auth.login(user);
    return user;
  }

  if (role === 'organization') {
    const r = await _q(() => _sb.from('organizations').insert({
      user_id:             uid,
      email,
      org_name:            '',
      industry:            '',
      positions:           1,
      required_skills:     '',
      contact_person:      '',
      phone:               '',
      description:         '',
      registration_status: 'pending'
    }).select());
    if (r[0]) Object.assign(user, r[0], { id: uid });

    // Notify all coordinators of the pending org registration
    const coords = await _q(() => _sb.from('coordinators').select('user_id'));
    for (const c of coords) {
      if (c.user_id) {
        await createNotif(
          c.user_id,
          '🏢 New Organisation Registration',
          `A new organisation has registered and is awaiting your approval. Email: ${email}`,
          'info'
        );
      }
    }
    // Do NOT log in pending org — they must wait for approval
    user.registration_status = 'pending';
    return user;
  }

  Auth.login(user);
  return user;
}

// ── CHANGE PASSWORD (logged-in user) ─────────────
async function changePassword(newPassword) {
  const { error } = await _sb.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
  await logActivity('password_change', 'Password updated');
}

// ── FORGOT PASSWORD — security question helpers ───
async function getSecurityQuestion(email) {
  // Returns the security question for a given email, or null if not found.
  // profiles table has an anon-read policy so this works unauthenticated.
  const row = await _qOne(() =>
    _sb.from('profiles').select('security_question').eq('email', email.trim().toLowerCase())
  );
  return row?.security_question || null;
}

async function verifySecurityAnswer(email, answer) {
  // Returns true if the answer matches (case-insensitive).
  const row = await _qOne(() =>
    _sb.from('profiles').select('security_answer').eq('email', email.trim().toLowerCase())
  );
  if (!row) return false;
  return (row.security_answer || '').toLowerCase().trim() === answer.toLowerCase().trim();
}

async function submitPasswordResetRequest(email, newPassword) {
  // Upsert a verified reset request.
  const { error } = await _sb.from('password_reset_requests').upsert(
    {
      email:              email.trim().toLowerCase(),
      new_password:       newPassword,
      status:             'pending',
      security_verified:  true,
      requested_at:       new Date().toISOString()
    },
    { onConflict: 'email' }
  );
  if (error) throw new Error(error.message);

  // Notify coordinators of the request
  const coords = await _q(() => _sb.from('coordinators').select('user_id'));
  for (const c of coords) {
    if (c.user_id) {
      await createNotif(
        c.user_id,
        '🔑 Password Reset Request',
        `A user (${email}) has submitted a security-verified password reset request. Please action it in Reports → Password Resets.`,
        'warning'
      );
    }
  }
}

// ── DATA FETCHERS ─────────────────────────────────
async function getStudents()                 { return _q(() => _sb.from('students').select('*').order('full_name')); }
async function getOrganizations()            { return _q(() => _sb.from('organizations').select('*').eq('registration_status','active').order('org_name')); }
async function getAllOrganizations()         { return _q(() => _sb.from('organizations').select('*').order('org_name')); }
async function getPendingOrganizations()     { return _q(() => _sb.from('organizations').select('*').eq('registration_status','pending').order('created_at', { ascending: false })); }
async function getPlacements()               { return _q(() => _sb.from('placements').select('*')); }
async function getStudentByUserId(uid)       { return _qOne(() => _sb.from('students').select('*').eq('user_id', uid)); }
async function getOrgByUserId(uid)           { return _qOne(() => _sb.from('organizations').select('*').eq('user_id', uid)); }
async function getCoordByUserId(uid)         { return _qOne(() => _sb.from('coordinators').select('*').eq('user_id', uid)); }

// ── ORG APPROVAL WORKFLOW ─────────────────────────
async function approveOrganization(orgId) {
  // Update both the organizations table and the linked profiles row
  const org = await _qOne(() => _sb.from('organizations').select('*').eq('id', orgId));
  if (!org) return;

  await _q(() => _sb.from('organizations').update({ registration_status: 'active' }).eq('id', orgId));
  await _q(() => _sb.from('profiles').update({ registration_status: 'active' }).eq('id', org.user_id));

  // Notify the organisation
  await createNotif(
    org.user_id,
    '✅ Registration Approved',
    'Your organisation registration has been approved by the coordinator. You can now sign in and complete your profile.',
    'success'
  );
  await logActivity('approve_org', `Approved organisation: ${org.org_name || org.email}`);
}

async function rejectOrganizationRegistration(orgId, reason = '') {
  const org = await _qOne(() => _sb.from('organizations').select('*').eq('id', orgId));
  if (!org) return;

  await _q(() => _sb.from('organizations').update({ registration_status: 'rejected', rejection_note: reason }).eq('id', orgId));
  await _q(() => _sb.from('profiles').update({ registration_status: 'rejected' }).eq('id', org.user_id));

  await createNotif(
    org.user_id,
    '❌ Registration Not Approved',
    `Your organisation registration was not approved.${reason ? ' Reason: ' + reason : ''} Please contact the coordinator for more information.`,
    'error'
  );
  await logActivity('reject_org', `Rejected organisation: ${org.org_name || org.email}. Reason: ${reason}`);
}

// R2 — logbook / reports / assessments
async function getLogbooks(studentId)             { return _q(() => _sb.from('logbooks').select('*').eq('student_id', studentId).order('week_number')); }
async function getAllLogbooks()                    { return _q(() => _sb.from('logbooks').select('*').order('created_at', { ascending: false })); }
async function submitLogbook(data)                { return _q(() => _sb.from('logbooks').insert(data).select()); }
async function updateLogbook(id, data)            { return _q(() => _sb.from('logbooks').update(data).eq('id', id).select()); }
async function getSupervisorReports(studentId)    { return _q(() => _sb.from('supervisor_reports').select('*').eq('student_id', studentId)); }
async function getAllSupervisorReports()           { return _q(() => _sb.from('supervisor_reports').select('*')); }
async function getUniversityAssessments(studentId){ return _q(() => _sb.from('university_assessments').select('*').eq('student_id', studentId)); }
async function getAllAssessments()                 { return _q(() => _sb.from('university_assessments').select('*')); }
async function getFinalReports(studentId)         { return _q(() => _sb.from('final_reports').select('*').eq('student_id', studentId)); }
async function getAllFinalReports()                { return _q(() => _sb.from('final_reports').select('*')); }

// Logbook submit — fires notification to org supervisor + coordinator
async function submitLogbookEntry(data) {
  const rows = await _q(() => _sb.from('logbooks').insert(data).select());
  const entry = rows[0];
  if (!entry) return rows;

  // Notify organization supervisor
  const placements = await _q(() =>
    _sb.from('placements').select('org_id').eq('student_id', data.student_id).eq('status','confirmed')
  );
  if (placements[0]) {
    const org = await _qOne(() => _sb.from('organizations').select('user_id, org_name').eq('id', placements[0].org_id));
    if (org?.user_id) {
      const student = await _qOne(() => _sb.from('students').select('full_name').eq('id', data.student_id));
      await createNotif(
        org.user_id,
        '📋 New Logbook Entry',
        `${student?.full_name || 'A student'} has submitted Week ${data.week_number} logbook entry for your review.`,
        'info'
      );
    }
  }
  // Notify coordinator
  const coords = await _q(() => _sb.from('coordinators').select('user_id'));
  for (const c of coords) {
    if (c.user_id) {
      const student = await _qOne(() => _sb.from('students').select('full_name').eq('id', data.student_id));
      await createNotif(
        c.user_id,
        '📋 Logbook Submitted',
        `${student?.full_name || 'A student'} submitted Week ${data.week_number} logbook.`,
        'info'
      );
    }
  }
  return rows;
}

// Final report submit — fires notification to coordinator
async function submitFinalReport(data) {
  const rows = await _q(() => _sb.from('final_reports').insert(data).select());
  const report = rows[0];
  if (!report) return rows;

  const student = await _qOne(() => _sb.from('students').select('full_name').eq('id', data.student_id));
  const coords = await _q(() => _sb.from('coordinators').select('user_id'));
  for (const c of coords) {
    if (c.user_id) {
      await createNotif(
        c.user_id,
        '📄 Final Report Submitted',
        `${student?.full_name || 'A student'} has submitted their final attachment report.`,
        'success'
      );
    }
  }
  return rows;
}

// Supervisor report submit — fires notification to student + coordinator
async function submitSupervisorReport(data) {
  const rows = await _q(() => _sb.from('supervisor_reports').insert(data).select());
  const report = rows[0];
  if (!report) return rows;

  const student = await _qOne(() => _sb.from('students').select('user_id, full_name').eq('id', data.student_id));
  if (student?.user_id) {
    await createNotif(
      student.user_id,
      '📝 Supervisor Report Submitted',
      'Your industrial supervisor has submitted a performance report for you. You can view it in your dashboard.',
      'info'
    );
  }
  const coords = await _q(() => _sb.from('coordinators').select('user_id'));
  for (const c of coords) {
    if (c.user_id) {
      await createNotif(
        c.user_id,
        '📝 Supervisor Report In',
        `A supervisor report has been submitted for ${student?.full_name || 'a student'}.`,
        'info'
      );
    }
  }
  return rows;
}

// Assessment submitted — notify student
async function submitAssessment(data) {
  const rows = await _q(() => _sb.from('university_assessments').insert(data).select());
  const assessment = rows[0];
  if (!assessment) return rows;

  const student = await _qOne(() => _sb.from('students').select('user_id, full_name').eq('id', data.student_id));
  if (student?.user_id) {
    await createNotif(
      student.user_id,
      '🎓 University Assessment Recorded',
      `A university site visit assessment (Visit ${data.visit_number}) has been recorded for you. Check your results.`,
      'success'
    );
  }
  return rows;
}
async function updateAssessment(id, data) { return _q(() => _sb.from('university_assessments').update(data).eq('id', id).select()); }

// R2 — notifications
async function getNotifications(uid)  { return _q(() => _sb.from('notifications').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(50)); }
async function markNotifRead(id)      { return _q(() => _sb.from('notifications').update({ is_read: true }).eq('id', id)); }
async function markAllNotifsRead(uid) { return _q(() => _sb.from('notifications').update({ is_read: true }).eq('user_id', uid).eq('is_read', false)); }

async function createNotif(userId, title, message, type = 'info', extras = {}) {
  if (!userId) return;
  const base = { user_id: userId, title, message, type, is_read: false };
  const payload = { ...base, ...extras };
  const { error } = await _sb.from('notifications').insert(payload);
  if (!error) return true;
  if (Object.keys(extras).length) {
    const retry = await _sb.from('notifications').insert(base);
    if (!retry.error) return true;
    console.error('Supabase notif:', retry.error.message);
    return false;
  }
  console.error('Supabase notif:', error.message);
  return false;
}

async function getUnreadCount(uid) {
  try {
    const { count } = await _sb.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', uid).eq('is_read', false);
    return count || 0;
  } catch { return 0; }
}

// R2 - due date reminders
async function getDueDateReminders(limit = 20) {
  return _q(() => _sb.from('due_date_reminders').select('*').order('due_date', { ascending: true }).limit(limit));
}
async function getUpcomingDueDateReminders(limit = 5) {
  const today = new Date().toISOString().slice(0, 10);
  return _q(() => _sb.from('due_date_reminders').select('*').gte('due_date', today).order('due_date', { ascending: true }).limit(limit));
}
async function createDueDateReminder(data) {
  const { data: rows, error } = await _sb.from('due_date_reminders').insert(data).select();
  if (error) { console.warn('Due date reminder table unavailable:', error.message); return null; }
  return rows?.[0] || null;
}
async function getNotificationForReminder(userId, reminderId) {
  if (!reminderId) return null;
  const rows = await _q(() => _sb.from('notifications').select('id').eq('user_id', userId).eq('reminder_id', reminderId).limit(1));
  return rows[0] || null;
}
async function sendDueDateReminderToStudents(reminder, students = null) {
  if (!reminder) return 0;
  const list = students || await getStudents();
  let sent = 0;
  for (const student of list) {
    if (!student.user_id) continue;
    const existing = await getNotificationForReminder(student.user_id, reminder.id);
    if (existing) continue;
    const due  = fmtDate(reminder.due_date);
    const body = `${reminder.message || 'Please complete the required task before the due date.'} Due date: ${due}.`;
    const extras = reminder.id ? { reminder_id: reminder.id, due_date: reminder.due_date } : { due_date: reminder.due_date };
    const ok = await createNotif(student.user_id, reminder.title, body, 'warning', extras);
    if (ok) sent++;
  }
  return sent;
}
async function createAndSendDueDateReminder(data) {
  const savedReminder = await createDueDateReminder(data);
  const reminder = savedReminder || { ...data, id: null, created_at: new Date().toISOString() };
  const sent = await sendDueDateReminderToStudents(reminder);
  await logActivity('send_due_reminder', `${data.title} due ${data.due_date} sent to ${sent} student(s)`);
  return { reminder, sent, saved: !!savedReminder };
}
function daysUntil(d) {
  if (!d) return null;
  const target = new Date(`${d}T00:00:00`);
  const today  = new Date(); today.setHours(0,0,0,0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}
function dueDateLabel(d) {
  const days = daysUntil(d);
  if (days === null) return 'No due date';
  if (days <  0) return `${Math.abs(days)} day${Math.abs(days)===1?'':'s'} overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}

// R2 — activity log
async function logActivity(action, details = '') {
  const u = Auth.current();
  if (!u) return;
  await _q(() => _sb.from('activity_log').insert({ user_id: u.id, role: u.role, action, details }));
}
async function getActivityLog(limit = 50) {
  return _q(() => _sb.from('activity_log').select('*').order('created_at', { ascending: false }).limit(limit));
}

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
  if (data.security_question !== undefined) await updateProfileMetadata(uid, {
    security_question: data.security_question,
    security_answer:   (data.security_answer || '').toLowerCase().trim()
  });
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
  await logActivity('profile_update', 'Organisation profile updated');
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
  return uploadStorageFile(`final-reports/${uid}_${Date.now()}.${file.name.split('.').pop()}`, file);
}
async function saveCVFile(uid, file) {
  return uploadStorageFile(`cvs/${uid}_cv.${file.name.split('.').pop()}`, file);
}
async function saveTranscriptFile(uid, file) {
  return uploadStorageFile(`transcripts/${uid}_transcript.${file.name.split('.').pop()}`, file);
}

// ── MATCHING ALGORITHM ────────────────────────────
async function runMatching() {
  const students = await getStudents();
  const orgs     = await getOrganizations();  // only active orgs
  const existing = await getPlacements();
  const placedIds = new Set(existing.map(p => p.student_id));
  const unmatched = students.filter(s => !placedIds.has(s.id));
  const cap = {};
  orgs.forEach(o => {
    const taken = existing.filter(p => p.org_id === o.id).length;
    cap[o.id] = Math.max(0, (parseInt(o.positions) || 1) - taken);
  });
  const inserts = [];
  unmatched.forEach(student => {
    const sSkills = new Set(split(student.skills).map(x => x.toLowerCase()));
    const sPrefs  = split(student.preferences).map(x => x.toLowerCase());
    const sLoc    = (student.location_preference || '').toLowerCase();
    let best = null, bestScore = -1;
    orgs.forEach(org => {
      if ((cap[org.id] || 0) <= 0) return;
      const oSkills = split(org.required_skills);
      let ss = 10;
      if (sSkills.size && oSkills.length) {
        const ov = oSkills.filter(sk => sSkills.has(sk.toLowerCase())).length;
        ss = (ov / oSkills.length) * 60;
      }
      const pref = sPrefs.includes((org.industry || '').toLowerCase()) ? 20 : 0;
      const loc  = sLoc && (org.location || '').toLowerCase().includes(sLoc) ? 10 : 0;
      const gpa  = Math.min((parseFloat(student.gpa) || 0) * 2, 10);
      const score = Math.min(Math.round(ss + pref + loc + gpa), 100);
      if (score > bestScore) { bestScore = score; best = org; }
    });
    if (best) {
      inserts.push({ student_id: student.id, org_id: best.id, score: bestScore, status: 'pending', user_id: student.user_id });
      cap[best.id]--;
    }
  });
  if (inserts.length > 0) {
    await _q(() => _sb.from('placements').insert(
      inserts.map(i => ({ student_id: i.student_id, org_id: i.org_id, score: i.score, status: i.status }))
    ));
    for (const ins of inserts) {
      const org = orgs.find(o => o.id === ins.org_id);
      await createNotif(
        ins.user_id,
        '🎯 Placement Match Found',
        `You have been matched to ${org?.org_name || 'an organisation'} with a score of ${ins.score}%. Awaiting coordinator confirmation.`,
        'info'
      );
    }
    await logActivity('run_matching', `Matched ${inserts.length} students`);
  }
  return inserts.length;
}

// ── PLACEMENT ACTIONS (US-13 fixed) ──────────────
async function confirmPlacement(id) {
  const { error: upErr } = await _sb.from('placements').update({ status: 'confirmed' }).eq('id', id);
  if (upErr) { console.error('confirmPlacement update error:', upErr.message); return; }

  // Re-fetch to get the full placement row
  const rows = await _q(() => _sb.from('placements').select('*').eq('id', id));
  const p = rows[0];
  if (!p) return;

  const [allStudents, allOrgs] = await Promise.all([getStudents(), getAllOrganizations()]);
  const stu = allStudents.find(x => x.id === p.student_id);
  const org = allOrgs.find(x => x.id === p.org_id);

  // Notify student
  if (stu?.user_id) {
    await createNotif(
      stu.user_id,
      '✅ Placement Confirmed',
      `Your placement at ${org?.org_name || 'the organisation'} has been confirmed by the coordinator. You may now begin your attachment.`,
      'success'
    );
  }

  // US-13: Notify organisation that a student has been placed with them
  if (org?.user_id) {
    await createNotif(
      org.user_id,
      '👤 Student Placed With You',
      `${stu?.full_name || 'A student'} (${stu?.student_id || '—'}, ${stu?.department || 'Department not set'}) has been confirmed for attachment at your organisation. Please prepare for their arrival.`,
      'success'
    );
  }

  await logActivity('confirm_placement', `Confirmed placement ${id} — ${stu?.full_name || 'Unknown'} → ${org?.org_name || 'Unknown'}`);
}

async function rejectPlacement(id, reason = '') {
  const { error: upErr } = await _sb.from('placements').update({ status: 'rejected', rejection_reason: reason }).eq('id', id);
  if (upErr) { console.error('rejectPlacement update error:', upErr.message); return; }

  const rows = await _q(() => _sb.from('placements').select('*').eq('id', id));
  const p = rows[0];
  if (!p) return;

  const [allStudents, allOrgs] = await Promise.all([getStudents(), getAllOrganizations()]);
  const stu = allStudents.find(x => x.id === p.student_id);
  const org = allOrgs.find(x => x.id === p.org_id);

  if (stu?.user_id) {
    await createNotif(
      stu.user_id,
      '⚠️ Placement Rejected',
      `Your placement at ${org?.org_name || 'the organisation'} was rejected.${reason ? ' Reason: ' + reason : ''} Please contact your coordinator.`,
      'warning'
    );
  }
  await logActivity('reject_placement', `Rejected placement ${id}. Reason: ${reason}`);
}

// Revoke a confirmed placement (coordinator action)
async function revokePlacement(id, reason = '') {
  const { error: upErr } = await _sb.from('placements').update({ status: 'revoked', rejection_reason: reason }).eq('id', id);
  if (upErr) { console.error('revokePlacement update error:', upErr.message); return; }

  const rows = await _q(() => _sb.from('placements').select('*').eq('id', id));
  const p = rows[0];
  if (!p) return;

  const [allStudents, allOrgs] = await Promise.all([getStudents(), getAllOrganizations()]);
  const stu = allStudents.find(x => x.id === p.student_id);
  const org = allOrgs.find(x => x.id === p.org_id);

  if (stu?.user_id) {
    await createNotif(
      stu.user_id,
      '🔄 Placement Revoked',
      `Your confirmed placement at ${org?.org_name || 'the organisation'} has been revoked by the coordinator.${reason ? ' Reason: ' + reason : ''} You will be re-matched.`,
      'warning'
    );
  }
  if (org?.user_id) {
    await createNotif(
      org.user_id,
      '🔄 Placement Revoked',
      `The placement of ${stu?.full_name || 'a student'} at your organisation has been revoked by the coordinator.`,
      'warning'
    );
  }
  await logActivity('revoke_placement', `Revoked confirmed placement ${id}. Reason: ${reason}`);
}

// US-13: Manually send placement notification to organisation
async function sendPlacementNotificationToOrg(placementId) {
  const rows = await _q(() => _sb.from('placements').select('*').eq('id', placementId));
  const p = rows[0];
  if (!p || p.status !== 'confirmed') return false;

  const [allStudents, allOrgs] = await Promise.all([getStudents(), getAllOrganizations()]);
  const stu = allStudents.find(x => x.id === p.student_id);
  const org = allOrgs.find(x => x.id === p.org_id);

  if (!org?.user_id) return false;

  await createNotif(
    org.user_id,
    '📢 Placement Notification',
    `Reminder: ${stu?.full_name || 'A student'} (${stu?.student_id || '—'}, ${stu?.department || 'Dept N/A'}) is placed at your organisation for industrial attachment.`,
    'info'
  );

  // Mark as notified in placements table
  await _q(() => _sb.from('placements').update({ org_notified: true, org_notified_at: new Date().toISOString() }).eq('id', placementId));
  await logActivity('send_placement_to_org', `Sent placement notification to ${org.org_name} for ${stu?.full_name || 'student'}`);
  return true;
}

async function clearPlacements() {
  await _q(() => _sb.from('placements').delete().neq('id', '00000000-0000-0000-0000-000000000000'));
  await logActivity('clear_placements', 'All placements cleared');
}

// ── CSV EXPORT ────────────────────────────────────
async function exportPlacementsCSV() {
  const [placements, students, orgs] = await Promise.all([getPlacements(), getStudents(), getAllOrganizations()]);
  const rows = [['Student Name','Student ID','Department','GPA','Organisation','Industry','Score','Status','Org Notified']];
  placements.forEach(p => {
    const s = students.find(x => x.id === p.student_id);
    const o = orgs.find(x => x.id === p.org_id);
    rows.push([s?.full_name||'', s?.student_id||'', s?.department||'', s?.gpa||'', o?.org_name||'', o?.industry||'', p.score||'', p.status||'', p.org_notified?'Yes':'No']);
  });
  dlCSV(rows, 'IAMS_Placements');
  await logActivity('export_csv', `Exported ${placements.length} placements`);
}
async function exportStudentsCSV() {
  const [students, placements, orgs] = await Promise.all([getStudents(), getPlacements(), getAllOrganizations()]);
  const rows = [['Full Name','Student ID','Email','Department','GPA','Skills','Location Preference','Phone','Placed At','Status']];
  students.forEach(s => {
    const p = placements.find(x => x.student_id === s.id);
    const o = p ? orgs.find(x => x.id === p.org_id) : null;
    rows.push([s.full_name||'', s.student_id||'', s.email||'', s.department||'', s.gpa||'', s.skills||'', s.location_preference||'', s.phone||'', o?.org_name||'Unmatched', p?.status||'—']);
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
function split(str)  { return (str || '').split(',').map(s => s.trim()).filter(Boolean); }
function go(path)    { window.location.href = path; }
function esc(s)      { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
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

document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  renderSidebarUser();
  // Auto-refresh notification badge on every page load for logged-in users
  const u = Auth.current();
  if (u) updateNotifBadge();
});
