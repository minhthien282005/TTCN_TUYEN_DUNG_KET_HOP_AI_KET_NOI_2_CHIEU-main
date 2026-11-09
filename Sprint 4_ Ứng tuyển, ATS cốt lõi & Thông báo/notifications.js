(() => {
  const $ = selector => document.querySelector(selector);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const api = async (url, options = {}) => { const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) } }); const data = await response.json().catch(() => ({})); if (!response.ok) { const error = new Error(data.error || `Yêu cầu lỗi (${response.status}).`); error.status = response.status; throw error; } return data; };
  const notice = (message, error = false) => { $('#notifications-notice').textContent = message; $('#notifications-notice').className = message ? `s4-notice${error ? ' error' : ''}` : ''; };
  const requireLogin = () => {
    $('#notifications-notice').innerHTML = 'Đăng nhập để xem các thông báo liên quan đến tài khoản của bạn. <a class="s4-button secondary" href="/?open=login&amp;next=%2Fnotifications.html">Đăng nhập</a>';
    $('#notifications-notice').className = 's4-notice';
    $('#notifications-list').innerHTML = '<div class="s4-empty">Thông báo sẽ xuất hiện tại đây sau khi bạn đăng nhập.</div>';
  };
  async function load() {
    const { notifications, unread } = await api('/api/sprint4/notifications'); $('#notification-summary').textContent = `${unread} thông báo chưa đọc · Tối đa 100 cập nhật gần nhất.`;
    if (!notifications.length) { $('#notifications-list').innerHTML = '<div class="s4-empty">Bạn chưa có thông báo.</div>'; return; }
    $('#notifications-list').innerHTML = notifications.map(item => `<article class="s4-card"><div class="s4-card-head"><div><h3>${escape(item.title)}</h3><p>${escape(item.message)}</p><small>${new Date(item.createdAt).toLocaleString('vi-VN')}</small></div>${item.readAt ? '' : '<span class="s4-tag">Mới</span>'}</div><div class="s4-card-actions">${item.href ? `<a class="s4-button secondary" href="${escape(item.href)}">Mở</a>` : ''}${!item.readAt ? `<button class="s4-button" data-read="${escape(item.id)}">Đánh dấu đã đọc</button>` : ''}</div></article>`).join('');
  }
  $('#notifications-list').addEventListener('click', async event => { const button = event.target.closest('[data-read]'); if (!button) return; try { await api(`/api/sprint4/notifications/${encodeURIComponent(button.dataset.read)}/read`, { method: 'POST', body: '{}' }); await load(); } catch (error) { notice(error.message, true); } });
  $('#mark-all-read').addEventListener('click', async () => { try { await api('/api/sprint4/notifications/read-all', { method: 'POST', body: '{}' }); notice('Đã đánh dấu tất cả thông báo đã đọc.'); await load(); } catch (error) { notice(error.message, true); } });
  load().catch(error => error.status === 401 ? requireLogin() : notice(error.message, true));
})();
