(() => {
  const $ = selector => document.querySelector(selector);
  const notice = $('#s5-tools-notice');
  const consentRow = $('#s5-tools-consent-row'); const consent = $('#s5-tools-consent');
  const jobsForm = $('#s5-job-draft-form'); const cvForm = $('#s5-cv-draft-form'); const summaryForm = $('#s5-cv-summary-form');
  let user = null;
  async function request(path, options = {}) {
    const response = await fetch(path, { credentials: 'same-origin', ...options, headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}) } });
    const data = await response.json().catch(() => ({})); if (!response.ok) throw Object.assign(new Error(data.error || 'Yêu cầu chưa hoàn tất.'), { status: response.status }); return data;
  }
  function showToolStatus(error = false) { notice.classList.toggle('error', error); }
  async function init() {
    const me = await request('/api/me'); user = me.user;
    if (!user) { notice.innerHTML = 'Đăng nhập tài khoản sinh viên hoặc nhà tuyển dụng để sử dụng công cụ. <a href="/?open=login&amp;next=%2Fai-tools.html">Đăng nhập ↗</a>'; showToolStatus(true); return; }
    if (user.role === 'student') { $('#s5-student-tool').hidden = false; notice.textContent = 'Trợ lý CV dựa trên thông tin bạn nhập. Hãy xác minh nội dung trước khi sao chép vào hồ sơ.'; }
    else if (user.role === 'employer') { $('#s5-employer-tool').hidden = false; notice.textContent = 'Trợ lý soạn tin từ dữ kiện bạn cung cấp. Hãy kiểm tra nội dung trước khi đưa vào biểu mẫu đăng tuyển.'; }
    else { notice.textContent = 'Công cụ dành cho tài khoản sinh viên và nhà tuyển dụng.'; showToolStatus(true); return; }
    const status = await request('/api/sprint5/status');
    if (status.generativeAvailable) { consentRow.hidden = false; consent.checked = Boolean(status.externalAiConsented); }
  }
  consent?.addEventListener('change', async () => {
    if (!user) return; consent.disabled = true;
    try { await request('/api/sprint5/consent', { method: 'POST', body: JSON.stringify({ granted: consent.checked }) }); }
    catch (error) { consent.checked = !consent.checked; notice.textContent = error.message; showToolStatus(true); }
    finally { consent.disabled = false; }
  });
  async function submitDraft(event, task, outputId, resultId) {
    event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('[type="submit"]'); button.disabled = true; notice.textContent = 'Đang chuẩn bị bản nháp…'; showToolStatus();
    const payload = Object.fromEntries(new FormData(form)); payload.task = task; payload.externalConsent = Boolean(consent?.checked);
    try {
      const result = await request('/api/sprint5/assist', { method: 'POST', body: JSON.stringify(payload) });
      $(outputId).value = result.suggestion; $(resultId).hidden = false;
      $(resultId).querySelector('.s5-result-mode')?.replaceChildren(document.createTextNode(result.mode === 'generative' ? 'Đã tạo với mô hình AI' : 'Đã tạo nội bộ'));
      notice.textContent = 'Bản nháp đã sẵn sàng. Hãy kiểm tra thông tin trước khi dùng.'; showToolStatus();
    } catch (error) { notice.textContent = error.message; showToolStatus(true); }
    finally { button.disabled = false; }
  }
  jobsForm.addEventListener('submit', event => submitDraft(event, 'job_description', '#s5-job-output', '#s5-job-result'));
  cvForm.addEventListener('submit', event => submitDraft(event, 'cv_bullet', '#s5-cv-output', '#s5-cv-result'));
  summaryForm.addEventListener('submit', event => submitDraft(event, 'cv_summary', '#s5-summary-output', '#s5-summary-result'));
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-copy]'); if (!button) return;
    const output = document.getElementById(button.dataset.copy); if (!output?.value) return;
    try { await navigator.clipboard.writeText(output.value); button.textContent = 'Đã sao chép ✓'; }
    catch { output.focus(); output.select(); document.execCommand('copy'); button.textContent = 'Đã sao chép ✓'; }
    setTimeout(() => { button.textContent = button.dataset.copy === 's5-job-output' ? 'Sao chép bản nháp' : button.dataset.copy === 's5-cv-output' ? 'Sao chép câu mô tả' : 'Sao chép'; }, 1800);
  });
  init().catch(error => { notice.textContent = error.message; showToolStatus(true); });
})();
// Note: Sprint 5 update date 10/11/2026.
