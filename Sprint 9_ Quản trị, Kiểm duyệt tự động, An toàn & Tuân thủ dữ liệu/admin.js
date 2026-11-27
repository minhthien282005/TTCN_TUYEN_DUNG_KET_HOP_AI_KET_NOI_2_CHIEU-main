'use strict';
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const date = value => value ? new Date(value).toLocaleString('vi-VN') : '—';
async function api(url) { const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || `Lỗi ${response.status}`); return data; }
function notice(message, error = false) { $('#notice').textContent = message; $('#notice').classList.toggle('error', error); }
async function load() {
  try {
    const me = await api('/api/me');
    if (me.user?.role !== 'admin') { notice('Trang này chỉ dành cho admin.', true); $('#metrics').innerHTML = ''; return; }
    const data = await api('/api/sprint9/admin/overview');
    const metrics = [
      ['Tin rủi ro cao', data.metrics.highRiskJobs], ['Tin cần xem lại', data.metrics.reviewJobs],
      ['Hoạt động 24 giờ', data.metrics.newAuditEvents24h], ['Đồng ý AI bật / đã rút', `${data.metrics.aiConsentGranted} / ${data.metrics.aiConsentRevoked}`]
    ];
    $('#metrics').innerHTML = metrics.map(([label, value]) => `<article class="s9-metric"><strong>${typeof value === 'number' ? value.toLocaleString('vi-VN') : esc(value)}</strong><span>${esc(label)}</span></article>`).join('');
    $('#risk-jobs').innerHTML = data.flaggedJobs.length ? data.flaggedJobs.map(job => `<article class="s9-job"><div><h3>${esc(job.title)}</h3><p>${esc(job.company)} · ${esc(job.status)} · Quét ${date(job.analyzedAt)}</p></div><span class="s9-badge ${job.level === 'high' ? 'high' : ''}">${job.score}/100 · ${job.level === 'high' ? 'Rủi ro cao' : 'Cần xem'}</span><ul>${job.reasons.map(reason => `<li>${esc(reason)}</li>`).join('')}</ul></article>`).join('') : '<p class="s9-empty">Chưa phát hiện tin cần ưu tiên kiểm tra.</p>';
    $('#audit-log').innerHTML = data.recentAudit.length ? data.recentAudit.map(item => `<tr><td>${date(item.at)}</td><td>${esc(item.actor)}</td><td>${esc(item.action)}</td><td>${esc(item.entity)}</td></tr>`).join('') : '<tr><td colspan="4">Chưa có sự kiện.</td></tr>';
    notice('Dữ liệu đã được cập nhật. Gắn cờ tự động không thay thế quyết định kiểm duyệt của admin.');
  } catch (error) { notice(`${error.message} Hãy đăng nhập bằng tài khoản admin.`, true); }
}
$('#refresh').addEventListener('click', load);
load();
