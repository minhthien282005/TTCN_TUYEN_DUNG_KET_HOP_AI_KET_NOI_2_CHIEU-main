'use strict';
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const labels = { account_profile: 'Xử lý hồ sơ tài khoản', ai_assistant_external: 'Gửi nội dung cho AI bên ngoài' };
async function api(url, options = {}) { const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) } }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || `Lỗi ${response.status}`); return data; }
function notice(message, error = false) { $('#privacy-notice').textContent = message; $('#privacy-notice').classList.toggle('error', error); }
async function load() {
  try {
    const me = await api('/api/me'); if (!me.user) { notice('Đăng nhập để xem và tải dữ liệu tài khoản.', true); $('#ai-consent').disabled = true; $('#export-data').setAttribute('aria-disabled', 'true'); return; }
    const data = await api('/api/sprint9/privacy/consents'); const toggle = $('#ai-consent');
    toggle.checked = data.externalAiGranted; toggle.disabled = me.user.role !== 'student';
    $('#consent-label').textContent = data.externalAiGranted ? 'Đã đồng ý' : 'Chưa đồng ý';
    if (me.user.role !== 'student') $('#consent-label').textContent = 'Chỉ áp dụng cho AI Coach sinh viên';
    $('#consent-history').innerHTML = data.consents.length ? data.consents.map(item => `<div class="s9-consent-row"><strong>${esc(labels[item.purpose] || item.purpose)}</strong><span>${item.granted ? 'Đồng ý' : 'Đã rút lại'} · ${new Date(item.at || item.recordedAt).toLocaleString('vi-VN')}</span></div>`).join('') : '<p>Chưa có lịch sử đồng ý bổ sung.</p>';
    $('#export-data').addEventListener('click', () => notice('Đang tạo tệp dữ liệu cá nhân…'), { once: true });
  } catch (error) { notice(error.message, true); }
}
$('#ai-consent').addEventListener('change', async event => {
  const checkbox = event.currentTarget; const requested = checkbox.checked; checkbox.disabled = true;
  try { await api('/api/sprint5/consent', { method: 'POST', body: JSON.stringify({ granted: requested }) }); $('#consent-label').textContent = requested ? 'Đã đồng ý' : 'Chưa đồng ý'; notice(requested ? 'Đã lưu lựa chọn đồng ý.' : 'Đã rút lại lựa chọn. AI bên ngoài sẽ không nhận câu trả lời mới.'); await loadHistory(); }
  catch (error) { checkbox.checked = !requested; notice(error.message, true); }
  finally { checkbox.disabled = false; }
});
async function loadHistory() { try { const data = await api('/api/sprint9/privacy/consents'); $('#consent-history').innerHTML = data.consents.length ? data.consents.map(item => `<div class="s9-consent-row"><strong>${esc(labels[item.purpose] || item.purpose)}</strong><span>${item.granted ? 'Đồng ý' : 'Đã rút lại'} · ${new Date(item.at || item.recordedAt).toLocaleString('vi-VN')}</span></div>`).join('') : '<p>Chưa có lịch sử đồng ý bổ sung.</p>'; } catch (error) { notice(error.message, true); } }
load();
