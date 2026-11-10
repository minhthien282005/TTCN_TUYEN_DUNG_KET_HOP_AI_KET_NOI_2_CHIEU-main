const $ = (selector, root = document) => root.querySelector(selector);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Có lỗi xảy ra.');
  return data;
}
function notice(message, error = false) { $('#notice').innerHTML = `<p class="s2-notice ${error ? 'error' : 'ok'}">${escapeHtml(message)}</p>`; }
function fill(form, data) { for (const [key, value] of Object.entries(data || {})) { const field = form.elements.namedItem(key); if (field) field.value = value ?? ''; } }
let companyData = null;
function renderDocuments() {
  const documents = companyData?.documents || [];
  $('#company-documents').innerHTML = documents.length ? documents.map(document => `<p class="s2-meta">${escapeHtml(document.fileName)} · ${escapeHtml(document.scanStatus)} · ${document.uploadedAt ? new Date(document.uploadedAt).toLocaleDateString('vi-VN') : ''}</p>`).join('') : '<p class="s2-muted">Chưa tải giấy tờ.</p>';
}
function renderStatus() {
  const status = companyData?.verificationStatus || 'unverified';
  const labels = { unverified: 'Chưa xác minh', pending_review: 'Đang chờ duyệt', verified: 'Đã xác minh', rejected: 'Bị từ chối', needs_more: 'Cần bổ sung' };
  $('#verification-status').textContent = labels[status] || labels.unverified;
  $('#verification-status').className = `s2-status ${status}`;
}
async function loadCompany() {
  const { company } = await api('/api/employer/company');
  companyData = company;
  if (company) {
    fill($('#company-form'), company);
    fill($('#company-extra-form'), { ...company, branches: (company.branches || []).map(item => typeof item === 'string' ? item : `${item.name} | ${item.address}`).join('\n'), benefits: (company.benefits || []).join('\n') });
  }
  renderStatus(); renderDocuments();
}
async function init() {
  const { user } = await api('/api/me');
  if (!user) { notice('Đăng nhập bằng tài khoản nhà tuyển dụng để cập nhật hồ sơ doanh nghiệp.', true); return; }
  if (user.role !== 'employer') { notice('Trang này dành cho nhà tuyển dụng.', true); return; }
  await loadCompany();
}
$('#company-form').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.submitter; button.disabled = true;
  try { const { company } = await api('/api/employer/company', { method: 'PUT', body: JSON.stringify({ company: Object.fromEntries(new FormData(event.currentTarget)) }) }); companyData = company; fill(event.currentTarget, company); renderStatus(); notice('Đã lưu hồ sơ doanh nghiệp.'); }
  catch (error) { notice(error.message, true); } finally { button.disabled = false; }
});
$('#company-extra-form').addEventListener('submit', async event => {
  event.preventDefault(); const fields = Object.fromEntries(new FormData(event.currentTarget));
  const company = { ...(companyData || {}), ...fields, branches: fields.branches.split('\n').map(line => { const [name, ...address] = line.split('|'); return { name: name.trim(), address: address.join('|').trim() }; }).filter(branch => branch.name || branch.address), benefits: fields.benefits.split('\n').map(item => item.trim()).filter(Boolean) };
  try { const result = await api('/api/employer/company', { method: 'PUT', body: JSON.stringify({ company }) }); companyData = result.company; notice('Đã lưu thông tin bổ sung.'); }
  catch (error) { notice(error.message, true); }
});
$('#verification-form').addEventListener('submit', async event => {
  event.preventDefault(); const file = event.currentTarget.elements.document.files[0]; if (!file) return;
  if (file.size > 5 * 1024 * 1024) { notice('Tệp vượt quá 5 MB.', true); return; }
  const bytes = new Uint8Array(await file.arrayBuffer()); let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  try {
    await api('/api/employer/company/documents', { method: 'POST', body: JSON.stringify({ document: { fileName: file.name, mimeType: file.type, dataBase64: btoa(binary) } }) });
    event.currentTarget.reset(); await loadCompany(); notice('Tài liệu đã được quét và gửi để xác minh.');
  } catch (error) { notice(error.message, true); }
});
init().catch(error => notice(error.message, true));
