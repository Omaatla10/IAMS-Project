'use strict';

function sbIcon(name) {
  const icons = {
    dashboard:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`,
    students:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    organizations: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18V7H3z"/><path d="M7 21V11"/><path d="M12 21V11"/><path d="M17 21V11"/></svg>`,
    match:         `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    placements:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6v4H9z"/><path d="M19 7H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/></svg>`,
    logbook:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
    reports:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="8 12 12 8 16 12"/><line x1="12" y1="8" x2="12" y2="16"/></svg>`,
    my_placement:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
    notifications: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
    profile:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M6 21v-2a6 6 0 0 1 12 0v2"/></svg>`,
    signout:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
    coordinator:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`
  };
  return icons[name] || '';
}

function getNavLinks(role) {
  if (role === 'coordinator') return [
    { href:'dashboard.html',     label:'Dashboard',      icon:'dashboard'     },
    { href:'students.html',      label:'Students',       icon:'students'      },
    { href:'organizations.html', label:'Organizations',  icon:'organizations' },
    { href:'match.html',         label:'Match',          icon:'match'         },
    { href:'placements.html',    label:'Placements',     icon:'placements'    },
    { href:'logbooks.html',      label:'Logbooks',       icon:'logbook'       },
    { href:'reports.html',       label:'Reports',        icon:'reports'       },
  ];
  if (role === 'student') return [
    { href:'dashboard.html',     label:'Dashboard',     icon:'dashboard'    },
    { href:'organizations.html', label:'Organizations', icon:'organizations' },
    { href:'my-placement.html',  label:'My Placement',  icon:'my_placement' },
    { href:'my-logbook.html',    label:'My Logbook',    icon:'logbook'      },
  ];
  if (role === 'organization') return [
    { href:'dashboard.html',     label:'Dashboard',    icon:'dashboard'     },
    { href:'organizations.html', label:'Directory',    icon:'organizations' },
    { href:'supervisor-report.html', label:'Assessment Report', icon:'reports' },
  ];
  return [];
}

function buildSidebar(role) {
  const links = getNavLinks(role).map(l =>
    `<a class="sb-link" data-page="${l.href}" href="${l.href}"><span class="sb-icon">${sbIcon(l.icon)}</span>${l.label}</a>`
  ).join('');

  return `
    <aside class="sidebar" id="sidebar">
      <div class="sb-brand">IAMS<span class="dot">.</span><span style="font-size:.6rem;font-weight:700;background:rgba(255,255,255,.15);border-radius:20px;padding:2px 7px;margin-left:6px;opacity:.85">R2</span></div>
      <div class="sb-role">Menu</div>
      <nav class="sb-links">${links}</nav>
      <div class="sb-bottom">
        <a class="sb-link" data-page="notifications.html" href="notifications.html">
          <span class="sb-icon">${sbIcon('notifications')}</span>Notifications
          <span class="notif-badge" style="display:none;background:#dc2626;color:#fff;font-size:.6rem;font-weight:700;padding:1px 6px;border-radius:20px;margin-left:auto;align-items:center;justify-content:center;min-width:18px;text-align:center"></span>
        </a>
        <a class="sb-link" data-page="profile.html" href="profile.html"><span class="sb-icon">${sbIcon('profile')}</span>Profile</a>
        <a class="sb-link" href="#" onclick="Auth.logout();return false;"><span class="sb-icon">${sbIcon('signout')}</span>Sign Out</a>
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
      <div class="d-flex align-center gap-2" style="margin-left:auto">
        <a href="notifications.html" style="position:relative;display:inline-flex;align-items:center;gap:4px;padding:5px 10px;border-radius:8px;background:var(--cream2,rgba(0,0,0,.05));font-size:.8rem;text-decoration:none;color:inherit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          <span class="notif-badge" style="display:none;background:#dc2626;color:#fff;font-size:.6rem;font-weight:700;padding:1px 5px;border-radius:20px"></span>
        </a>
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
  setTimeout(updateNotifBadge, 200);
  return u;
}
