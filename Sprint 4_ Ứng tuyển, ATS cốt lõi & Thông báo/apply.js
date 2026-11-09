(() => {
  const $ = selector => document.querySelector(selector);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const notice = (message, error = false) => { const node = $('#apply-notice'); node.textContent = message; node.className = message ? `s4-notice${error ? ' error' : ''}` : ''; };
  const api = async (url, options = {}) => { const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) } }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || `Yêu cầu lỗi (${response.status}).`); return data; };
  const jobId = new URLSearchParams(location.search).get('job'); let idempotencyKey = '';
  function renderQuestions(questions) {
    $('#question-note').textContent = questions.some(item => item.knockout) ? 'Một số câu hỏi là tiêu chí bắt buộc; hãy đọc kỹ trước khi gửi.' : '';
    $('#screening-questions').innerHTML = questions.map((question, index) => `<fieldset class="s4-question"><legend>${index + 1}. ${escape(question.prompt)}${question.required ? ' *' : ''}${question.knockout ? ' · Tiêu chí bắt buộc' : ''}</legend>${question.type === 'single_choice' ? `<select data-answer="${escape(question.id)}" ${question.required ? 'required' : ''}><option value="">Chọn câu trả lời</option>${question.options.map(option => `<option value="${escape(option)}">${escape(option)}</option>`).join('')}</select>` : question.type === 'boolean' ? `<label><input type="radio" name="answer-${escape(question.id)}" value="Có" data-answer="${escape(question.id)}" ${question.required ? 'required' : ''}> Có</label><label><input type="radio" name="answer-${escape(question.id)}" value="Không" data-answer="${escape(question.id)}"> Không</label>` : `<textarea data-answer="${escape(question.id)}" maxlength="1000" rows="3" ${question.required ? 'required' : ''}></textarea>`}</fieldset>`).join('');
  }
  async function load() {
    if (!jobId) { notice('Thiếu mã tin tuyển dụng trong đường dẫn.', true); $('#application-form').hidden = true; return; }
    const { user } = await api('/api/me');
    if (!user || user.role !== 'student') { notice('Đăng nhập bằng tài khoản sinh viên để tiếp tục.', true); $('#application-form').hidden = true; return; }
    const data = await api(`/api/sprint4/jobs/${encodeURIComponent(jobId)}/apply-data`);
    $('#job-heading').textContent = `${data.job.title} · ${data.job.company}`;
    const select = $('#cv-select'); select.innerHTML = data.cvs.length ? `<option value="">Chọn CV</option>${data.cvs.map(cv => `<option value="${escape(cv.id)}" ${cv.isDefault ? 'selected' : ''}>${escape(cv.originalName)} · ${cv.status === 'confirmed' ? 'đã xác nhận' : 'đã xử lý'}</option>`).join('')}` : '<option value="">Chưa có CV hợp lệ</option>';
    if (!data.cvs.length) { $('#cv-help').innerHTML = 'Tải và xử lý CV trước tại <a href="/cv.html">CV &amp; hồ sơ</a>.'; $('#submit-application').disabled = true; }
    if (data.alreadyApplied) { notice('Bạn đã nộp hồ sơ cho vị trí này. Xem tiến trình tại “Ứng tuyển của tôi”.'); $('#application-form').hidden = true; }
    renderQuestions(data.questions || []);
  }
  $('#application-form').addEventListener('submit', async event => {
    event.preventDefault(); const button = $('#submit-application'); button.disabled = true; notice('Đang gửi hồ sơ…');
    try {
      const form = new FormData(event.currentTarget); const answers = [...document.querySelectorAll('[data-answer]')].map(control => ({ questionId: control.dataset.answer, value: control.type === 'radio' ? (document.querySelector(`[name="answer-${CSS.escape(control.dataset.answer)}"]:checked`)?.value || '') : control.value })).filter((item, index, all) => all.findIndex(other => other.questionId === item.questionId) === index);
      if (!idempotencyKey) idempotencyKey = crypto.randomUUID();
      const result = await api('/api/sprint4/student/applications', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify({ jobId, cvId: form.get('cvId'), coverLetter: form.get('coverLetter'), portfolioLinks: String(form.get('portfolioLinks') || '').split(/\r?\n/).map(value => value.trim()).filter(Boolean), answers }) });
      notice(result.application.status === 'rejected' ? 'Hồ sơ đã được ghi nhận; câu trả lời chưa đáp ứng tiêu chí bắt buộc của tin.' : 'Đã nộp hồ sơ. Bạn có thể theo dõi tiến trình trong mục Ứng tuyển của tôi.'); idempotencyKey = ''; event.currentTarget.reset();
      setTimeout(() => { location.href = '/applications.html'; }, 1300);
    } catch (error) { notice(error.message, true); button.disabled = false; }
  });
  load().catch(error => notice(error.message, true));
})();
