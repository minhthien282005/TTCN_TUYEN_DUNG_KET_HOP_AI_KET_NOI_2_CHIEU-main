(() => {
  const $ = selector => document.querySelector(selector);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const api = async (url, options = {}) => { const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) } }); const data = await response.json().catch(() => ({})); if (!response.ok) { const error = new Error(data.error || `Yêu cầu lỗi (${response.status}).`); error.status = response.status; throw error; } return data; };
  const notice = (message, error = false) => { $('#applications-notice').textContent = message; $('#applications-notice').className = message ? `s4-notice${error ? ' error' : ''}` : ''; };
  const requireLogin = () => {
    $('#applications-notice').innerHTML = 'Đăng nhập để xem và quản lý hồ sơ ứng tuyển của bạn. <a class="s4-button secondary" href="/?open=login&amp;next=%2Fapplications.html">Đăng nhập</a>';
    $('#applications-notice').className = 's4-notice';
    $('#applications-list').innerHTML = '<div class="s4-empty">Hồ sơ ứng tuyển sẽ xuất hiện tại đây sau khi bạn đăng nhập.</div>';
  };
  const labels = { submitted: 'Mới nộp', viewed: 'Đã xem', screening: 'Sàng lọc', interview: 'Phỏng vấn', offered: 'Đề nghị', hired: 'Tuyển dụng', rejected: 'Từ chối', withdrawn: 'Đã rút' };
  const pipeline = ['submitted', 'viewed', 'screening', 'interview', 'offered', 'hired'];
  function render(applications) {
    if (!applications.length) { $('#applications-list').innerHTML = '<div class="s4-empty">Bạn chưa ứng tuyển vị trí nào. <a href="/jobs.html">Khám phá việc làm</a>.</div>'; return; }
    $('#applications-list').innerHTML = applications.map(app => {
      const index = pipeline.indexOf(app.status); const ended = ['rejected', 'withdrawn'].includes(app.status);
      const timeline = pipeline.map((stage, i) => `<span class="${!ended && i < index ? 'done' : ''} ${!ended && i === index ? 'current' : ''}">${escape(labels[stage])}</span>`).join('');
      const history = app.stageLog.map(item => `<li>${escape(item.to === 'rejected' ? 'Từ chối' : item.to === 'withdrawn' ? 'Đã rút' : labels[item.to] || item.to)} · ${new Date(item.at).toLocaleString('vi-VN')}${item.note ? ` · ${escape(item.note)}` : ''}</li>`).join('');
      const canWithdraw = ['submitted', 'viewed', 'screening', 'interview'].includes(app.status);
      return `<article class="s4-card"><div class="s4-card-head"><div><h3>${escape(app.jobTitle)}</h3><p>${escape(app.companyName)} · Nộp ${new Date(app.createdAt).toLocaleDateString('vi-VN')}</p></div><span class="s4-tag ${ended ? 'warn' : ''}">${escape(app.statusLabel || labels[app.status])}</span></div>${ended ? `<p>${escape(app.rejectionNote || (app.status === 'withdrawn' ? 'Bạn đã rút hồ sơ.' : ''))}</p>` : `<div class="s4-timeline">${timeline}</div>`}<details><summary class="s4-muted">Lịch sử xử lý (${app.stageLog.length})</summary><ul>${history}</ul></details><div class="s4-card-actions">${canWithdraw ? `<button class="s4-button secondary" data-withdraw="${escape(app.id)}">Rút hồ sơ</button>` : ''}<a class="s4-button secondary" href="/jobs.html">Xem việc làm khác</a></div></article>`;
    }).join('');
  }
  async function load() { const { applications } = await api('/api/sprint4/student/applications'); render(applications); }
  $('#applications-list').addEventListener('click', async event => {
    const button = event.target.closest('[data-withdraw]'); if (!button) return;
    const reason = prompt('Lý do bạn muốn rút hồ sơ (ít nhất 5 ký tự):'); if (!reason) return;
    try { await api(`/api/sprint4/student/applications/${encodeURIComponent(button.dataset.withdraw)}/withdraw`, { method: 'POST', body: JSON.stringify({ reason }) }); notice('Đã rút hồ sơ và thông báo cho nhà tuyển dụng.'); await load(); }
    catch (error) { notice(error.message, true); }
  });
  load().catch(error => error.status === 401 ? requireLogin() : notice(error.message, true));
})();
