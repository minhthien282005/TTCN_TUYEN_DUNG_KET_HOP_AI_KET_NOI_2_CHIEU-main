(() => {
  const $ = selector => document.querySelector(selector);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const api = async (url, options = {}) => { const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) } }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || `Yêu cầu lỗi (${response.status}).`); return data; };
  const notice = (message, error = false) => { $('#ats-notice').textContent = message; $('#ats-notice').className = message ? `s4-notice${error ? ' error' : ''}` : ''; };
  let jobs = []; let stages = []; let applications = []; let activeApplication = null; let questions = [];
  const stageLabel = key => stages.find(item => item.key === key)?.label || ({ rejected: 'Từ chối', withdrawn: 'Đã rút' }[key] || key);
  function questionRow(question = {}) {
    const type = question.type || 'text';
    return `<div class="s4-question-row" data-question-row data-id="${escape(question.id || '')}"><label class="s4-field">Câu hỏi<input data-q-prompt maxlength="300" value="${escape(question.prompt || '')}" placeholder="Ví dụ: Bạn có thể bắt đầu từ ngày nào?" required></label><label class="s4-field">Loại<select data-q-type><option value="text" ${type === 'text' ? 'selected' : ''}>Trả lời ngắn</option><option value="single_choice" ${type === 'single_choice' ? 'selected' : ''}>Chọn một</option><option value="boolean" ${type === 'boolean' ? 'selected' : ''}>Có / Không</option></select></label><label class="s4-field">Lựa chọn / đáp án đúng<input data-q-options value="${escape(type === 'boolean' ? 'Có | Không' : (question.options || []).join(' | '))}" placeholder="Có | Không | Chưa"></label><label class="s4-field">Tiêu chí<select data-q-mode><option value="optional" ${question.required === false ? 'selected' : ''}>Không bắt buộc</option><option value="required" ${question.required === false ? '' : 'selected'}>Bắt buộc</option><option value="knockout" ${question.knockout ? 'selected' : ''}>Knock-out</option></select></label><label class="s4-field">Đáp án Knock-out<input data-q-answer value="${escape(question.correctAnswer || '')}" placeholder="Chính xác như lựa chọn"></label><button type="button" class="s4-button danger" data-remove-question>Xóa</button></div>`;
  }
  function renderQuestions(items = []) { questions = items; $('#screening-questions').innerHTML = items.length ? items.map(questionRow).join('') : '<p class="s4-muted">Vị trí này chưa có câu hỏi sàng lọc.</p>'; }
  function renderPipeline() {
    $('#pipeline-labels').innerHTML = stages.map((stage, index) => `<label class="s4-field">Giai đoạn ${index + 1}<input data-stage-key="${escape(stage.key)}" maxlength="32" value="${escape(stage.label)}"></label>`).join('');
  }
  function renderBoard() {
    const keys = [...stages.map(item => item.key), 'rejected', 'withdrawn'];
    $('#kanban').innerHTML = keys.map(key => {
      const cards = applications.filter(item => item.status === key);
      return `<section class="s4-lane" data-lane="${escape(key)}"><h3>${escape(stageLabel(key))}<span>${cards.length}</span></h3>${cards.map(item => `<article class="s4-app-card" draggable="true" data-app="${escape(item.id)}"><strong>${escape(item.student?.name || 'Ứng viên')}</strong><small>${escape(item.jobTitle)} · Phù hợp ${item.score}%</small><small>${escape((item.student?.skills || []).slice(0, 4).join(' · '))}</small></article>`).join('') || '<p class="s4-muted">Chưa có hồ sơ</p>'}</section>`;
    }).join('');
  }
  async function loadJobs() {
    const result = await api('/api/sprint4/employer/jobs'); jobs = result.jobs; stages = result.stages;
    const select = $('#job-filter'); const selected = new URLSearchParams(location.search).get('job') || select.value;
    select.innerHTML = `<option value="">Tất cả vị trí</option>${jobs.map(job => `<option value="${escape(job.id)}">${escape(job.title)} (${job.applicationCount})</option>`).join('')}`;
    if (selected && jobs.some(job => job.id === selected)) select.value = selected;
    $('#stage-filter').innerHTML = `<option value="">Tất cả trạng thái</option>${[...stages, { key: 'rejected', label: 'Từ chối' }, { key: 'withdrawn', label: 'Đã rút' }].map(stage => `<option value="${escape(stage.key)}">${escape(stage.label)}</option>`).join('')}`;
    renderPipeline(); await loadApplications(); await loadScreening();
  }
  async function loadApplications() {
    const params = new URLSearchParams();
    if ($('#job-filter').value) params.set('jobId', $('#job-filter').value);
    if ($('#stage-filter').value) params.set('stage', $('#stage-filter').value);
    if ($('#candidate-query').value.trim()) params.set('q', $('#candidate-query').value.trim());
    if ($('#min-score').value) params.set('minScore', $('#min-score').value);
    if ($('#skill-filter').value.trim()) params.set('skill', $('#skill-filter').value.trim());
    if ($('#school-filter').value.trim()) params.set('school', $('#school-filter').value.trim());
    if ($('#min-gpa').value) params.set('minGpa', $('#min-gpa').value);
    if ($('#date-after').value) params.set('after', new Date(`${$('#date-after').value}T00:00:00`).toISOString());
    if ($('#date-before').value) params.set('before', new Date(`${$('#date-before').value}T23:59:59.999`).toISOString());
    const result = await api(`/api/sprint4/employer/applications?${params}`); applications = result.applications; renderBoard();
  }
  async function loadScreening() {
    const jobId = $('#job-filter').value;
    if (!jobId) { renderQuestions([]); return; }
    const result = await api(`/api/sprint4/employer/jobs/${encodeURIComponent(jobId)}/screening`); renderQuestions(result.configured || []);
  }
  function nextStageOptions(status) { const position = stages.findIndex(item => item.key === status); return stages.slice(position + 1); }
  async function openApplication(id) {
    try {
      const result = await api(`/api/sprint4/employer/applications/${encodeURIComponent(id)}`); activeApplication = result.application; stages = result.stages || stages;
      const app = activeApplication; const student = app.student || {}; const answers = app.screeningAnswers.map(item => `<div class="s4-row"><span><b>${escape(item.prompt)}</b><br>${escape(item.value || '—')}</span></div>`).join('');
      const log = app.stageLog.map(item => `<li>${escape(stageLabel(item.to))} · ${new Date(item.at).toLocaleString('vi-VN')}${item.note ? ` · ${escape(item.note)}` : ''}</li>`).join('');
      const moves = nextStageOptions(app.status);
      $('#application-detail').innerHTML = `<div class="s4-card-head"><div><p class="s4-eyebrow">${escape(app.jobTitle)}</p><h2>${escape(student.name || 'Ứng viên')}</h2><p>${escape(student.email || '')}</p></div><span class="s4-tag">${app.score}%</span></div><p class="s4-muted">${escape(student.school || '')}${student.major ? ` · ${escape(student.major)}` : ''}${student.gradYear ? ` · Tốt nghiệp ${student.gradYear}` : ''}</p><p><b>Kỹ năng:</b> ${escape((student.skills || []).join(', ') || 'Chưa khai báo')}</p><p><b>Kỹ năng khớp:</b> ${escape((app.matchedSkills || []).join(', ') || '—')}</p><p><b>Còn thiếu:</b> ${escape((app.missingSkills || []).join(', ') || '—')}</p><h3>Thư ứng tuyển</h3><p>${escape(app.coverLetter || 'Ứng viên không gửi thư ứng tuyển.')}</p>${app.cv ? `<h3>CV đã chọn</h3><p><a href="${escape(app.cv.href)}" target="_blank" rel="noopener noreferrer">Mở ${escape(app.cv.originalName)}</a></p>${app.cv.mimeType === 'application/pdf' ? `<iframe title="CV của ${escape(student.name)}" src="${escape(app.cv.href)}"></iframe>` : ''}` : '<p class="s4-muted">Ứng viên chưa chọn CV khả dụng.</p>'}<h3>Câu trả lời sàng lọc</h3>${answers || '<p class="s4-muted">Tin không có câu hỏi sàng lọc.</p>'}<h3>Lịch sử thao tác</h3><ul>${log}</ul>${!['rejected', 'withdrawn', 'hired'].includes(app.status) ? `<label class="s4-field">Chuyển giai đoạn<select id="move-stage"><option value="">Chọn giai đoạn…</option>${moves.map(item => `<option value="${escape(item.key)}">${escape(item.label)}</option>`).join('')}</select></label><div class="s4-card-actions"><button id="apply-stage" class="s4-button">Cập nhật</button></div><label class="s4-field">Lý do từ chối<select id="reject-reason"><option value="skills">Thiếu kỹ năng</option><option value="experience">Kinh nghiệm chưa phù hợp</option><option value="education">Học vấn/chuyên ngành</option><option value="screening">Câu hỏi sàng lọc</option><option value="position_filled">Đã tuyển đủ</option><option value="other">Lý do khác</option></select></label><label class="s4-field">Ghi chú cho ứng viên<textarea id="reject-note" rows="3" maxlength="500" placeholder="Bắt buộc nếu chọn lý do khác"></textarea></label><button id="reject-app" class="s4-button danger">Từ chối hồ sơ</button>` : ''}`;
      applications = applications.map(item => item.id === app.id ? { ...item, status: app.status, version: app.version } : item); renderBoard();
    } catch (error) { notice(error.message, true); }
  }
  async function moveApplication(status, rejection = {}) {
    if (!activeApplication) return;
    try { await api(`/api/sprint4/employer/applications/${encodeURIComponent(activeApplication.id)}/stage`, { method: 'PATCH', body: JSON.stringify({ status, expectedVersion: activeApplication.version, ...rejection }) }); notice('Đã cập nhật giai đoạn và ghi lịch sử.'); await loadApplications(); await openApplication(activeApplication.id); }
    catch (error) { notice(error.message, true); if (/đã được cập nhật/i.test(error.message)) { await loadApplications(); await openApplication(activeApplication.id); } }
  }
  $('#kanban').addEventListener('click', event => { const card = event.target.closest('[data-app]'); if (card) openApplication(card.dataset.app); });
  $('#kanban').addEventListener('dragstart', event => { const card = event.target.closest('[data-app]'); if (card) event.dataTransfer.setData('text/plain', card.dataset.app); });
  $('#kanban').addEventListener('dragover', event => { if (event.target.closest('[data-lane]')) event.preventDefault(); });
  $('#kanban').addEventListener('drop', async event => { const lane = event.target.closest('[data-lane]'); if (!lane) return; event.preventDefault(); const app = applications.find(item => item.id === event.dataTransfer.getData('text/plain')); if (!app) return; const to = lane.dataset.lane; await openApplication(app.id); if (to === 'rejected') return notice('Chọn lý do từ chối trong bảng chi tiết rồi xác nhận.'); moveApplication(to); });
  $('#application-detail').addEventListener('click', event => {
    if (event.target.id === 'apply-stage') { const value = $('#move-stage').value; if (!value) return notice('Chọn giai đoạn cần chuyển.', true); moveApplication(value); }
    if (event.target.id === 'reject-app' && activeApplication) { moveApplication('rejected', { reason: $('#reject-reason').value, note: $('#reject-note').value }); }
  });
  $('#job-filter').addEventListener('change', () => { const url = new URL(location.href); if ($('#job-filter').value) url.searchParams.set('job', $('#job-filter').value); else url.searchParams.delete('job'); history.replaceState({}, '', url); Promise.all([loadApplications(), loadScreening()]).catch(error => notice(error.message, true)); });
  $('#stage-filter').addEventListener('change', () => loadApplications().catch(error => notice(error.message, true)));
  let queryTimer; for (const control of document.querySelectorAll('#candidate-query,#min-score,#skill-filter,#school-filter,#min-gpa,#date-after,#date-before')) control.addEventListener(control.type === 'search' ? 'input' : 'change', () => { clearTimeout(queryTimer); queryTimer = setTimeout(() => loadApplications().catch(error => notice(error.message, true)), 250); });
  $('#refresh-ats').addEventListener('click', () => loadJobs().catch(error => notice(error.message, true)));
  $('#add-question').addEventListener('click', () => { if (document.querySelectorAll('[data-question-row]').length >= 10) return notice('Tối đa 10 câu hỏi mỗi tin.', true); if (!$('#job-filter').value) return notice('Chọn một tin tuyển dụng trước.', true); if (document.querySelectorAll('[data-question-row]').length === 0) $('#screening-questions').innerHTML = ''; $('#screening-questions').insertAdjacentHTML('beforeend', questionRow()); });
  $('#screening-questions').addEventListener('click', event => { if (event.target.closest('[data-remove-question]')) event.target.closest('[data-question-row]').remove(); });
  $('#screening-questions').addEventListener('change', event => { if (event.target.matches('[data-q-type]')) { const row = event.target.closest('[data-question-row]'); if (event.target.value === 'boolean') row.querySelector('[data-q-options]').value = 'Có | Không'; if (event.target.value === 'text') row.querySelector('[data-q-options]').value = ''; } });
  $('#save-questions').addEventListener('click', async () => {
    const jobId = $('#job-filter').value; if (!jobId) return notice('Chọn một tin tuyển dụng trước.', true);
    const items = [...document.querySelectorAll('[data-question-row]')].map(row => { const type = row.querySelector('[data-q-type]').value; const mode = row.querySelector('[data-q-mode]').value; return { id: row.dataset.id || '', prompt: row.querySelector('[data-q-prompt]').value, type, options: row.querySelector('[data-q-options]').value.split('|').map(value => value.trim()).filter(Boolean), required: mode !== 'optional', knockout: mode === 'knockout', correctAnswer: row.querySelector('[data-q-answer]').value }; });
    try { const result = await api(`/api/sprint4/employer/jobs/${encodeURIComponent(jobId)}/screening`, { method: 'PUT', body: JSON.stringify({ questions: items }) }); renderQuestions(result.questions); notice('Đã lưu câu hỏi sàng lọc.'); }
    catch (error) { notice(error.message, true); }
  });
  $('#save-pipeline').addEventListener('click', async () => {
    const values = [...document.querySelectorAll('[data-stage-key]')].map(input => ({ key: input.dataset.stageKey, label: input.value.trim() }));
    try { const result = await api('/api/sprint4/employer/pipeline', { method: 'PUT', body: JSON.stringify({ stages: values }) }); stages = result.stages; renderPipeline(); renderBoard(); notice('Đã lưu tên pipeline cho doanh nghiệp.'); }
    catch (error) { notice(error.message, true); }
  });
  loadJobs().catch(error => notice(error.message, true));
})();
