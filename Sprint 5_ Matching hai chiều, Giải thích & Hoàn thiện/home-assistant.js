(() => {
  const panel = document.querySelector('#s5-chat-panel');
  const messages = document.querySelector('#s5-chat-messages');
  const form = document.querySelector('#s5-chat-form');
  const input = document.querySelector('#s5-chat-input');
  const launch = document.querySelector('#s5-chat-open');
  const consentRow = document.querySelector('#s5-ai-consent-row');
  const consentInput = document.querySelector('#s5-ai-consent');
  if (!panel || !messages || !form) return;
  let suggestionsLoaded = false;
  const addMessage = (value, kind) => { const item = document.createElement('div'); item.className = `s5-chat-bubble ${kind}`; item.textContent = value; messages.append(item); messages.scrollTop = messages.scrollHeight; return item; };
  const toggle = open => {
    panel.hidden = !open; launch.setAttribute('aria-expanded', String(open));
    if (open) {
      input.focus();
      if (!suggestionsLoaded) {
        suggestionsLoaded = true;
        fetch('/api/me', { credentials: 'same-origin' }).then(response => response.json()).then(data => {
          const role = data.user?.role; const items = role === 'employer' ? ['Gợi ý ứng viên phù hợp', 'Cải thiện tin tuyển dụng'] : role === 'student' ? ['Tìm việc phù hợp với tôi', 'Cách cải thiện CV?', 'Chuẩn bị phỏng vấn'] : ['Tìm việc phù hợp với tôi', 'Cách cải thiện CV?'];
          const choices = messages.querySelector('.s5-chat-suggestions'); if (!choices) return; choices.replaceChildren();
          for (const label of items) { const button = document.createElement('button'); button.type = 'button'; button.textContent = label; choices.append(button); }
        }).catch(() => {});
      }
    }
  };
  launch.addEventListener('click', () => toggle(panel.hidden));
  document.querySelector('#s5-chat-close').addEventListener('click', () => toggle(false));
  fetch('/api/sprint5/status', { credentials: 'same-origin' }).then(response => response.json()).then(status => {
    if (!consentRow || !consentInput) return;
    consentRow.hidden = false; consentInput.checked = Boolean(status.externalAiConsented);
    consentInput.disabled = !status.generativeAvailable;
    const description = consentRow.querySelector('span');
    if (description) description.textContent = status.generativeAvailable
      ? `Bật ${status.provider || 'AI ngoài'} (${status.model || 'mô hình đã cấu hình'}) để nhận câu trả lời tạo sinh và cá nhân hóa. Khi tắt, trợ lý dùng chế độ nội bộ.`
      : 'AI ngoài chưa được cấu hình trong server; hiện chỉ có câu trả lời nội bộ.';
    consentRow.title = status.externalAiConsented ? 'Đã đồng ý và đang gửi câu hỏi đến AI ngoài.' : 'Chưa đồng ý; bật ô này nếu muốn dùng AI tạo sinh.';
  }).catch(() => {
    if (consentRow) { consentRow.hidden = false; const description = consentRow.querySelector('span'); if (description) description.textContent = 'Không đọc được trạng thái AI. Hãy tải lại trang hoặc kiểm tra server.'; }
  });
  consentInput?.addEventListener('change', async () => {
    const me = await fetch('/api/me', { credentials: 'same-origin' }).then(response => response.json()).catch(() => ({ user: null }));
    if (!me.user) return; // Guest consent applies only to the next request and is not stored.
    consentInput.disabled = true;
    try {
      const response = await fetch('/api/sprint5/consent', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ granted: consentInput.checked }) });
      if (!response.ok) throw new Error('Không lưu được lựa chọn riêng tư.');
    } catch { consentInput.checked = !consentInput.checked; }
    finally { consentInput.disabled = false; }
  });
  messages.addEventListener('click', event => { const button = event.target.closest('.s5-chat-suggestions button'); if (!button) return; input.value = button.textContent.trim(); form.requestSubmit(); });
  form.addEventListener('submit', async event => {
    event.preventDefault(); const message = input.value.trim(); if (message.length < 2) return;
    const history = consentInput?.checked ? [...messages.querySelectorAll('.s5-chat-bubble.user, .s5-chat-bubble.assistant:not(.pending)')].slice(-8).map(item => ({ role: item.classList.contains('user') ? 'user' : 'assistant', content: item.textContent.trim().slice(0, 1000) })).filter(item => item.content) : [];
    addMessage(message, 'user'); input.value = ''; input.disabled = true; form.querySelector('button').disabled = true;
    const pending = addMessage('Đang xem thông tin phù hợp…', 'assistant pending');
    try {
      const response = await fetch('/api/sprint5/chat', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ message, history, externalConsent: Boolean(consentInput?.checked) }) });
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || 'Chưa gửi được câu hỏi.'); pending.textContent = data.reply || 'Mình chưa có gợi ý cho câu hỏi này.'; pending.classList.remove('pending');
      const reasons = { consent_required: 'Chưa bật đồng ý AI ngoài; đang dùng trả lời nội bộ.', provider_not_configured: 'Server chưa nạp khóa AI; đang dùng trả lời nội bộ.', provider_auth: 'Groq từ chối khóa; kiểm tra OPENAI_API_KEY trong .env rồi khởi động lại server.', provider_model_or_endpoint: 'Groq không nhận model hoặc endpoint; kiểm tra OPENAI_MODEL và OPENAI_API_URL trong .env.', provider_rate_limit: 'Groq đang giới hạn lượt gọi; thử lại sau.', provider_unavailable: 'Groq đang gặp sự cố; đang dùng trả lời nội bộ.', provider_timeout: 'Groq phản hồi quá chậm; đang dùng trả lời nội bộ.' };
      const modeText = data.mode === 'generative' ? `Đã dùng ${data.provider || 'AI ngoài'}.` : `Chế độ nội bộ · ${reasons[data.fallbackReason] || 'AI ngoài chưa trả lời được.'}`; addMessage(modeText, 'mode');
    } catch (error) { pending.textContent = error.message; pending.classList.add('error'); pending.classList.remove('pending'); }
    finally { input.disabled = false; form.querySelector('button').disabled = false; input.focus(); messages.scrollTop = messages.scrollHeight; }
  });
  window.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) toggle(false); });
})();
// Note: Sprint 5 update date 10/11/2026.
