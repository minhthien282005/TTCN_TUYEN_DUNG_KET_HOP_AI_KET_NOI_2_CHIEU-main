const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const slugify = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
let page = 1; let pages = 1;
async function loadJobs() {
  const form = new FormData($('#search-form')); const params = new URLSearchParams();
  for (const [key, value] of form) if (String(value).trim()) params.set(key, value);
  params.set('page', String(page));
  const response = await fetch(`/api/jobs?${params}`); const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Không thể tải danh sách việc làm.');
  pages = result.pages; $('#result-count').textContent = `${result.total} việc làm phù hợp`;
  $('#job-results').innerHTML = result.jobs.length ? result.jobs.map(job => `<article class="s2-public-card"><div><h3>${escapeHtml(job.title)}</h3><p class="s2-meta">${escapeHtml(job.company)} · ${escapeHtml(job.industry)} · ${escapeHtml(job.location)}</p><p class="s2-description">${escapeHtml(job.description.slice(0, 360))}${job.description.length > 360 ? '…' : ''}</p><p>${escapeHtml(job.type)} · ${escapeHtml(job.workMode)}${job.skills.length ? ` · ${job.skills.map(item => `${escapeHtml(item.skill || item)}${item.importance === 'required' ? ' *' : ''}`).join(' · ')}` : ''}</p>${job.salaryMin || job.salaryMax ? `<p class="s2-salary">${job.salaryMin ? Number(job.salaryMin).toLocaleString('vi-VN') : 'Thỏa thuận'} – ${job.salaryMax ? Number(job.salaryMax).toLocaleString('vi-VN') : 'Thỏa thuận'} VNĐ/tháng</p>` : ''}<div class="s2-actions"><a class="s2-detail-link" href="/jobs/${slugify(job.title)}--${encodeURIComponent(job.id)}">Xem chi tiết <span aria-hidden="true">↗</span></a><button class="s2-button s2-secondary" type="button" data-save="${escapeHtml(job.id)}">Lưu tin ♡</button></div></div><span class="s2-meta">${new Date(job.publishedAt).toLocaleDateString('vi-VN')}</span></article>`).join('') : '<div class="s2-panel"><p class="s2-muted">Chưa có tin phù hợp. Hãy thử thay đổi từ khóa hoặc bộ lọc.</p></div>';
  $('#pagination').innerHTML = pages > 1 ? Array.from({ length: pages }, (_, index) => index + 1).map(value => `<button type="button" data-page="${value}" ${value === page ? 'aria-current="page"' : ''}>${value}</button>`).join('') : '';
}
$('#search-form').addEventListener('submit', event => { event.preventDefault(); page = 1; loadJobs().catch(showError); });
$('#clear-search').addEventListener('click', () => { $('#search-form').reset(); page = 1; loadJobs().catch(showError); });
$('#pagination').addEventListener('click', event => { const button = event.target.closest('[data-page]'); if (button) { page = Number(button.dataset.page); loadJobs().catch(showError); } });
$('#job-results').addEventListener('click', async event => {
  const button = event.target.closest('[data-save]'); if (!button) return; button.disabled = true;
  try { await fetch('/api/student/saved-jobs', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId: button.dataset.save }) }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Không thể lưu tin.'); }); $('#results-notice').innerHTML = '<p class="s2-notice ok">Đã lưu tin. Xem danh sách trong mục “Tin đã lưu / đã xem”.</p>'; button.textContent = 'Đã lưu ✓'; }
  catch (error) { $('#results-notice').innerHTML = `<p class="s2-notice error">${escapeHtml(error.message)} Hãy đăng nhập tài khoản sinh viên.</p>`; button.disabled = false; }
});
function showError(error) { $('#job-results').innerHTML = `<div class="s2-notice error">${escapeHtml(error.message)}</div>`; }
loadJobs().catch(showError);
