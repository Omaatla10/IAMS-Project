/* sidebar.js — injects sidebar HTML for authenticated pages */
'use strict';

function icon(name) {
  const icons = {
    dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect></svg>`,
    students: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
    organizations: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18V7H3z"></path><path d="M7 21V11"></path><path d="M12 21V11"></path><path d="M17 21V11"></path></svg>`,
    match: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"></circle><path d="M12 8v4l2 2"></path></svg>`,
    placements: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6v4H9z"></path><path d="M19 7H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"></path></svg>`,
    profile: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"></circle><path d="M6 21v-2a6 6 0 0 1 12 0v2"></path></svg>`,
    signout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`
  };
  return icons[name] || '';
}

function getNavLinks(role) {
  if (role === 'coordinator') {
    return [
      { href: 'dashboard.html', label: 'Dashboard', page: 'dashboard.html' },
      { href: 'students.html', label: 'Students', page: 'students.html' },
      { href: 'organizations.html', label: 'Organizations', page: 'organizations.html' },
      { href: 'match.html', label: 'Match', page: 'match.html' },
      { href: 'placements.html', label: 'Placements', page: 'placements.html' }
    ];
  } else if (role === 'student') {
    return [
      { href: 'dashboard.html', label: 'Dashboard', page: 'dashboard.html' },
      { href: 'organizations.html', label: 'Organizations', page: 'organizations.html' },
      { href: 'my-placement.html', label: 'My Placement', page: 'my-placement.html' }
    ];
  } else if (role === 'organization') {
    return [
      { href: 'dashboard.html', label: 'Dashboard', page: 'dashboard.html' },
      { href: 'organizations.html', label: 'Directory', page: 'organizations.html' }
    ];
  }
  return [];
}

function buildSidebar(role) {
  const links = getNavLinks(role).map(link => `
      <a class="sb-link" data-page="${link.page}" href="${link.href}"><span class="sb-icon">${icon(link.page === 'dashboard.html' ? 'dashboard' : link.page === 'students.html' ? 'students' : link.page === 'organizations.html' ? 'organizations' : link.page === 'match.html' ? 'match' : 'placements')}</span>${link.label}</a>`).join('');

  return `
    <aside class="sidebar" id="sidebar">
      <div class="sb-brand">IAMS<span class="dot">.</span></div>
      <div class="sb-role">Menu</div>
      <nav class="sb-links">${links}</nav>
      <div class="sb-bottom">
        <a class="sb-link" data-page="profile.html" href="profile.html"><span class="sb-icon">${icon('profile')}</span>Profile</a>
        <a class="sb-link" href="#" onclick="Auth.logout();return false;"><span class="sb-icon">${icon('signout')}</span>Sign Out</a>
        <div class="sb-user">
          <div class="sb-av" id="sbUserAv">?</div>
          <div class="sb-user-info">
            <div class="sb-user-name" id="sbUserName">Loading…</div>
            <div class="sb-user-role" id="sbUserRole"></div>
          </div>
        </div>
      </div>
    </aside>`;
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
