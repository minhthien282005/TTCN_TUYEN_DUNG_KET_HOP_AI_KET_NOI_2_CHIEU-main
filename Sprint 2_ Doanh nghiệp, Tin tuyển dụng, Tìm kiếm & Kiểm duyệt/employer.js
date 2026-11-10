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
let knownJobs = new Map();
async function loadJobs() {
  const { jobs } = await api('/api/employer/jobs');
  knownJobs = new Map(jobs.map(job => [job.id, job]));
  $('#my-jobs').innerHTML = jobs.length ? jobs.map(job => `<article class="s2-job-row"><div><h3>${escapeHtml(job.title)}</h3><p>${escapeHtml(job.location)} · ${escapeHtml(job.type)} · ${escapeHtml(job.workMode)} · Hạn ${job.expiresAt ? new Date(job.expiresAt).toLocaleDateString('vi-VN') : 'chưa đặt'}</p>${job.moderationNote ? `<p class="s2-note">Ghi chú: ${escapeHtml(job.moderationNote)}</p>` : ''}<p>Cập nhật ${job.updatedAt ? new Date(job.updatedAt).toLocaleDateString('vi-VN') : ''}</p><div class="s2-actions"><button class="s2-button s2-secondary" data-edit="${escapeHtml(job.id)}">Chỉnh sửa / gửi duyệt lại</button><button class="s2-button s2-secondary" data-clone="${escapeHtml(job.id)}">Nhân bản</button>${job.status === 'published' ? `<button class="s2-button s2-secondary" data-pause="${escapeHtml(job.id)}">Tạm dừng</button>` : ''}${['paused', 'expired', 'closed'].includes(job.status) ? `<button class="s2-button s2-secondary" data-renew="${escapeHtml(job.id)}">Gia hạn</button>` : ''}${!['closed', 'archived'].includes(job.status) ? `<button class="s2-button s2-secondary" data-close="${escapeHtml(job.id)}">Đóng tin</button>` : ''}</div></div><span class="s2-status ${escapeHtml(job.status)}">${labels[job.status] || escapeHtml(job.status)}</span></article>`).join('') : '<p class="s2-muted">Chưa có tin tuyển dụng. Tạo tin đầu tiên ở biểu mẫu phía trên.</p>';
}
async function init() {
  const { user } = await api('/api/me');
  if (!user) { notice('Hãy đăng nhập bằng tài khoản nhà tuyển dụng để đăng tin.', true); return; }
  if (user.role !== 'employer') { notice('Tài khoản hiện tại không có quyền nhà tuyển dụng.', true); return; }
  const { company } = await api('/api/employer/company');
  const status = company?.verificationStatus || 'unverified';
  const statusText = { verified: 'Doanh nghiệp đã xác minh. Tin mới vẫn cần được kiểm duyệt trước khi công khai.', pending_review: 'Hồ sơ doanh nghiệp đang chờ xác minh.', needs_more: 'Hồ sơ doanh nghiệp cần bổ sung thông tin.', rejected: 'Hồ sơ doanh nghiệp chưa được xác minh.' }[status] || 'Hồ sơ doanh nghiệp chưa được xác minh.';
  $('#company-status').innerHTML = `<div class="s2-notice ${status === 'verified' ? 'ok' : 'error'}">${escapeHtml(statusText)} <a href="/employer-profile.html">Mở hồ sơ doanh nghiệp ↗</a></div>`;
  await loadJobs();
}
$('#job-form').addEventListener('submit', async event => {
  event.preventDefault(); const form = event.currentTarget; const button = event.submitter; button.disabled = true;
  const source = Object.fromEntries(new FormData(form));
  source.skillCriteria = String(source.skillCriteria || '').split('\n').map(line => { const [skill, importance = 'required', weight = '1'] = line.split('|').map(value => value.trim()); return skill ? { skill, importance, weight: Number(weight) || 1 } : null; }).filter(Boolean);
  source.criteriaWeights = { skills: source.weightSkills, education: source.weightEducation, experience: source.weightExperience, languages: source.weightLanguages, projects: source.weightProjects };
  source.status = button.name === 'draft' ? 'draft' : 'pending_review';
  if (source.status !== 'draft' && !source.expiresAt) { notice('Tin đăng tuyển cần có hạn đăng.', true); button.disabled = false; return; }
  const editingId = form.dataset.editing;
  try {
    await api(editingId ? `/api/employer/jobs/${encodeURIComponent(editingId)}` : '/api/employer/jobs', { method: editingId ? 'PATCH' : 'POST', body: JSON.stringify({ job: source }) });
    form.reset(); delete form.dataset.editing;
    notice(editingId ? 'Đã cập nhật tin và gửi kiểm duyệt lại.' : source.status === 'draft' ? 'Đã lưu bản nháp.' : 'Đã gửi tin vào hàng đợi kiểm duyệt.'); await loadJobs();
  } catch (error) { notice(error.message, true); } finally { button.disabled = false; }
});
$('#reload').addEventListener('click', async () => { try { await loadJobs(); } catch (error) { notice(error.message, true); } });
$('#my-jobs').addEventListener('click', async event => {
  const edit = event.target.closest('[data-edit]'); const action = event.target.closest('[data-clone],[data-pause],[data-close],[data-renew]');
  if (edit) {
    const job = knownJobs.get(edit.dataset.edit); if (!job) return;
    const form = $('#job-form'); fill(form, { ...job, expiresAt: job.expiresAt?.slice(0, 10), skillCriteria: (job.skillCriteria || job.skills || []).map(item => `${item.skill || item} | ${item.importance || 'required'} | ${item.weight || 1}`).join('\n'), weightSkills: job.criteriaWeights?.skills, weightEducation: job.criteriaWeights?.education, weightExperience: job.criteriaWeights?.experience, weightLanguages: job.criteriaWeights?.languages, weightProjects: job.criteriaWeights?.projects });
    form.dataset.editing = job.id; form.scrollIntoView({ behavior: 'smooth', block: 'center' }); form.elements.namedItem('title').focus(); notice('Đang chỉnh sửa tin. Gửi lại sẽ đưa tin về hàng đợi kiểm duyệt.');
  }
  if (action) {
    const kind = ['clone', 'pause', 'close', 'renew'].find(key => action.hasAttribute(`data-${key}`)); const id = action.dataset[kind];
    try {
      if (kind === 'clone') await api(`/api/employer/jobs/${encodeURIComponent(id)}/clone`, { method: 'POST', body: '{}' });
      else if (kind === 'renew') { const expiresAt = prompt('Nhập ngày hết hạn mới (YYYY-MM-DD):'); if (!expiresAt) return; await api(`/api/employer/jobs/${encodeURIComponent(id)}/renew`, { method: 'POST', body: JSON.stringify({ expiresAt }) }); }
      else await api(`/api/employer/jobs/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status: kind === 'pause' ? 'paused' : 'closed' }) });
      notice('Đã cập nhật trạng thái tin.'); await loadJobs();
    } catch (error) { notice(error.message, true); }
  }
});
init().catch(error => notice(error.message, true));
