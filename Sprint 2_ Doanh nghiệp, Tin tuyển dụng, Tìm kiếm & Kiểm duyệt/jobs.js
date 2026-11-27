const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const slugify = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const searchForm = $('#search-form');
const advancedFields = new Set(['skill', 'salaryMin', 'salaryMax', 'level', 'experience', 'workMode', 'companySize', 'postedWithin', 'language']);
let page = 1;
let pages = 1;
let activeRequest = 0;

function readUrlState() {
  const params = new URLSearchParams(location.search);
  for (const field of searchForm.elements) {
    if (!field.name || !params.has(field.name)) continue;
    field.value = params.get(field.name);
  }
  page = Math.max(1, Number(params.get('page')) || 1);
  if ([...advancedFields].some(key => params.has(key))) $('.s2-advanced').open = true;
}

function makeSearchParams() {
  const params = new URLSearchParams();
  for (const [key, value] of new FormData(searchForm)) if (String(value).trim()) params.set(key, String(value).trim());
  params.set('page', String(page));
  return params;
}

function updateUrl(mode, params) {
  if (mode === 'none') return;
  const query = params.toString();
  const next = `${location.pathname}${query ? `?${query}` : ''}`;
  if (next === `${location.pathname}${location.search}`) return;
  history[mode === 'push' ? 'pushState' : 'replaceState']({ ketnoiSearch: true }, '', next);
}

function setBusy(busy) {
  $('#job-results').setAttribute('aria-busy', String(busy));
  const button = searchForm.querySelector('button[type="submit"],button:not([type])');
  if (button) { button.disabled = busy; button.setAttribute('aria-busy', String(busy)); }
  if (busy) $('#results-notice').textContent = 'Đang cập nhật kết quả…';
}

function renderJobCard(job) {
  const skills = (job.skills || []).slice(0, 4).map(item => {
    const label = typeof item === 'string' ? item : item.skill || item.name || '';
    return label ? `<span class="s2-job-chip">${escapeHtml(label)}</span>` : '';
  }).filter(Boolean).join('');
  const publishedAt = job.publishedAt && Number.isFinite(Date.parse(job.publishedAt)) ? new Date(job.publishedAt) : null;
  const salary = job.salaryMin || job.salaryMax
    ? `${job.salaryMin ? Number(job.salaryMin).toLocaleString('vi-VN') : 'Thỏa thuận'} – ${job.salaryMax ? Number(job.salaryMax).toLocaleString('vi-VN') : 'Thỏa thuận'} VNĐ/tháng`
    : 'Mức lương thỏa thuận';
  const href = `/jobs/${slugify(job.title)}--${encodeURIComponent(job.id)}`;
  return `<article class="s2-public-card s2-job-card"><div class="s2-job-card-content"><div class="s2-job-card-top"><span class="s2-job-verified"><span aria-hidden="true">✓</span> Tin đã xác minh</span><time class="s2-job-date" datetime="${publishedAt ? publishedAt.toISOString() : ''}">${publishedAt ? `Đăng ${publishedAt.toLocaleDateString('vi-VN')}` : 'Cơ hội mới'}</time></div><h3><a href="${escapeHtml(href)}">${escapeHtml(job.title)}</a></h3><p class="s2-meta s2-job-company">${escapeHtml(job.company)} <span aria-hidden="true">·</span> ${escapeHtml(job.industry)} <span aria-hidden="true">·</span> ${escapeHtml(job.location)}</p><p class="s2-description">${escapeHtml(job.description.slice(0, 260))}${job.description.length > 260 ? '…' : ''}</p><div class="s2-job-tags"><span class="s2-job-chip s2-job-chip-primary">${escapeHtml(job.type || 'Linh hoạt')}</span><span class="s2-job-chip">${escapeHtml(job.workMode || job.location || 'Linh hoạt')}</span>${skills}</div><p class="s2-salary"><span aria-hidden="true">↗</span> ${escapeHtml(salary)}</p><div class="s2-actions"><a class="s2-detail-link" href="${escapeHtml(href)}">Xem chi tiết <span aria-hidden="true">↗</span></a><button class="s2-button s2-secondary s2-save-button" type="button" data-save="${escapeHtml(job.id)}">Lưu tin <span aria-hidden="true">♡</span></button></div></div></article>`;
}

async function loadJobs({ historyMode = 'replace' } = {}) {
  const requestId = ++activeRequest;
  const params = makeSearchParams();
  updateUrl(historyMode, params);
  setBusy(true);
  try {
    const response = await fetch(`/api/jobs?${params}`, { credentials: 'same-origin' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Không thể tải danh sách việc làm.');
    if (requestId !== activeRequest) return;
    pages = result.pages;
    if (page > pages && pages > 0) { page = pages; return loadJobs({ historyMode: 'replace' }); }
    $('#result-count').textContent = `${result.total} việc làm phù hợp`;
    $('#job-results').innerHTML = result.jobs.length ? result.jobs.map(renderJobCard).join('') : '<div class="s2-job-empty"><span aria-hidden="true">⌕</span><h3>Chưa có tin phù hợp</h3><p>Thử thay đổi bộ lọc hoặc xóa điều kiện tìm kiếm để xem thêm cơ hội.</p></div>';
    $('#pagination').innerHTML = pages > 1 ? Array.from({ length: pages }, (_, index) => index + 1).map(value => `<button type="button" data-page="${value}" ${value === page ? 'aria-current="page"' : ''}>${value}</button>`).join('') : '';
    $('#results-notice').textContent = '';
  } catch (error) {
    if (requestId !== activeRequest) return;
    $('#results-notice').innerHTML = `<p class="s2-notice error">${escapeHtml(error.message)} <button type="button" id="retry-search">Thử lại</button></p>`;
  } finally {
    if (requestId === activeRequest) setBusy(false);
  }
}

searchForm.addEventListener('submit', event => { event.preventDefault(); page = 1; loadJobs({ historyMode: 'push' }); });
$('#clear-search').addEventListener('click', () => { searchForm.reset(); $('.s2-advanced').open = false; page = 1; loadJobs({ historyMode: 'push' }); });
$('#pagination').addEventListener('click', event => { const button = event.target.closest('[data-page]'); if (button) { page = Number(button.dataset.page); loadJobs({ historyMode: 'push' }); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
$('#job-results').addEventListener('click', async event => {
  const button = event.target.closest('[data-save]'); if (!button) return;
  button.disabled = true; button.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch('/api/student/saved-jobs', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId: button.dataset.save }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(data.error || 'Không thể lưu tin.'); error.status = response.status; throw error; }
    $('#results-notice').innerHTML = '<p class="s2-notice ok">Đã lưu tin. Mở mục <a href="/my-jobs.html">Tin đã lưu</a> để xem lại.</p>';
    button.textContent = 'Đã lưu ✓'; button.classList.add('is-saved'); button.disabled = true;
  } catch (error) {
    if (error.status === 401) $('#results-notice').innerHTML = `<p class="s2-notice error">Đăng nhập bằng tài khoản sinh viên để lưu tin. <a class="s2-button s2-secondary" href="/?${new URLSearchParams({ open: 'login', next: `${location.pathname}${location.search}` })}">Đăng nhập</a></p>`;
    else if (error.status === 403) $('#results-notice').innerHTML = '<p class="s2-notice error">Tính năng lưu tin dành cho tài khoản sinh viên.</p>';
    else $('#results-notice').innerHTML = `<p class="s2-notice error">${escapeHtml(error.message)}</p>`;
    button.disabled = false;
  } finally { button.removeAttribute('aria-busy'); }
});
$('#results-notice').addEventListener('click', event => { if (event.target.id === 'retry-search') loadJobs({ historyMode: 'none' }); });
window.addEventListener('popstate', () => { readUrlState(); loadJobs({ historyMode: 'none' }); });
readUrlState();
loadJobs();
