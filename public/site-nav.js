(() => {
  const pathname = window.location.pathname;
  const onHome = pathname === '/' || pathname === '/index.html';
  const header = document.querySelector('header');
  if (!header) return;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const routesByRole = {
    guest: [
      ['/jobs.html', 'Tìm việc'],
      ['/cv.html', 'CV & hồ sơ'],
      ['/employer.html', 'Nhà tuyển dụng']
    ],
    student: [
      ['/jobs.html', 'Tìm việc'],
      ['/cv.html', 'CV & hồ sơ'],
      ['/applications.html', 'Ứng tuyển'],
      ['/notifications.html', 'Thông báo']
    ],
    employer: [
      ['/employer.html', 'Đăng tuyển'],
      ['/employer-profile.html', 'Hồ sơ doanh nghiệp'],
      ['/ats.html', 'Ứng viên'],
      ['/notifications.html', 'Thông báo']
    ],
    admin: [
      ['/moderation.html', 'Quản trị & kiểm duyệt']
    ]
  };

  function activeHref(user) {
    if (pathname === '/jobs.html' || pathname.startsWith('/jobs/') || pathname === '/apply.html') return '/jobs.html';
    if (pathname === '/cv.html') return '/cv.html';
    if (pathname === '/applications.html') return '/applications.html';
    if (pathname === '/notifications.html') return '/notifications.html';
    if (pathname === '/employer-profile.html') return user?.role === 'employer' ? '/employer-profile.html' : '';
    if (pathname === '/employer.html' || pathname === '/my-jobs.html') return user?.role === 'employer' ? '/employer.html' : '';
    if (pathname === '/ats.html') return '/ats.html';
    if (pathname === '/moderation.html') return '/moderation.html';
    return '';
  }

  function renderNavigation(user) {
    const nav = document.querySelector('#primary-nav');
    if (!nav) return;
    const links = routesByRole[user?.role] || routesByRole.guest;
    const selected = activeHref(user);
    nav.innerHTML = links.map(([href, label]) => `<a${href === '/notifications.html' ? ' id="s4-notifications-link"' : ''} href="${href}"${href === selected ? ' aria-current="page"' : ''}>${label}</a>`).join('');

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
  fetch('/api/me', { credentials: 'same-origin' })
    .then(response => response.ok ? response.json() : null)
    .then(data => renderNavigation(data?.user || null))
    .catch(() => renderNavigation(null));

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
