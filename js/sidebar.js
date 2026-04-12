/* sidebar.js — injects sidebar HTML for authenticated pages */
'use strict';

function buildSidebar(role) {
  let links = '';

  if (role === 'coordinator') {
    links = `
      <a class="sb-link" data-page="dashboard.html" href="dashboard.html"><span class="sb-icon">▦</span>Dashboard</a>
      <a class="sb-link" data-page="students.html"  href="students.html"><span class="sb-icon">🧑‍🎓</span>Students</a>
      <a class="sb-link" data-page="organizations.html" href="organizations.html"><span class="sb-icon">🏢</span>Organizations</a>
      <a class="sb-link" data-page="match.html"     href="match.html"><span class="sb-icon">🎯</span>Match</a>
      <a class="sb-link" data-page="placements.html" href="placements.html"><span class="sb-icon">📋</span>Placements</a>`;
  } else if (role === 'student') {
    links = `
      <a class="sb-link" data-page="dashboard.html"     href="dashboard.html"><span class="sb-icon">▦</span>Dashboard</a>
      <a class="sb-link" data-page="organizations.html" href="organizations.html"><span class="sb-icon">🏢</span>Organizations</a>
      <a class="sb-link" data-page="my-placement.html"  href="my-placement.html"><span class="sb-icon">💼</span>My Placement</a>`;
  } else if (role === 'organization') {
    links = `
      <a class="sb-link" data-page="dashboard.html"     href="dashboard.html"><span class="sb-icon">▦</span>Dashboard</a>
      <a class="sb-link" data-page="organizations.html" href="organizations.html"><span class="sb-icon">🏢</span>Directory</a>`;
  }

  return `
    <aside class="sidebar" id="sidebar">
      <div class="sb-brand">IAMS<span class="dot">.</span></div>
      <div class="sb-role">Menu</div>
      <nav class="sb-links">${links}</nav>
      <div class="sb-bottom">
        <a class="sb-link" data-page="profile.html" href="profile.html"><span class="sb-icon">👤</span>Profile</a>
        <a class="sb-link" href="#" onclick="Auth.logout();return false;"><span class="sb-icon">⏻</span>Logout</a>
        <div class="sb-user">
          <div class="sb-av" id="sbUserAv">?</div>
          <div class="sb-user-info">
            <div class="sb-user-name" id="sbUserName">Loading…</div>
            <div class="sb-user-role" id="sbUserRole"></div>
          </div>
        </div>
      </div>
    </aside>
    <div class="sb-overlay" id="sbOverlay"></div>`;
}

function buildTopbar(title) {
  return `
    <div class="app-topbar">
      <div class="d-flex align-center gap-2">
        <button class="sb-toggle" id="sbToggle"><span></span><span></span><span></span></button>
        <span class="topbar-title">${title}</span>
      </div>
    </div>`;
}

function initAppShell(title) {
  const u = Auth.require();
  if (!u) return null;
  document.body.innerHTML = `
    <div class="app-shell">
      ${buildSidebar(u.role)}
      <div class="app-main" id="appMain">
        ${buildTopbar(title)}
        <div class="page-content" id="pageContent"></div>
      </div>
    </div>`;
  initSidebar();
  renderSidebarUser();
  return u;
}
