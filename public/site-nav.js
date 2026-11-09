(() => {
  const pathname = window.location.pathname;
  const activePath = pathname === '/' ? '' : pathname;
  const onHome = pathname === '/' || pathname === '/index.html';
  const header = document.querySelector('header');
  if (!header) return;

  const links = [
    ['/jobs.html', 'Tìm việc'],
    ['/cv.html', 'CV & hồ sơ'],
    ['/applications.html', 'Ứng tuyển'],
    ['/notifications.html', 'Thông báo'],
    ['/#candidates', 'Sinh viên'],
    ['/#employers', 'Nhà tuyển dụng'],
    ['/#how', 'Cách hoạt động']
  ];
  header.className = 'topbar site-header';
  header.innerHTML = `
    <a class="brand" href="/" aria-label="KETNOI — Trang chủ">
      <span class="brand-mark"><img src="/logo-mark.svg" alt=""></span>
      <span class="brand-wordmark">KETNOI</span>
    </a>
    <nav class="desktop-nav site-nav" id="primary-nav" aria-label="Điều hướng chính">
      ${links.map(([href, label]) => `<a${href === '/notifications.html' ? ' id="s4-notifications-link"' : ''} href="${href}"${href === activePath ? ' aria-current="page"' : ''}>${label}</a>`).join('')}
    </nav>
    <div class="nav-actions site-actions" id="nav-actions">
      ${onHome
        ? '<button class="btn btn-quiet" data-open="login">Đăng nhập</button><button class="btn btn-primary btn-small" data-open="register">Bắt đầu <span aria-hidden="true">↗</span></button>'
        : '<a class="btn btn-quiet" href="/?open=login">Đăng nhập</a><a class="btn btn-primary btn-small" href="/?open=register">Bắt đầu <span aria-hidden="true">↗</span></a>'}
    </div>
    <button class="mobile-menu" id="mobile-menu" aria-label="Mở menu" aria-expanded="false" aria-controls="primary-nav">☰</button>`;

  // The homepage account app already handles its mobile menu through delegated events.
  if (onHome) return;

  document.addEventListener('click', event => {
    const toggle = event.target.closest('#mobile-menu');
    const nav = document.querySelector('#primary-nav');
    const button = document.querySelector('#mobile-menu');
    if (toggle) {
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
