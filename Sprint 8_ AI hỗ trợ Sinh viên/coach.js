(() => {
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const api = async (url, options = {}) => { const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) } }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || `Yêu cầu lỗi (${response.status}).`); return data; };
  let currentSession = null;
  const notice = (message, error = false) => { $('#s8-notice').textContent = message; $('#s8-notice').classList.toggle('error', error); };
  function showRoadmap(roadmap) {
    if (!roadmap) { $('#roadmap-result').innerHTML = '<p class="s8-empty">Tạo lộ trình để xem kế hoạch phù hợp với hồ sơ của bạn.</p>'; return; }
    $('#roadmap-result').innerHTML = `<div class="s8-roadmap-intro"><strong>Mục tiêu: ${esc(roadmap.target)}</strong><br>Kỹ năng hiện có: ${esc(roadmap.currentSkills.join(', ') || 'Chưa khai báo')}. Khoảng trống ưu tiên: ${esc(roadmap.skillGaps.join(', ') || 'chưa xác định từ tin tuyển dụng')}.<br><small>Lộ trình tham khảo; chọn nguồn học phù hợp và chỉ cập nhật CV bằng kinh nghiệm thật.</small></div>${roadmap.phases.map(phase => `<article class="s8-phase"><h3><small>${esc(phase.week)}</small>${esc(phase.title)}</h3><ul>${phase.tasks.map(task => `<li>${esc(task)}</li>`).join('')}</ul></article>`).join('')}`;
  }
  function questionView(session, latestFeedback = '') {
    currentSession = session;
    const host = $('#practice-session');
    if (session.status !== 'in_progress') { host.innerHTML = `${latestFeedback}<div class="s8-session"><h3>Buổi luyện tập hoàn tất</h3><p>Điểm cấu trúc trung bình: <strong>${session.score ?? 0}/100</strong> · ${session.answers.length} câu trả lời.</p><p>Điểm chỉ phản ánh cấu trúc STAR theo tiêu chí cơ bản, không dự đoán kết quả tuyển dụng.</p></div>`; return; }
    const index = session.answers.length; const question = session.questions[index];
    host.innerHTML = `${latestFeedback}<section class="s8-session"><div class="s8-progress">CÂU ${index + 1} / ${session.questions.length} · ${esc(question.category)}</div><h3>${esc(question.prompt)}</h3><form id="answer-form"><textarea id="answer-text" maxlength="3000" minlength="12" required placeholder="Mô tả tình huống, nhiệm vụ, hành động của bạn và kết quả. Chỉ chia sẻ thông tin bạn thấy phù hợp."></textarea><div class="s8-actions"><button class="s8-button" type="submit">Gửi câu trả lời <span>→</span></button></div></form></section>`;
  }
  async function loadSession(id) { const data = await api(`/api/sprint8/interviews/${encodeURIComponent(id)}`); questionView(data.session); }
  function renderHistory(items) {
    $('#practice-history').innerHTML = items.length ? items.map(item => `<div class="s8-history-item"><div><strong>${esc(item.target)}</strong><br><small>${new Date(item.updatedAt).toLocaleString('vi-VN')} · ${item.status === 'completed' ? `Điểm ${item.score}/100` : 'Đang luyện tập'}</small></div><button type="button" data-session="${esc(item.id)}">${item.status === 'completed' ? 'Xem lại' : 'Tiếp tục'}</button></div>`).join('') : '<p class="s8-empty">Bạn chưa có buổi luyện tập nào.</p>';
  }
  async function init() {
    const me = await api('/api/me'); if (!me.user) { notice('Đăng nhập tài khoản sinh viên để dùng AI Coach.'); return; }
    if (me.user.role !== 'student') { notice('Trợ lý Sprint 8 dành cho tài khoản sinh viên.', true); return; }
    const data = await api('/api/sprint8/coach');
    for (const select of [$('#roadmap-job'), $('#practice-job')]) for (const job of data.jobs) { const option = document.createElement('option'); option.value = job.id; option.textContent = `${job.title}${job.company ? ` · ${job.company}` : ''}`; select.append(option); }
    showRoadmap(data.roadmap); renderHistory(data.sessions); notice('Lộ trình và nhận xét được xây dựng dựa trên hồ sơ cùng tin tuyển dụng hiện có.');
  }
  document.querySelectorAll('[data-tab]').forEach(tab => tab.addEventListener('click', () => {
    document.querySelectorAll('[data-tab]').forEach(item => item.classList.toggle('active', item === tab));
    $('#roadmap-panel').hidden = tab.dataset.tab !== 'roadmap'; $('#practice-panel').hidden = tab.dataset.tab !== 'practice';
  }));
  $('#roadmap-form').addEventListener('submit', async event => {
    event.preventDefault(); const button = event.currentTarget.querySelector('button'); button.disabled = true;
    try { const data = await api('/api/sprint8/roadmap', { method: 'POST', body: JSON.stringify({ jobId: $('#roadmap-job').value || null }) }); showRoadmap(data.roadmap); notice('Đã tạo lộ trình cá nhân hóa.'); }
    catch (error) { notice(error.message, true); } finally { button.disabled = false; }
  });
  $('#practice-form').addEventListener('submit', async event => {
    event.preventDefault(); const button = event.currentTarget.querySelector('button'); button.disabled = true;
    try { const data = await api('/api/sprint8/interviews', { method: 'POST', body: JSON.stringify({ jobId: $('#practice-job').value || null }) }); questionView(data.session); notice('Buổi luyện tập đã bắt đầu.'); await refreshHistory(); }
    catch (error) { notice(error.message, true); } finally { button.disabled = false; }
  });
  $('#practice-session').addEventListener('submit', async event => {
    if (event.target.id !== 'answer-form' || !currentSession) return; event.preventDefault(); const button = event.target.querySelector('button'); button.disabled = true;
    try {
      const data = await api(`/api/sprint8/interviews/${encodeURIComponent(currentSession.id)}/answer`, { method: 'POST', body: JSON.stringify({ questionIndex: currentSession.answers.length, answer: $('#answer-text').value }) });
      currentSession.answers.push({ feedback: data.result }); currentSession.status = data.session.status; currentSession.score = data.session.score;
      const feedback = data.result.suggestion ? `<p>${esc(data.result.suggestion)}</p><small>Đã dùng mô hình AI theo lựa chọn đồng ý AI bên ngoài của bạn.</small>` : `<strong>Điểm cấu trúc: ${data.result.rating}/5</strong><ul>${data.result.suggestions.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`;
      const feedbackHtml = `<div class="s8-feedback">${feedback}</div>`;
      if (data.session.status === 'completed') { currentSession.answers = Array.from({ length: data.session.total }); currentSession.status = 'completed'; questionView(currentSession, feedbackHtml); await refreshHistory(); }
      else { const response = await api(`/api/sprint8/interviews/${encodeURIComponent(currentSession.id)}`); questionView(response.session, feedbackHtml); }
      notice('Đã nhận góp ý cho câu trả lời.');
    } catch (error) { notice(error.message, true); button.disabled = false; }
  });
  async function refreshHistory() { const data = await api('/api/sprint8/coach'); renderHistory(data.sessions); }
  $('#practice-history').addEventListener('click', async event => { const button = event.target.closest('[data-session]'); if (!button) return; try { await loadSession(button.dataset.session); $('#practice-panel').hidden = false; $('#roadmap-panel').hidden = true; document.querySelectorAll('[data-tab]').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === 'practice')); } catch (error) { notice(error.message, true); } });
  init().catch(error => notice(error.message, true));
})();
