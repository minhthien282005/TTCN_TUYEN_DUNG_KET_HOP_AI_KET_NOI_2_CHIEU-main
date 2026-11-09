(() => {
  const $ = selector => document.querySelector(selector);
  const sessionMessage = $('#session-message');
  const uploadForm = $('#cv-upload-form');
  const list = $('#cv-list');
  const statusLabels = { queued: 'Đang chờ xử lý', processing: 'Đang phân tích', retry_wait: 'Đang thử lại', review: 'Chờ bạn rà soát', confirmed: 'Đã xác nhận', failed: 'Không phân tích được' };
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const showMessage = (node, message, error = false) => { node.textContent = message; node.classList.toggle('error', error); };
  const api = async (url, options = {}) => {
    const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Yêu cầu thất bại (${response.status}).`);
    return body;
  };
  const formatSize = bytes => bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  let currentUser = null;
  let activeCvId = '';
  let polling = false;

  function lockPrivateCvUi() {
    uploadForm.querySelectorAll('input, button').forEach(control => { control.disabled = true; });
    $('#refresh-cvs').disabled = true;
    $('#sections-form').querySelectorAll('input, textarea, button').forEach(control => { control.disabled = true; });
    list.innerHTML = '<p class="s3-muted">Đăng nhập để xem danh sách CV của bạn.</p>';
    $('#embedding-status').textContent = 'Đăng nhập để xem trạng thái hồ sơ.';
  }

  async function ensureStudent() {
    const { user } = await api('/api/me');
    currentUser = user;
    if (!user) {
      sessionMessage.hidden = false;
      sessionMessage.innerHTML = 'Đăng nhập tài khoản sinh viên để quản lý CV và hồ sơ. <a href="/?open=login&amp;next=%2Fcv.html">Đăng nhập để tiếp tục ↗</a>';
      lockPrivateCvUi();
      return false;
    }
    if (user.role !== 'student') {
      sessionMessage.hidden = false;
      sessionMessage.textContent = 'Pipeline CV dành cho tài khoản sinh viên. Hãy đăng nhập bằng tài khoản sinh viên.';
      lockPrivateCvUi();
      return false;
    }
    return true;
  }

  function renderCvs(cvs) {
    if (!cvs.length) { list.innerHTML = '<p class="s3-muted">Bạn chưa tải CV lên. Thêm CV đầu tiên để bắt đầu.</p>'; return; }
    list.innerHTML = cvs.map(cv => {
      const state = statusLabels[cv.status] || cv.status;
      const canReview = ['review', 'confirmed'].includes(cv.status);
      const retryText = cv.status === 'failed' ? `<p class="s3-inline-message error">${escapeHtml(cv.error || 'Không thể trích xuất CV.')}</p>` : '';
      return `<article class="s3-cv-card"><div><div class="s3-cv-title">${escapeHtml(cv.originalName)} ${cv.isDefault ? '<span class="s3-status">CV mặc định</span>' : ''}</div><div class="s3-cv-meta"><span>${escapeHtml(cv.mimeType.split('/').pop().toUpperCase())}</span><span>${formatSize(cv.bytes)}</span><span>Đã quét virus</span><span>${new Date(cv.createdAt).toLocaleString('vi-VN')}</span><span class="s3-status ${cv.status}">${escapeHtml(state)}</span></div>${retryText}</div><div class="s3-cv-actions"><a href="/api/sprint3/cvs/${encodeURIComponent(cv.id)}/file">Tải xuống</a>${canReview ? `<button type="button" data-review="${escapeHtml(cv.id)}">${cv.status === 'confirmed' ? 'Xem kết quả' : 'Rà soát'}</button>` : ''}${!cv.isDefault ? `<button type="button" data-default="${escapeHtml(cv.id)}">Đặt mặc định</button>` : ''}<button type="button" data-delete="${escapeHtml(cv.id)}">Xóa CV</button></div></article>`;
    }).join('');
    if (cvs.some(cv => ['queued', 'processing', 'retry_wait'].includes(cv.status))) beginPolling();
  }

  async function loadCvs() {
    const { cvs } = await api('/api/sprint3/cvs');
    renderCvs(cvs);
    return cvs;
  }

  async function loadEmbeddingStatus() {
    const status = await api('/api/sprint3/embedding-status');
    const provider = status.semanticProvider === 'ollama-local' ? `embedding ngữ nghĩa nội bộ${status.profileSemanticReady ? ' đã sẵn sàng' : ` · ${status.pendingSemantic} tác vụ đang chờ`}` : 'vector từ khóa dự phòng';
    $('#embedding-status').textContent = `Hồ sơ ${status.profileReady ? 'đã' : 'chưa'} có vector · ${status.embeddedJobs}/${status.totalJobs} tin đã được vector hóa · ${status.dimensions} chiều · ${provider}${status.embeddingConfigError ? ` · ${status.embeddingConfigError}` : ''}.`;
  }

  async function beginPolling() {
    if (polling) return;
    polling = true;
    for (let attempt = 0; attempt < 60; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      try {
        const cvs = await loadCvs();
        if (!cvs.some(cv => ['queued', 'processing', 'retry_wait'].includes(cv.status))) break;
      } catch { break; }
    }
    polling = false;
  }

  function fieldMarkup(name, title, field, type = 'textarea', previewOnly = false) {
    const confidence = Math.round((field?.confidence || 0) * 100);
    const low = confidence < 70;
    let value = field?.value ?? '';
    if (Array.isArray(value)) value = value.join('\n');
    return `<div class="s3-field${low ? ' low-confidence' : ''}"><label>${previewOnly ? '' : `<input type="checkbox" name="confirmFields" value="${name}" ${value ? 'checked' : ''}>`}<span>${escapeHtml(title)}</span></label><p class="s3-confidence${low ? ' low' : ''}">${previewOnly ? 'Thông tin tham khảo · không cập nhật tài khoản' : `Độ tin cậy ${confidence}% · ${escapeHtml(field?.source || 'Ước lượng')}`}</p>${type === 'input' ? `<input ${previewOnly ? 'disabled' : ''} type="text" name="${name}" value="${escapeHtml(value)}" maxlength="${name === 'fullName' ? 100 : 20}">` : `<textarea ${previewOnly ? 'disabled' : ''} name="${name}" rows="${name === 'skills' ? 3 : 4}">${escapeHtml(value)}</textarea>`}</div>`;
  }

  async function openReview(id) {
    const { cv } = await api(`/api/sprint3/cvs/${encodeURIComponent(id)}`);
    if (!cv.parseResult?.fields) throw new Error(cv.error || 'CV chưa có kết quả phân tích.');
    activeCvId = id;
    const fields = cv.parseResult.fields;
    const panel = $('#review-panel');
    $('#review-fields').innerHTML = [
      fieldMarkup('fullName', 'Họ và tên', fields.fullName, 'input'),
      fieldMarkup('phone', 'Số điện thoại', fields.phone, 'input'),
      fieldMarkup('skills', 'Kỹ năng (mỗi dòng một kỹ năng)', fields.skills),
      fieldMarkup('education', 'Học vấn (mỗi dòng một mục)', fields.education),
      fieldMarkup('experiences', 'Kinh nghiệm (mỗi dòng một mục)', fields.experiences),
      fieldMarkup('email', 'Email trong CV', fields.email, 'input', true)
    ].join('');
    panel.hidden = false;
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const splitLines = value => value.split(/\r?\n/).map(item => item.trim()).filter(Boolean).slice(0, 30);
  function parseSections(value, type) {
    return splitLines(value).map(line => {
      const [title = '', organization = '', third = '', fourth = ''] = line.split('|').map(item => item.trim());
      if (type === 'certifications') return { title, organization, issuedAt: third, url: fourth };
      if (type === 'activities') return { title, organization, description: third };
      return { title, url: organization };
    }).filter(row => row.title);
  }
  function sectionLines(rows, type) {
    return (rows || []).map(row => {
      if (type === 'certifications') return [row.title, row.organization, row.issuedAt, row.url].filter(Boolean).join(' | ');
      if (type === 'activities') return [row.title, row.organization, row.description].filter(Boolean).join(' | ');
      return [row.title, row.url].filter(Boolean).join(' | ');
    }).join('\n');
  }

  uploadForm.addEventListener('submit', async event => {
    event.preventDefault();
    const file = $('#cv-file').files[0]; const button = uploadForm.querySelector('button');
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { showMessage($('#upload-result'), 'CV vượt giới hạn 10 MB.', true); return; }
    button.disabled = true; showMessage($('#upload-result'), 'Đang tải file lên và quét virus…');
    try {
      const dataBase64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error('Không đọc được file đã chọn.')); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.readAsDataURL(file); });
      const result = await api('/api/sprint3/cvs', { method: 'POST', body: JSON.stringify({ file: { fileName: file.name, mimeType: file.type, dataBase64 } }) });
      showMessage($('#upload-result'), result.message);
      uploadForm.reset(); await loadCvs(); beginPolling();
    } catch (error) { showMessage($('#upload-result'), error.message, true); }
    finally { button.disabled = false; }
  });

  list.addEventListener('click', async event => {
    const review = event.target.closest('[data-review]'); const setDefault = event.target.closest('[data-default]'); const remove = event.target.closest('[data-delete]');
    try {
      if (review) await openReview(review.dataset.review);
      if (setDefault) { await api(`/api/sprint3/cvs/${encodeURIComponent(setDefault.dataset.default)}/default`, { method: 'POST', body: '{}' }); await loadCvs(); }
      if (remove) { await api(`/api/sprint3/cvs/${encodeURIComponent(remove.dataset.delete)}`, { method: 'DELETE' }); await loadCvs(); }
    } catch (error) { showMessage($('#upload-result'), error.message, true); }
  });

  $('#review-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget; const selected = [...form.querySelectorAll('input[name="confirmFields"]:checked')].map(item => item.value); const fields = {};
    for (const key of selected) {
      const control = form.elements.namedItem(key);
      fields[key] = ['skills', 'education', 'experiences'].includes(key) ? splitLines(control.value) : control.value.trim();
    }
    try { await api(`/api/sprint3/cvs/${encodeURIComponent(activeCvId)}/confirm`, { method: 'POST', body: JSON.stringify({ confirmFields: selected, fields }) }); showMessage($('#upload-result'), 'Đã cập nhật những trường bạn chọn vào hồ sơ.'); $('#review-panel').hidden = true; await Promise.all([loadCvs(), loadEmbeddingStatus()]); }
    catch (error) { showMessage($('#upload-result'), error.message, true); }
  });
  $('#cancel-review').addEventListener('click', () => { $('#review-panel').hidden = true; });
  $('#refresh-cvs').addEventListener('click', () => loadCvs().catch(error => showMessage($('#upload-result'), error.message, true)));

  $('#sections-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget;
    const payload = Object.fromEntries(['certifications', 'activities', 'externalLinks'].map(key => [key, parseSections(form.elements.namedItem(key).value, key)]));
    try { await api('/api/sprint3/profile-sections', { method: 'PATCH', body: JSON.stringify(payload) }); showMessage($('#sections-result'), 'Các mục hồ sơ đã được lưu.'); await loadEmbeddingStatus(); }
    catch (error) { showMessage($('#sections-result'), error.message, true); }
  });

  (async () => {
    try {
      if (!await ensureStudent()) return;
      const [cvs, sections] = await Promise.all([loadCvs(), api('/api/sprint3/profile-sections')]);
      for (const key of ['certifications', 'activities', 'externalLinks']) $('#sections-form').elements.namedItem(key).value = sectionLines(sections[key], key);
      await loadEmbeddingStatus();
      if (cvs.some(cv => ['queued', 'processing', 'retry_wait'].includes(cv.status))) beginPolling();
    } catch (error) { sessionMessage.hidden = false; sessionMessage.textContent = error.message; }
  })();
})();
