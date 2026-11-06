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
const labels = { draft: 'Bản nháp', pending_review: 'Chờ duyệt', published: 'Đang hiển thị', paused: 'Tạm dừng', expired: 'Hết hạn', closed: 'Đã đóng', rejected: 'Cần chỉnh sửa', needs_changes: 'Cần bổ sung', archived: 'Đã lưu trữ' };
let companyData = null;
let knownJobs = new Map();
async function loadJobs() {
  const { jobs } = await api('/api/employer/jobs');
  knownJobs = new Map(jobs.map(job => [job.id, job]));
  $('#my-jobs').innerHTML = jobs.length ? jobs.map(job => `<article class="s2-job-row"><div><h3>${escapeHtml(job.title)}</h3><p>${escapeHtml(job.location)} · ${escapeHtml(job.type)} · ${escapeHtml(job.workMode)} · Hạn ${job.expiresAt ? new Date(job.expiresAt).toLocaleDateString('vi-VN') : 'chưa đặt'}</p>${job.moderationNote ? `<p class="s2-note">Ghi chú: ${escapeHtml(job.moderationNote)}</p>` : ''}<p>Cập nhật ${new Date(job.updatedAt).toLocaleDateString('vi-VN')}</p><div class="s2-actions"><button class="s2-button s2-secondary" data-edit="${escapeHtml(job.id)}">Chỉnh sửa / gửi duyệt lại</button><button class="s2-button s2-secondary" data-clone="${escapeHtml(job.id)}">Nhân bản</button>${job.status === 'published' ? `<button class="s2-button s2-secondary" data-pause="${escapeHtml(job.id)}">Tạm dừng</button>` : ''}${['paused', 'expired', 'closed'].includes(job.status) ? `<button class="s2-button s2-secondary" data-renew="${escapeHtml(job.id)}">Gia hạn</button>` : ''}${!['closed', 'archived'].includes(job.status) ? `<button class="s2-button s2-secondary" data-close="${escapeHtml(job.id)}">Đóng tin</button>` : ''}</div></div><span class="s2-status ${escapeHtml(job.status)}">${labels[job.status] || escapeHtml(job.status)}</span></article>`).join('') : '<p class="s2-muted">Chưa có tin tuyển dụng. Hãy tạo tin đầu tiên ở trên.</p>';
}
async function init() {
  const { user } = await api('/api/me');
  if (!user) { notice('Hãy đăng nhập tài khoản nhà tuyển dụng để quản lý doanh nghiệp và tin tuyển dụng.', true); return; }
  if (user.role !== 'employer') { notice('Tài khoản hiện tại không có quyền nhà tuyển dụng.', true); return; }
  const { company } = await api('/api/employer/company'); companyData = company;
  if (company) {
    fill($('#company-form'), company); fill($('#company-extra-form'), { ...company, branches: (company.branches || []).map(item => `${item.name} | ${item.address}`).join('\n'), benefits: (company.benefits || []).join('\n') });
    const status = { unverified: 'Chưa xác minh', pending_review: 'Đang chờ duyệt', verified: 'Đã xác minh', rejected: 'Bị từ chối', needs_more: 'Cần bổ sung' }[company.verificationStatus] || 'Chưa xác minh';
    $('#verification-status').textContent = status; $('#verification-status').className = `s2-status ${company.verificationStatus || ''}`;
    $('#company-documents').innerHTML = (company.documents || []).map(document => `<p class="s2-meta">${escapeHtml(document.fileName)} · ${escapeHtml(document.scanStatus)} · ${new Date(document.uploadedAt).toLocaleDateString('vi-VN')}</p>`).join('') || '<p class="s2-muted">Chưa tải giấy tờ.</p>';
  }
  await loadJobs();
}
$('#company-form').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.submitter; button.disabled = true;
  try { const { company } = await api('/api/employer/company', { method: 'PUT', body: JSON.stringify({ company: Object.fromEntries(new FormData(event.currentTarget)) }) }); fill(event.currentTarget, company); notice('Đã lưu hồ sơ doanh nghiệp.'); }
  catch (error) { notice(error.message, true); } finally { button.disabled = false; }
});
$('#company-extra-form').addEventListener('submit', async event => {
  event.preventDefault(); const fields = Object.fromEntries(new FormData(event.currentTarget));
  const company = { ...(companyData || {}), ...fields, branches: fields.branches.split('\n').map(line => { const [name, ...address] = line.split('|'); return { name: name.trim(), address: address.join('|').trim() }; }).filter(branch => branch.address), benefits: fields.benefits.split('\n').map(item => item.trim()).filter(Boolean) };
  try { const result = await api('/api/employer/company', { method: 'PUT', body: JSON.stringify({ company }) }); companyData = result.company; notice('Đã lưu thông tin bổ sung.'); } catch (error) { notice(error.message, true); }
});
$('#verification-form').addEventListener('submit', async event => {
  event.preventDefault(); const file = event.currentTarget.elements.document.files[0]; if (!file) return;
  if (file.size > 5 * 1024 * 1024) { notice('Tệp vượt quá 5 MB.', true); return; }
  const bytes = new Uint8Array(await file.arrayBuffer()); let binary = ''; for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  try { const result = await api('/api/employer/company/documents', { method: 'POST', body: JSON.stringify({ document: { fileName: file.name, mimeType: file.type, dataBase64: btoa(binary) } }) }); notice('Tệp đã quét sạch và chuyển vào hàng đợi xác minh.'); event.currentTarget.reset(); const { company } = await api('/api/employer/company'); companyData = company; $('#verification-status').textContent = 'Đang chờ duyệt'; $('#company-documents').innerHTML = (company.documents || []).map(document => `<p class="s2-meta">${escapeHtml(document.fileName)} · ${escapeHtml(document.scanStatus)}</p>`).join(''); }
  catch (error) { notice(error.message, true); }
});
$('#job-form').addEventListener('submit', async event => {
  event.preventDefault(); const form = event.currentTarget; const button = event.submitter; button.disabled = true;
  const source = { ...Object.fromEntries(new FormData(form)), ...Object.fromEntries(new FormData($('#job-extra-form'))) }; source.skillCriteria = source.skillCriteria.split('\n').map(line => { const [skill, importance = 'required', weight = '1'] = line.split('|').map(value => value.trim()); return skill ? { skill, importance, weight: Number(weight) || 1 } : null; }).filter(Boolean); source.criteriaWeights = { skills: source.weightSkills, education: source.weightEducation, experience: source.weightExperience, languages: source.weightLanguages, projects: source.weightProjects }; source.status = button.name === 'draft' ? 'draft' : 'pending_review';
  if (source.status !== 'draft' && !source.expiresAt) { notice('Tin gửi duyệt cần có hạn đăng.', true); button.disabled = false; return; }
  const editingId = form.dataset.editing;
  try { await api(editingId ? `/api/employer/jobs/${encodeURIComponent(editingId)}` : '/api/employer/jobs', { method: editingId ? 'PATCH' : 'POST', body: JSON.stringify({ job: source }) }); form.reset(); $('#job-extra-form').reset(); delete form.dataset.editing; notice(editingId ? 'Đã cập nhật tin và gửi kiểm duyệt lại.' : source.status === 'draft' ? 'Đã lưu bản nháp.' : 'Tin đã gửi vào hàng đợi kiểm duyệt.'); await loadJobs(); }
  catch (error) { notice(error.message, true); } finally { button.disabled = false; }
});
$('#reload').addEventListener('click', async () => { try { await loadJobs(); } catch (error) { notice(error.message, true); } });
$('#my-jobs').addEventListener('click', async event => {
  const edit = event.target.closest('[data-edit]'); const action = event.target.closest('[data-clone],[data-pause],[data-close],[data-renew]');
  if (edit) { const job = knownJobs.get(edit.dataset.edit); if (!job) return; const form = $('#job-form'); fill(form, job); fill($('#job-extra-form'), { ...job, skillCriteria: (job.skillCriteria || job.skills || []).map(item => `${item.skill || item} | ${item.importance || 'required'} | ${item.weight || 1}`).join('\n'), weightSkills: job.criteriaWeights?.skills, weightEducation: job.criteriaWeights?.education, weightExperience: job.criteriaWeights?.experience, weightLanguages: job.criteriaWeights?.languages, weightProjects: job.criteriaWeights?.projects }); form.dataset.editing = job.id; form.scrollIntoView({ behavior: 'smooth', block: 'center' }); form.elements.namedItem('title').focus(); notice('Đang chỉnh sửa tin. Gửi lại sẽ chuyển tin về hàng đợi kiểm duyệt.'); }
  if (action) { const [kind] = action.dataset ? Object.keys(action.dataset).filter(key => ['clone', 'pause', 'close', 'renew'].includes(key)) : []; const id = action.dataset[kind]; try { if (kind === 'clone') await api(`/api/employer/jobs/${encodeURIComponent(id)}/clone`, { method: 'POST', body: '{}' }); else if (kind === 'renew') { const expiresAt = prompt('Nhập ngày hết hạn mới (YYYY-MM-DD):'); if (!expiresAt) return; await api(`/api/employer/jobs/${encodeURIComponent(id)}/renew`, { method: 'POST', body: JSON.stringify({ expiresAt }) }); } else await api(`/api/employer/jobs/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status: kind === 'pause' ? 'paused' : 'closed' }) }); notice('Đã cập nhật trạng thái tin.'); await loadJobs(); } catch (error) { notice(error.message, true); } }
});
init().catch(error => notice(error.message, true));
