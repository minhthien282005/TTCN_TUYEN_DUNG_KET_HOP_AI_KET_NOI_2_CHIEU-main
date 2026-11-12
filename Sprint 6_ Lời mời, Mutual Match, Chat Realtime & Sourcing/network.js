(() => {
  const $ = selector => document.querySelector(selector);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const api = async (path, options = {}) => {
    const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...options, headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(data.error || 'Không thực hiện được thao tác.'); error.status = response.status; throw error; }
    return data;
  };
  let role = ''; let tab = 'inbox'; let activeConversation = ''; let lastMessageAt = 0; let eventSource; let loading = false;
  const notice = (message, error = false) => { const box = $('#s6-notice'); box.textContent = message; box.classList.toggle('is-error', error); };
  const empty = (title, message) => `<div class="s6-empty"><span>✦</span><h3>${escape(title)}</h3><p>${escape(message)}</p></div>`;
  const actionButton = (label, action, id, extra = '') => `<button class="s6-button ${extra}" data-action="${action}" data-id="${escape(id)}">${label}</button>`;
  const loadInbox = async () => {
    const data = await api('/api/sprint6/invitations');
    const invitations = data.invitations || []; const interests = data.interests || [];
    const pendingInvites = invitations.filter(item => item.status === 'pending');
    const pendingInterests = interests.filter(item => item.status === 'pending');
    const inviteCards = invitations.map(item => `<article class="s6-card"><div class="s6-card-top"><span class="s6-chip ${item.status === 'pending' ? 'is-pending' : ''}">${item.status === 'pending' ? 'Đang chờ' : item.status === 'accepted' ? 'Đã kết nối' : item.status === 'declined' ? 'Đã từ chối' : escape(item.status)}</span><time>${new Date(item.createdAt).toLocaleDateString('vi-VN')}</time></div><h3>${escape(role === 'student' ? item.company?.name || 'Nhà tuyển dụng' : item.candidate?.name || 'Ứng viên')}</h3><p class="s6-card-sub">${escape(item.jobTitle)}${item.candidate?.major ? ` · ${escape(item.candidate.major)}` : ''}</p>${item.message ? `<p class="s6-message-preview">“${escape(item.message)}”</p>` : ''}${role === 'student' && item.status === 'pending' ? `<div class="s6-card-actions">${actionButton('Đồng ý kết nối', 'invitation-accept', item.id)}${actionButton('Từ chối', 'invitation-decline', item.id, 's6-button-quiet')}</div>` : ''}</article>`).join('');
    const interestCards = interests.map(item => `<article class="s6-card"><div class="s6-card-top"><span class="s6-chip ${item.status === 'pending' ? 'is-pending' : ''}">${item.status === 'pending' ? 'Đang chờ' : item.status === 'accepted' ? 'Đã kết nối' : 'Đã từ chối'}</span><time>${new Date(item.createdAt).toLocaleDateString('vi-VN')}</time></div><h3>${escape(role === 'student' ? item.company?.name || 'Nhà tuyển dụng' : item.candidate?.name || 'Ứng viên')}</h3><p class="s6-card-sub">Quan tâm vị trí ${escape(item.jobTitle)}${item.candidate?.major ? ` · ${escape(item.candidate.major)}` : ''}</p>${item.message ? `<p class="s6-message-preview">“${escape(item.message)}”</p>` : ''}${role === 'employer' && item.status === 'pending' ? `<div class="s6-card-actions">${actionButton('Đồng ý kết nối', 'interest-accept', item.id)}${actionButton('Từ chối', 'interest-decline', item.id, 's6-button-quiet')}</div>` : ''}</article>`).join('');
    $('#s6-content').innerHTML = `<section class="s6-section"><div class="s6-section-title"><div><span class="s6-kicker">${role === 'student' ? 'TỪ DOANH NGHIỆP' : 'BẠN ĐÃ GỬI'}</span><h2>${role === 'student' ? 'Lời mời nhận được' : 'Lời mời ứng viên'}</h2></div><span class="s6-count">${pendingInvites.length} đang chờ</span></div><div class="s6-card-list">${inviteCards || empty('Chưa có lời mời', role === 'student' ? 'Lời mời từ nhà tuyển dụng đã xác minh sẽ xuất hiện ở đây.' : 'Gửi lời mời từ mục Tìm ứng viên.')}</div></section><section class="s6-section"><div class="s6-section-title"><div><span class="s6-kicker">${role === 'student' ? 'BẠN CHỦ ĐỘNG QUAN TÂM' : 'ỨNG VIÊN QUAN TÂM'}</span><h2>Quan tâm công việc</h2></div><span class="s6-count">${pendingInterests.length} đang chờ</span></div><div class="s6-card-list">${interestCards || empty('Chưa có yêu cầu quan tâm', role === 'student' ? 'Bạn có thể chủ động gửi quan tâm từ mục Công việc để quan tâm.' : 'Khi ứng viên quan tâm đến công việc, yêu cầu sẽ xuất hiện ở đây.')}</div></section>`;
  };
  const loadMatches = async () => {
    const data = await api('/api/sprint6/matches');
    const cards = (data.matches || []).map(item => `<article class="s6-card s6-match-card"><div class="s6-match-mark">↗</div><div class="s6-match-info"><span class="s6-kicker">MUTUAL MATCH</span><h3>${escape(role === 'student' ? item.company?.name || 'Nhà tuyển dụng' : item.candidate?.name || 'Ứng viên')}</h3><p>${escape(item.jobTitle)}${item.candidate?.location ? ` · ${escape(item.candidate.location)}` : ''}</p>${item.candidate?.skills?.length ? `<div class="s6-skills">${item.candidate.skills.slice(0, 5).map(skill => `<span>${escape(skill)}</span>`).join('')}</div>` : ''}</div>${actionButton('Nhắn tin', 'open-match', item.conversationId, 's6-button-primary')}</article>`).join('');
    $('#s6-content').innerHTML = `<section class="s6-section"><div class="s6-section-title"><div><span class="s6-kicker">ĐỒNG Ý TỪ CẢ HAI PHÍA</span><h2>Kết nối hai chiều</h2></div><span class="s6-count">${(data.matches || []).length} kết nối</span></div><div class="s6-card-list">${cards || empty('Kết nối sẽ hiện ở đây', 'Khi ứng viên chấp nhận lời mời hoặc nhà tuyển dụng chấp nhận sự quan tâm, hai bên có thể bắt đầu trò chuyện.')}</div></section>`;
  };
  const loadJobs = async () => {
    const data = await api('/api/sprint6/jobs');
    const cards = (data.jobs || []).map(job => `<article class="s6-card"><div class="s6-card-top"><span class="s6-chip">Đang tuyển</span><span>Việc làm đã xác minh</span></div><h3>${escape(job.title)}</h3><p class="s6-card-sub">${escape(job.company)} · ${escape(job.location || 'Địa điểm linh hoạt')}</p>${job.alreadyInterested ? '<span class="s6-inline-status">Đã gửi quan tâm</span>' : actionButton('Tôi quan tâm', 'job-interest', job.id, 's6-button-primary')}</article>`).join('');
    $('#s6-content').innerHTML = `<section class="s6-section"><div class="s6-section-title"><div><span class="s6-kicker">CHỦ ĐỘNG KẾT NỐI</span><h2>Công việc phù hợp để mở lời</h2></div></div><div class="s6-card-list">${cards || empty('Chưa có công việc phù hợp', 'Hãy quay lại sau để xem các tin tuyển dụng đang mở.')}</div></section>`;
  };
  const loadSourcing = async (query = '') => {
    const params = new URLSearchParams(query);
    const data = await api(`/api/sprint6/sourcing?${params}`);
    const options = (data.jobs || []).map(job => `<option value="${escape(job.id)}">${escape(job.title)}</option>`).join('');
    const cards = (data.candidates || []).map(candidate => `<article class="s6-card s6-candidate"><div class="s6-avatar">${escape(candidate.name.slice(0, 1).toUpperCase())}</div><div class="s6-candidate-main"><div class="s6-card-top"><span class="s6-chip">Hồ sơ công khai</span></div><h3>${escape(candidate.name)}</h3><p class="s6-card-sub">${escape([candidate.major, candidate.school, candidate.location].filter(Boolean).join(' · ') || candidate.desiredRoles.join(', ') || 'Ứng viên đang tìm cơ hội')}</p><div class="s6-skills">${candidate.skills.slice(0, 8).map(skill => `<span>${escape(skill)}</span>`).join('') || '<span>Chưa thêm kỹ năng</span>'}</div>${candidate.bio ? `<p class="s6-candidate-bio">${escape(candidate.bio)}</p>` : ''}<div class="s6-invite-row"><select aria-label="Chọn vị trí tuyển dụng" data-job-select="${escape(candidate.id)}" ${options ? '' : 'disabled'}>${options || '<option value="">Chưa có tin đang tuyển</option>'}</select><input data-message-input="${escape(candidate.id)}" maxlength="500" placeholder="Lời nhắn ngắn (không bắt buộc)" aria-label="Lời nhắn"><button class="s6-button s6-button-primary" data-action="send-invitation" data-id="${escape(candidate.id)}" ${options && !candidate.invitationSent ? '' : 'disabled'}>${candidate.invitationSent ? 'Đã gửi lời mời' : 'Mời trao đổi'}</button></div></div></article>`).join('');
    $('#s6-content').innerHTML = `<section class="s6-section"><div class="s6-section-title"><div><span class="s6-kicker">SOURCING CÓ TRÁCH NHIỆM</span><h2>Tìm hồ sơ sinh viên công khai</h2><p>Chỉ hiển thị thông tin nghề nghiệp được phép công khai; không hiển thị email, số điện thoại hay tệp CV.</p></div></div><form id="s6-search-form" class="s6-search"><input name="q" placeholder="Tên, chuyên ngành, kỹ năng…" aria-label="Tìm ứng viên"><input name="skill" placeholder="Kỹ năng" aria-label="Lọc theo kỹ năng"><input name="location" placeholder="Địa điểm" aria-label="Lọc theo địa điểm"><button class="s6-button s6-button-primary">Tìm ứng viên</button></form><div class="s6-card-list">${cards || empty('Chưa tìm thấy hồ sơ', 'Thử bỏ bớt bộ lọc hoặc quay lại khi có thêm hồ sơ bật chế độ công khai.')}</div></section>`;
    $('#s6-search-form').addEventListener('submit', event => { event.preventDefault(); loadSourcing(new URLSearchParams(new FormData(event.currentTarget)).toString()).catch(showError); });
  };
  const loadConversations = async () => {
    const data = await api('/api/sprint6/conversations');
    const list = $('#s6-conversations');
    list.innerHTML = (data.conversations || []).map(item => `<button class="s6-conversation ${item.id === activeConversation ? 'is-active' : ''}" data-conversation="${escape(item.id)}"><span class="s6-conversation-avatar">${escape(item.otherName.slice(0, 1).toUpperCase())}</span><span class="s6-conversation-text"><strong>${escape(item.otherName)}</strong><small>${escape(item.jobTitle)}</small><span>${escape(item.lastMessage || 'Bắt đầu cuộc trò chuyện')}</span></span>${item.unread ? `<i>${item.unread}</i>` : ''}</button>`).join('') || `<div class="s6-conversation-empty">${escape(role === 'student' ? 'Chưa có cuộc trò chuyện. Đồng ý một lời mời để kết nối.' : 'Chưa có cuộc trò chuyện. Ứng viên cần đồng ý kết nối trước.')}</div>`;
    if (!activeConversation && data.conversations?.length) openConversation(data.conversations[0].id, data.conversations[0].otherName, data.conversations[0].jobTitle);
  };
  const loadMessages = async (append = false) => {
    if (!activeConversation) return;
    const data = await api(`/api/sprint6/conversations/${encodeURIComponent(activeConversation)}?after=${append ? lastMessageAt : 0}`);
    const box = $('#s6-messages');
    if (!append) box.innerHTML = '';
    const messages = data.messages || [];
    for (const message of messages) {
      const duplicate = box.querySelector(`[data-message="${CSS.escape(message.id)}"]`); if (duplicate) continue;
      const node = document.createElement('article'); node.className = `s6-bubble ${message.senderId === window.s6UserId ? 'is-mine' : ''}`; node.dataset.message = message.id;
      node.innerHTML = `<span>${escape(message.senderName)}</span><p>${escape(message.body)}</p><time>${new Date(message.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</time>`; box.append(node);
      lastMessageAt = Math.max(lastMessageAt, Date.parse(message.createdAt));
    }
    if (!messages.length && !append && !box.children.length) box.innerHTML = '<p class="s6-chat-empty">Chưa có tin nhắn. Hãy bắt đầu bằng một lời chào.</p>';
    box.scrollTop = box.scrollHeight;
  };
  const openConversation = async (id, name = '', job = '') => {
    if (!id) return;
    activeConversation = id; lastMessageAt = 0;
    $('#s6-thread-head').textContent = [name, job].filter(Boolean).join(' · ') || 'Cuộc trò chuyện';
    $('#s6-message-form input').disabled = false; $('#s6-message-form button').disabled = false;
    await loadConversations(); await loadMessages(false);
  };
  const showError = error => { notice(error.message || 'Đã có lỗi xảy ra.', true); if (error.status === 401) $('#s6-content').innerHTML = empty('Đăng nhập để tiếp tục', 'Khu vực kết nối dành cho tài khoản sinh viên và nhà tuyển dụng.'); };
  const setTab = async next => {
    tab = next; document.querySelectorAll('.s6-tabs [data-tab]').forEach(button => button.classList.toggle('is-active', button.dataset.tab === next));
    try { if (next === 'inbox') await loadInbox(); else if (next === 'matches') await loadMatches(); else if (next === 'jobs') await loadJobs(); else await loadSourcing(); }
    catch (error) { showError(error); }
  };
  document.addEventListener('click', async event => {
    const tabButton = event.target.closest('[data-tab]');
    if (tabButton) return setTab(tabButton.dataset.tab);
    const conversation = event.target.closest('[data-conversation]');
    if (conversation) { try { await openConversation(conversation.dataset.conversation, conversation.querySelector('strong')?.textContent, conversation.querySelector('small')?.textContent); } catch (error) { showError(error); } return; }
    const button = event.target.closest('[data-action]'); if (!button) return;
    const { action, id } = button.dataset; button.disabled = true;
    try {
      if (action === 'invitation-accept' || action === 'invitation-decline') await api(`/api/sprint6/invitations/${encodeURIComponent(id)}/respond`, { method: 'POST', body: JSON.stringify({ action: action.endsWith('accept') ? 'accept' : 'decline' }) });
      else if (action === 'interest-accept' || action === 'interest-decline') await api(`/api/sprint6/interests/${encodeURIComponent(id)}/respond`, { method: 'POST', body: JSON.stringify({ action: action.endsWith('accept') ? 'accept' : 'decline' }) });
      else if (action === 'job-interest') { const message = window.prompt('Lời nhắn gửi nhà tuyển dụng (không bắt buộc):', '') || ''; await api('/api/sprint6/interests', { method: 'POST', body: JSON.stringify({ jobId: id, message }) }); }
      else if (action === 'send-invitation') { const jobId = $(`[data-job-select="${CSS.escape(id)}"]`)?.value; const message = $(`[data-message-input="${CSS.escape(id)}"]`)?.value || ''; if (!jobId) throw new Error('Chọn một vị trí tuyển dụng trước.'); await api('/api/sprint6/invitations', { method: 'POST', body: JSON.stringify({ studentId: id, jobId, message }) }); }
      else if (action === 'open-match') { await loadConversations(); if (id) await openConversation(id); }
      notice('Đã cập nhật kết nối.'); await setTab(tab); await loadConversations();
    } catch (error) { showError(error); button.disabled = false; }
  });
  $('#s6-message-form').addEventListener('submit', async event => {
    event.preventDefault(); const input = event.currentTarget.elements.message; const message = input.value.trim(); if (!message || !activeConversation) return;
    const submit = event.currentTarget.querySelector('button'); submit.disabled = true;
    try { await api(`/api/sprint6/conversations/${encodeURIComponent(activeConversation)}/messages`, { method: 'POST', body: JSON.stringify({ message }) }); input.value = ''; await loadMessages(true); await loadConversations(); }
    catch (error) { showError(error); } finally { submit.disabled = false; input.focus(); }
  });
  async function start() {
    try {
      const me = await api('/api/me'); if (!me.user) { notice('Đăng nhập để dùng khu vực kết nối.', true); $('#s6-content').innerHTML = `${empty('Kết nối nghề nghiệp của bạn', 'Đăng nhập bằng tài khoản sinh viên hoặc nhà tuyển dụng để tiếp tục.')}<a class="s6-button s6-button-primary" href="/?open=login&amp;next=%2Fnetwork.html">Đăng nhập</a>`; return; }
      role = me.user.role; window.s6UserId = me.user.id;
      if (!['student', 'employer'].includes(role)) { notice('Chức năng Sprint 6 dành cho sinh viên và nhà tuyển dụng.', true); return; }
      $('#s6-sourcing-tab').hidden = role !== 'employer'; $('#s6-jobs-tab').hidden = role !== 'student';
      notice('Kết nối an toàn đang hoạt động.');
      await Promise.all([setTab('inbox'), loadConversations()]);
      const wanted = new URLSearchParams(location.search).get('conversation'); if (wanted) await openConversation(wanted);
      eventSource = new EventSource('/api/sprint6/events');
      eventSource.addEventListener('ready', () => { $('#s6-live').textContent = 'Trực tiếp'; $('#s6-live').classList.add('is-connected'); });
      eventSource.addEventListener('message', event => { const data = JSON.parse(event.data); loadConversations(); if (data.conversationId === activeConversation) loadMessages(true); });
      eventSource.onerror = () => { $('#s6-live').textContent = 'Đang thử kết nối lại'; $('#s6-live').classList.remove('is-connected'); };
      window.setInterval(() => { loadConversations().catch(() => {}); if (!eventSource || eventSource.readyState !== EventSource.OPEN) loadMessages(true).catch(() => {}); }, 12_000);
    } catch (error) { showError(error); }
  }
  window.addEventListener('pagehide', () => eventSource?.close());
  start();
})();
