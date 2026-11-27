(() => {
  const pathname = window.location.pathname;
  const onHome = pathname === '/' || pathname === '/index.html';
  const header = document.querySelector('header');
  if (!header) return;
  let renderedIdentity = '';

  function userIdentity(user) { return user ? `${user.id || user.email}:${user.role || ''}` : ''; }
  function allowedForRole(role, path) {
    const common = path === '/' || path === '/index.html' || path === '/jobs.html' || path.startsWith('/jobs/') || ['/matches.html', '/ai-tools.html', '/notifications.html'].includes(path);
    if (role === 'student') return common || ['/apply.html', '/cv.html', '/applications.html', '/my-jobs.html', '/network.html', '/sprint7/interviews.html', '/sprint8/coach.html', '/sprint9/privacy.html', '/sprint10/recommendations.html'].includes(path);
    if (role === 'employer') return common || ['/employer.html', '/employer-profile.html', '/ats.html', '/network.html', '/sprint7/interviews.html', '/sprint9/privacy.html', '/sprint10/recommendations.html'].includes(path);
    if (role === 'admin') return path === '/' || path === '/index.html' || ['/moderation.html', '/sprint9/admin.html', '/sprint9/privacy.html', '/sprint10/quality.html'].includes(path);
    return common;
  }
  function roleHome(role) { return ({ student: '/jobs.html', employer: '/employer.html', admin: '/moderation.html' })[role] || '/'; }

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const routesByRole = {
    guest: [
      { label: 'Việc làm', items: [['/jobs.html', 'Tìm việc'], ['/matches.html', 'Gợi ý phù hợp']] },
      { label: 'CV & công cụ', items: [['/cv.html', 'CV & hồ sơ'], ['/ai-tools.html', 'AI hỗ trợ']] },
      ['/employer.html', 'Nhà tuyển dụng']
    ],
    student: [
      { label: 'Việc làm', items: [['/jobs.html', 'Tìm việc'], ['/matches.html', 'Gợi ý phù hợp'], ['/sprint10/recommendations.html', 'Gợi ý AI cá nhân hóa'], ['/applications.html', 'Hồ sơ đã ứng tuyển'], ['/sprint7/interviews.html', 'Phỏng vấn & offer']] },
      { label: 'Hồ sơ & AI', items: [['/cv.html', 'CV & hồ sơ năng lực'], ['/sprint8/coach.html', 'AI Coach'], ['/ai-tools.html', 'Công cụ AI'], ['/sprint9/privacy.html', 'Quyền riêng tư & dữ liệu']] },
      ['/network.html', 'Kết nối'],
      ['/notifications.html', 'Thông báo']
    ],
    employer: [
      { label: 'Tuyển dụng', items: [['/employer.html', 'Đăng tuyển & quản lý tin'], ['/matches.html', 'Ứng viên phù hợp'], ['/sprint10/recommendations.html', 'Gợi ý AI cá nhân hóa'], ['/ats.html', 'Quản lý ứng viên'], ['/sprint7/interviews.html', 'Phỏng vấn & offer']] },
      { label: 'Doanh nghiệp', items: [['/employer-profile.html', 'Hồ sơ doanh nghiệp'], ['/network.html', 'Tìm ứng viên & kết nối'], ['/ai-tools.html', 'Công cụ AI'], ['/sprint9/privacy.html', 'Quyền riêng tư & dữ liệu']] },
      ['/notifications.html', 'Thông báo']
    ],
    admin: [
      ['/moderation.html', 'Quản trị & kiểm duyệt'],
      ['/sprint9/admin.html', 'An toàn & tuân thủ'],
      ['/sprint10/quality.html', 'Theo dõi gợi ý AI'],
      ['/sprint9/privacy.html', 'Quyền riêng tư']
    ]
  };

  function activeHref(user) {
    if (pathname === '/jobs.html' || pathname.startsWith('/jobs/') || pathname === '/apply.html') return '/jobs.html';
    if (pathname === '/matches.html') return '/matches.html';
    if (pathname === '/ai-tools.html') return '/ai-tools.html';
    if (pathname === '/cv.html') return '/cv.html';
    if (pathname === '/applications.html') return '/applications.html';
    if (pathname === '/sprint7/interviews.html') return '/sprint7/interviews.html';
    if (pathname === '/sprint8/coach.html') return '/sprint8/coach.html';
    if (pathname === '/notifications.html') return '/notifications.html';
    if (pathname === '/network.html') return '/network.html';
    if (pathname === '/employer-profile.html') return user?.role === 'employer' ? '/employer-profile.html' : '';
    if (pathname === '/employer.html' || pathname === '/my-jobs.html') return user?.role === 'employer' ? '/employer.html' : '';
    if (pathname === '/ats.html') return '/ats.html';
    if (pathname === '/moderation.html') return '/moderation.html';
    if (pathname === '/sprint9/admin.html') return '/sprint9/admin.html';
    if (pathname === '/sprint9/privacy.html') return '/sprint9/privacy.html';
    if (pathname === '/sprint10/recommendations.html') return '/sprint10/recommendations.html';
    if (pathname === '/sprint10/quality.html') return '/sprint10/quality.html';
    return '';
  }

  function renderNavigation(user) {
    const nav = document.querySelector('#primary-nav');
    if (!nav) return;
    renderedIdentity = userIdentity(user);
    const links = routesByRole[user?.role] || routesByRole.guest;
    const selected = activeHref(user);
    const linkMarkup = ([href, label]) => `<a${href === '/notifications.html' ? ' id="s4-notifications-link"' : ''} href="${href}"${href === selected ? ' aria-current="page"' : ''}>${escapeHtml(label)}</a>`;
    nav.innerHTML = links.map((item, index) => {
      if (Array.isArray(item)) return `<a class="nav-direct${item[0] === selected ? ' is-active' : ''}"${item[0] === '/notifications.html' ? ' id="s4-notifications-link"' : ''} href="${item[0]}"${item[0] === selected ? ' aria-current="page"' : ''}>${escapeHtml(item[1])}</a>`;
      const active = item.items.some(([href]) => href === selected);
      return `<div class="nav-group${active ? ' has-active' : ''}"><button class="nav-menu-toggle" type="button" aria-expanded="false" aria-controls="site-menu-${index}"><span>${escapeHtml(item.label)}</span><svg aria-hidden="true" viewBox="0 0 12 12"><path d="m2.5 4.5 3.5 3 3.5-3"/></svg></button><div class="nav-dropdown" id="site-menu-${index}" aria-hidden="true" inert>${item.items.map(linkMarkup).join('')}</div></div>`;
    }).join('');

    if (onHome) return; // Sprint 1 owns the homepage account controls.
    const actions = document.querySelector('#nav-actions');
    if (!actions) return;
    if (!user) {
      const next = `${pathname}${window.location.search}${window.location.hash}`;
      const loginUrl = `/?${new URLSearchParams({ open: 'login', next })}`;
      const registerUrl = `/?${new URLSearchParams({ open: 'register', next })}`;
      actions.innerHTML = `<a class="btn btn-quiet" href="${loginUrl}">Đăng nhập</a><a class="btn btn-primary btn-small" href="${registerUrl}">Bắt đầu <span aria-hidden="true">↗</span></a>`;
      return;
    }
    const name = user.profile?.fullName || user.email;
    actions.innerHTML = `<a class="btn btn-quiet" href="/?open=account" aria-label="Tài khoản ${escapeHtml(name)}">${escapeHtml(name)}</a><button class="btn btn-primary btn-small" id="site-logout" type="button">Đăng xuất</button>`;
  }

  header.className = 'topbar site-header';
  header.innerHTML = `
    <a class="brand" href="/" aria-label="KETNOI — Trang chủ">
      <span class="brand-mark"><img src="/logo-mark.svg" alt=""></span>
      <span class="brand-wordmark">KETNOI</span>
    </a>
    <nav class="desktop-nav site-nav" id="primary-nav" aria-label="Điều hướng chính"></nav>
    <div class="nav-actions site-actions" id="nav-actions"></div>
    <button class="mobile-menu" id="mobile-menu" aria-label="Mở menu" aria-expanded="false" aria-controls="primary-nav">☰</button>`;

  window.ketnoiUpdateSiteNav = renderNavigation;
  window.addEventListener('ketnoi:auth-changed', event => renderNavigation(event.detail?.user || null));
  renderNavigation(null);
  fetch('/api/me', { credentials: 'same-origin', cache: 'no-store' })
    .then(response => response.ok ? response.json() : null)
    .then(data => renderNavigation(data?.user || null))
    .catch(() => renderNavigation(null));

  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    fetch('/api/me', { credentials: 'same-origin', cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        const user = data?.user || null;
        if (userIdentity(user) === renderedIdentity) { renderNavigation(user); return; }
        if (user && !allowedForRole(user.role, pathname)) window.location.replace(roleHome(user.role));
        else if (!user && ['/employer-profile.html', '/ats.html', '/moderation.html'].includes(pathname)) window.location.replace('/');
        else window.location.reload();
      })
      .catch(() => window.location.reload());
  });

  function setDropdown(group, open) {
    group.classList.toggle('is-open', open);
    group.querySelector('.nav-menu-toggle')?.setAttribute('aria-expanded', String(open));
    const menu = group.querySelector('.nav-dropdown');
    if (menu) { menu.inert = !open; menu.setAttribute('aria-hidden', String(!open)); }
  }
  function closeDropdowns(except = null) {
    document.querySelectorAll('.nav-group.is-open').forEach(group => {
      if (group === except) return;
      setDropdown(group, false);
    });
  }
  function openDropdown(group) { closeDropdowns(group); setDropdown(group, true); }
  function scheduleDropdownClose(group) {
    window.setTimeout(() => {
      const focused = group.contains(document.activeElement) && !document.activeElement.matches('.nav-menu-toggle');
      if (group.matches(':hover') || focused) return;
      setDropdown(group, false);
    }, 140);
  }
  document.addEventListener('pointerover', event => {
    if (event.pointerType !== 'mouse') return;
    const group = event.target.closest('.nav-group');
    if (group && !group.contains(event.relatedTarget)) openDropdown(group);
  });
  document.addEventListener('pointerout', event => {
    if (event.pointerType !== 'mouse') return;
    const group = event.target.closest('.nav-group');
    if (group && !group.contains(event.relatedTarget)) scheduleDropdownClose(group);
  });
  document.addEventListener('focusin', event => {
    const group = event.target.closest('.nav-group'); if (group) openDropdown(group);
  });
  document.addEventListener('focusout', event => {
    const group = event.target.closest('.nav-group');
    if (group && !group.contains(event.relatedTarget)) scheduleDropdownClose(group);
  });
  document.addEventListener('click', event => {
    const toggle = event.target.closest('.nav-menu-toggle');
    if (toggle) {
      const group = toggle.closest('.nav-group'); const opening = !group.classList.contains('is-open') || (event.detail > 0 && group.matches(':hover'));
      closeDropdowns(group);
      setDropdown(group, opening);
      if (opening && event.detail === 0) group.querySelector('.nav-dropdown a')?.focus();
      return;
    }
    if (event.target.closest('.nav-dropdown a')) closeDropdowns();
    else if (!event.target.closest('.nav-group')) closeDropdowns();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      const openGroup = document.querySelector('.nav-group.is-open'); closeDropdowns();
      openGroup?.querySelector('.nav-menu-toggle')?.focus();
      const nav = document.querySelector('#primary-nav'); const button = document.querySelector('#mobile-menu');
      if (nav?.classList.contains('mobile-open')) { nav.classList.remove('mobile-open'); button?.setAttribute('aria-expanded', 'false'); }
    }
    if (event.key === 'ArrowDown' && event.target.matches('.nav-menu-toggle')) {
      event.preventDefault(); const group = event.target.closest('.nav-group');
      if (!group.classList.contains('is-open')) event.target.click();
      group.querySelector('.nav-dropdown a')?.focus();
    }
  });

  // The homepage account app handles its own mobile menu through delegated events.
  if (onHome) return;

  document.addEventListener('click', event => {
    const logout = event.target.closest('#site-logout');
    if (logout) {
      logout.disabled = true;
      fetch('/api/logout', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .then(response => { if (!response.ok) throw new Error('Đăng xuất chưa thành công.'); window.location.reload(); })
        .catch(() => { logout.disabled = false; });
      return;
    }
    const nav = document.querySelector('#primary-nav');
    const button = document.querySelector('#mobile-menu');
    if (event.target.closest('#mobile-menu')) {
      const expanded = nav.classList.toggle('mobile-open');
      button.setAttribute('aria-expanded', String(expanded));
      button.setAttribute('aria-label', expanded ? 'Đóng menu' : 'Mở menu');
    } else if (event.target.closest('#primary-nav a')) {
      nav.classList.remove('mobile-open');
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-label', 'Mở menu');
    } else if (button?.getAttribute('aria-expanded') === 'true' && !event.target.closest('.site-header')) {
      nav.classList.remove('mobile-open');
      button.setAttribute('aria-expanded', 'false');
    }
  });
})();
