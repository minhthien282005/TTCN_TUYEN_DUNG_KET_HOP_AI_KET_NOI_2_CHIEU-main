(() => {
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const labels = { proposed: 'Chờ xác nhận', confirmed: 'Đã xác nhận', declined: 'Đã từ chối', cancelled: 'Đã hủy', completed: 'Đã hoàn tất', pending: 'Chờ phản hồi', accepted: 'Đã chấp nhận', hired: 'Đã tuyển dụng' };
  const api = async (url, options = {}) => { const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) } }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || `Yêu cầu lỗi (${response.status}).`); return data; };
  const alert = message => { const node = $('#s7-alert'); node.textContent = message; node.hidden = !message; };
  const button = (label, action, id, klass = '') => `<button class="s7-btn ${klass}" data-action="${action}" data-id="${esc(id)}">${label}</button>`;
  const empty = text => `<div class="s7-empty">${text}</div>`;
  function render(data, role) {
    $('#s7-applications-panel').hidden = role !== 'employer';
    if (role === 'employer') $('#s7-applications').innerHTML = data.applications.length ? data.applications.filter(app => !['rejected', 'withdrawn', 'hired'].includes(app.status)).map(app => `<div class="s7-item"><h3>${esc(app.jobTitle)} · ${esc(app.candidateName)}</h3><p>Trạng thái: ${esc(labels[app.status] || app.status)}</p><div class="s7-actions">${button('Lên lịch phỏng vấn', 'schedule', app.id)}${button('Gửi offer', 'send-offer', app.id, 'secondary')}</div></div>`).join('') : empty('Chưa có hồ sơ cần xử lý.');
    const upcoming = data.interviews.filter(item => item.status === 'confirmed' && Date.parse(item.startsAt) > Date.now()).length;
    $('#s7-metrics').innerHTML = `<div class="s7-metric"><strong>${upcoming}</strong><span>Lịch sắp diễn ra</span></div><div class="s7-metric"><strong>${data.alerts.pendingConfirmations}</strong><span>Lời mời phỏng vấn chờ phản hồi</span></div><div class="s7-metric"><strong>${data.alerts.pendingOffers}</strong><span>Offer đang chờ phản hồi</span></div><div class="s7-metric"><strong>${data.alerts.staleApplications}</strong><span>Hồ sơ quá 7 ngày chưa cập nhật</span></div>`;
    $('#s7-interviews').innerHTML = data.interviews.length ? data.interviews.map(item => {
      const date = new Date(item.startsAt).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' });
      const mode = { online: 'Trực tuyến', onsite: 'Tại văn phòng', phone: 'Điện thoại' }[item.mode] || item.mode;
      const actions = item.status === 'proposed' && role === 'student' ? button('Xác nhận', 'confirm', item.id) + button('Từ chối', 'decline', item.id, 'danger') : item.status === 'proposed' && role === 'employer' ? button('Hủy lịch', 'cancel', item.id, 'danger') : item.status === 'confirmed' && role === 'employer' ? button('Đánh dấu hoàn tất', 'complete', item.id, 'secondary') + button('Hủy lịch', 'cancel', item.id, 'danger') : '';
      return `<div class="s7-item"><h3>${esc(item.application?.jobTitle || 'Phỏng vấn')} <span class="s7-badge">${esc(labels[item.status] || item.status)}</span></h3><p>${esc(date)} · ${esc(mode)} · ${item.durationMinutes} phút</p>${item.application?.candidateName ? `<p>Ứng viên: ${esc(item.application.candidateName)}</p>` : ''}${item.location ? `<p>Địa điểm: ${esc(item.location)}</p>` : ''}${item.meetingUrl ? `<p><a href="${esc(item.meetingUrl)}" target="_blank" rel="noopener noreferrer">Mở liên kết cuộc họp</a></p>` : ''}${item.notes ? `<p>${esc(item.notes)}</p>` : ''}<div class="s7-actions">${actions}</div></div>`;
    }).join('') : empty('Chưa có lịch phỏng vấn nào.');
    $('#s7-offers').innerHTML = data.offers.length ? data.offers.map(item => `<div class="s7-item"><h3>${esc(item.application?.jobTitle || 'Offer')} <span class="s7-badge">${esc(labels[item.status] || item.status)}</span></h3><p>Mức lương: ${Number(item.salaryMin).toLocaleString('vi-VN')} – ${Number(item.salaryMax).toLocaleString('vi-VN')} ${esc(item.currency)}</p><p>Hạn phản hồi: ${esc(new Date(item.expiresAt).toLocaleDateString('vi-VN'))}</p>${item.terms ? `<p>${esc(item.terms)}</p>` : ''}<div class="s7-actions">${item.status === 'pending' && role === 'student' ? button('Chấp nhận offer', 'accept', item.id) + button('Từ chối', 'decline-offer', item.id, 'danger') : ''}</div></div>`).join('') : empty('Chưa có thư mời làm việc.');
    $('#s7-events').innerHTML = data.events.length ? data.events.map(item => `<div class="s7-event"><span class="s7-dot"></span><div><strong>${esc(item.jobTitle)} · ${esc(item.type.replaceAll('.', ' '))}</strong><p>${esc(new Date(item.createdAt).toLocaleString('vi-VN'))}${item.detail?.note ? ` · ${esc(item.detail.note)}` : ''}</p></div></div>`).join('') : empty('Các cập nhật ATS sẽ được ghi lại tại đây.');
    if (data.alerts.upcomingInterviews) alert(`Bạn có ${data.alerts.upcomingInterviews} lịch phỏng vấn trong 24 giờ tới.`);
  }
  document.addEventListener('click', async event => {
    const target = event.target.closest('[data-action]'); if (!target) return;
    const { action, id } = target.dataset;
    if (action === 'schedule' || action === 'send-offer') {
      let body; let route;
      if (action === 'schedule') {
        const when = prompt('Thời gian phỏng vấn (YYYY-MM-DDTHH:mm, giờ địa phương):'); if (!when) return;
        if (!Number.isFinite(Date.parse(when))) { alert('Thời gian không hợp lệ.'); return; }
        const mode = prompt('Hình thức: online, onsite hoặc phone', 'online'); if (!mode) return;
        const place = prompt(mode === 'online' ? 'Liên kết cuộc họp (https://...)' : 'Địa điểm hoặc số điện thoại:'); if (!place) return;
        body = { startsAt: new Date(when).toISOString(), mode, ...(mode === 'online' ? { meetingUrl: place } : { location: place }), durationMinutes: 60 };
        route = `/api/sprint7/applications/${encodeURIComponent(id)}/interviews`;
      } else {
        const minimum = Number(prompt('Mức lương tối thiểu (VND):', '10000000')); const maximum = Number(prompt('Mức lương tối đa (VND):', String(minimum)));
        if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) return;
        body = { salaryMin: minimum, salaryMax: maximum, currency: 'VND', terms: prompt('Điều khoản offer (có thể để trống):', '') || '' };
        route = `/api/sprint7/applications/${encodeURIComponent(id)}/offers`;
      }
      target.disabled = true;
      try { await api(route, { method: 'POST', body: JSON.stringify(body) }); await load(); alert('Đã gửi cập nhật thành công.'); } catch (error) { alert(error.message); target.disabled = false; }
      return;
    }
    const route = action === 'accept' || action === 'decline-offer' ? `/api/sprint7/offers/${encodeURIComponent(id)}/${action === 'accept' ? 'accept' : 'decline'}` : `/api/sprint7/interviews/${encodeURIComponent(id)}/${action}`;
    target.disabled = true;
    try { await api(route, { method: 'POST', body: JSON.stringify({}) }); await load(); alert('Đã cập nhật thành công.'); } catch (error) { alert(error.message); target.disabled = false; }
  });
  async function load() { try { const me = await api('/api/me'); if (!me.user) { alert('Đăng nhập để quản lý lịch phỏng vấn và offer.'); return; } const data = await api('/api/sprint7/dashboard'); render(data, me.user.role); } catch (error) { alert(error.message); } }
  load();
})();
