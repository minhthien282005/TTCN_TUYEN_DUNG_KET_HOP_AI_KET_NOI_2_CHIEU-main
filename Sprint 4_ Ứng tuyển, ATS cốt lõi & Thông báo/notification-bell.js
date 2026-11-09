(() => {
  fetch('/api/sprint4/notifications', { credentials: 'same-origin' }).then(response => response.ok ? response.json() : null).then(data => {
    if (!data || !data.unread) return;
    const link = document.querySelector('#s4-notifications-link');
    if (!link) return;
    link.innerHTML = `Thông báo <span aria-label="${data.unread} thông báo chưa đọc">${Math.min(data.unread, 99)}</span>`;
  }).catch(() => {});
})();
