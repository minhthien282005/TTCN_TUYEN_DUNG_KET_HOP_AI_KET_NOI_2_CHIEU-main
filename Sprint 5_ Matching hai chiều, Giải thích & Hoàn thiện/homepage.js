(() => {
  const search = document.querySelector('#home-job-search');
  const list = document.querySelector('#home-jobs-list');
  if (!search || !list) return;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const card = job => {
    const salary = job.salaryMin || job.salaryMax ? `${job.salaryMin ? Number(job.salaryMin).toLocaleString('vi-VN') : 'Thỏa thuận'} – ${job.salaryMax ? Number(job.salaryMax).toLocaleString('vi-VN') : 'Thỏa thuận'} đ/tháng` : 'Lương trao đổi';
    const href = job.href || `/jobs/${encodeURIComponent(String(job.title || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))}--${encodeURIComponent(job.id)}`;
    const relevance = Number.isFinite(Number(job.score)) ? `<span class="s5-home-relevance">${Math.max(0, Math.min(100, Number(job.score)))}% phù hợp</span>` : '';
    return `<article class="s5-home-job-card"><div class="s5-home-job-top"><span class="s5-home-company-mark">${escape((job.company || 'K').slice(0, 1).toUpperCase())}</span><span class="s5-home-job-type">${escape(job.type || 'Cơ hội nghề nghiệp')}</span>${relevance}</div><h3><a href="${escape(href)}">${escape(job.title)}</a></h3><p class="s5-home-company">${escape(job.company || 'Doanh nghiệp')}</p><div class="s5-home-job-meta"><span>⌖ ${escape(job.location || 'Linh hoạt')}</span><span>◷ ${escape(job.workMode || 'Trao đổi')}</span></div><div class="s5-home-job-bottom"><strong>${escape(salary)}</strong><a href="${escape(href)}" aria-label="Xem ${escape(job.title)}">Xem việc ↗</a></div></article>`;
  };
  search.addEventListener('submit', event => {
    event.preventDefault(); const params = new URLSearchParams();
    for (const [key, value] of new FormData(search)) if (String(value).trim()) params.set(key, String(value).trim());
    window.location.href = `/jobs.html${params.size ? `?${params}` : ''}`;
  });
  async function load() {
    const [meResponse, jobsResponse] = await Promise.all([fetch('/api/me', { credentials: 'same-origin' }), fetch('/api/jobs?page=1&pageSize=6&sort=newest', { credentials: 'same-origin' })]);
    const { user } = await meResponse.json(); const result = await jobsResponse.json();
    let jobs = result.jobs || [];
    if (user?.role === 'student') {
      const response = await fetch('/api/sprint5/matches', { credentials: 'same-origin' });
      if (response.ok) {
        const data = await response.json();
        if (data.matches?.length) {
          document.querySelector('#home-jobs-title').innerHTML = 'Gợi ý <em>cho bạn.</em>';
          document.querySelector('#home-jobs-subtitle').textContent = 'Được sắp xếp theo kỹ năng, định hướng và địa điểm trong hồ sơ của bạn.';
          document.querySelector('#home-jobs-link').href = '/matches.html'; document.querySelector('#home-jobs-link').innerHTML = 'Xem mọi gợi ý <span>↗</span>';
          jobs = data.matches.slice(0, 6);
        }
      }
    }
    if (user?.role === 'employer') {
      document.querySelector('#home-jobs-subtitle').textContent = 'Khám phá cơ hội công khai hoặc mở gợi ý ứng viên cho tin của bạn.';
      document.querySelector('#home-jobs-link').href = '/matches.html'; document.querySelector('#home-jobs-link').innerHTML = 'Ứng viên phù hợp <span>↗</span>';
    }
    list.innerHTML = jobs.length ? jobs.map(card).join('') : '<div class="s5-home-no-jobs"><strong>Chưa có tin tuyển dụng phù hợp.</strong><p>Thử vị trí hoặc địa điểm khác, hoặc quay lại sau.</p><a href="/jobs.html">Mở trang tìm việc ↗</a></div>';
  }
  load().catch(() => { list.innerHTML = '<div class="s5-home-no-jobs"><strong>Chưa tải được danh sách việc.</strong><p>Bạn có thể vào trang tìm việc để xem các tin đang công khai.</p><a href="/jobs.html">Tìm việc ↗</a></div>'; });
})();
// Note: Sprint 5 update date 10/11/2026.
