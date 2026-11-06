const modal = document.querySelector('#auth-modal');
const modalContent = document.querySelector('#modal-content');
const toast = document.querySelector('#toast');
let currentUser = null;
let categoryData = { industries: [], schools: [], locations: [], skills: [] };
let toastTimer;
let focusBeforeModal = null;

async function request(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.error || 'Đã có lỗi xảy ra.'); error.status = response.status; throw error; }
  return data;
}
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}
function openModal() {
  if (modal.hidden) focusBeforeModal = document.activeElement;
  modal.hidden = false; document.body.style.overflow = 'hidden';
  modal.querySelector('.modal-close')?.focus();
}
function closeModal() {
  modal.hidden = true; document.body.style.overflow = '';
  focusBeforeModal?.focus?.(); focusBeforeModal = null;
}
function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function errorBox(message) { return `<div class="form-error" role="alert">${escapeHtml(message)}</div>`; }
function setContent(html) { modalContent.innerHTML = html; openModal(); }

function loginView(error = '') {
  setContent(`<h2 id="modal-title">Chào mừng bạn trở lại</h2><p class="modal-intro">Đăng nhập để tiếp tục hành trình tìm kiếm cơ hội phù hợp.</p>
    <form id="login-form"><label class="field"><span>Email</span><input type="email" name="email" autocomplete="email" placeholder="ban@email.com" required maxlength="254"></label>
    <label class="field"><span>Mật khẩu</span><input type="password" name="password" autocomplete="current-password" placeholder="Nhập mật khẩu" required maxlength="128"></label><p class="modal-switch forgot-back"><button type="button" data-view="forgot">Quên mật khẩu?</button></p>
    ${error ? errorBox(error) : ''}<button class="btn btn-primary btn-large modal-submit">Đăng nhập <span>↗</span></button></form>
    <p class="modal-switch">Chưa có tài khoản? <button type="button" data-view="register">Tạo tài khoản</button></p>`);
}
function forgotView(error = '', success = '') {
  setContent(`<h2 id="modal-title">Đặt lại mật khẩu</h2><p class="modal-intro">Nhập email tài khoản. Liên kết đặt lại có hiệu lực trong 15 phút.</p>${success ? `<div class="form-success">${success}</div>` : ''}<form id="forgot-form"><label class="field"><span>Email</span><input type="email" name="email" autocomplete="email" required maxlength="254" placeholder="ban@email.com"></label>${error ? errorBox(error) : ''}<button class="btn btn-primary btn-large modal-submit">Gửi hướng dẫn <span>↗</span></button></form><p class="modal-switch"><button type="button" data-view="login">Quay lại đăng nhập</button></p>`);
}
function resetView(token, error = '') {
  setContent(`<h2 id="modal-title">Tạo mật khẩu mới</h2><p class="modal-intro">Chọn mật khẩu mới có ít nhất 8 ký tự.</p><form id="reset-form"><input type="hidden" name="token" value="${escapeHtml(token)}"><label class="field"><span>Mật khẩu mới</span><input type="password" name="password" minlength="8" maxlength="128" autocomplete="new-password" required></label>${error ? errorBox(error) : ''}<button class="btn btn-primary btn-large modal-submit">Cập nhật mật khẩu <span>↗</span></button></form>`);
}
function registerView(error = '', success = '', initialRole = 'student') {
  setContent(`<h2 id="modal-title">Bắt đầu kết nối</h2><p class="modal-intro">Tạo tài khoản miễn phí và xây dựng hồ sơ của bạn.</p>
    ${success ? `<div class="form-success">${success}</div>` : ''}
    <form id="register-form"><label class="field"><span>Họ và tên</span><input name="name" autocomplete="name" placeholder="Nguyễn Minh Anh" required maxlength="100"></label>
    <label class="field"><span>Email</span><input type="email" name="email" autocomplete="email" placeholder="ban@email.com" required maxlength="254"></label>
    <label class="field"><span>Bạn tham gia với vai trò</span><select name="role"><option value="student" ${initialRole === 'student' ? 'selected' : ''}>Sinh viên / Người tìm việc</option><option value="employer" ${initialRole === 'employer' ? 'selected' : ''}>Nhà tuyển dụng</option></select></label>
    <label class="field"><span>Mật khẩu</span><input type="password" name="password" autocomplete="new-password" minlength="8" maxlength="128" placeholder="Tối thiểu 8 ký tự" required></label>
    <label class="check-row"><input type="checkbox" name="consent" required><span>Tôi đồng ý cho phép xử lý thông tin để tạo tài khoản và hồ sơ. Tôi có thể yêu cầu xóa tài khoản sau này.</span></label>
    ${error ? errorBox(error) : ''}<button class="btn btn-primary btn-large modal-submit">Tạo tài khoản <span>↗</span></button></form>
    <p class="modal-switch">Đã có tài khoản? <button type="button" data-view="login">Đăng nhập</button></p>`);
}
function verificationResendForm(email) {
  return `<form id="resend-verification-form"><input type="hidden" name="email" value="${escapeHtml(email)}"><button class="auth-tab">Gửi lại email xác minh</button></form>`;
}

function openDashboard(user) {
  if (!user || user.role !== 'student') {
    setContent(`<div class="dashboard-head"><div><h2 id="modal-title">Tài khoản của bạn</h2><span class="dashboard-role">${user?.role === 'employer' ? 'Nhà tuyển dụng' : 'Tài khoản'}</span></div><button class="auth-tab" id="logout-button">Đăng xuất</button></div><div class="form-success">${user?.role === 'employer' ? 'Tài khoản nhà tuyển dụng đã sẵn sàng.' : 'Tài khoản đã sẵn sàng.'}</div>${user?.role === 'employer' ? '<a class="auth-tab" href="/employer.html">Quản lý doanh nghiệp và tin tuyển dụng ↗</a>' : ''}<label class="field"><span>Email đã xác minh</span><input value="${escapeHtml(user?.email || '')}" disabled></label><form id="change-email-form"><label class="field"><span>Email mới</span><input type="email" name="email" required maxlength="254" placeholder="email-moi@example.com"></label><label class="field"><span>Xác nhận bằng mật khẩu</span><input type="password" name="password" required autocomplete="current-password"></label><div id="email-change-result"></div><button class="auth-tab">Đổi email</button></form><form id="change-password-form"><label class="field"><span>Mật khẩu hiện tại</span><input type="password" name="currentPassword" required autocomplete="current-password"></label><label class="field"><span>Mật khẩu mới</span><input type="password" name="password" required minlength="8" maxlength="128" autocomplete="new-password"></label><div id="password-change-result"></div><button class="auth-tab">Đổi mật khẩu</button></form><button class="auth-tab danger-button" id="delete-account-button" type="button">Xóa tài khoản</button>`);
    return;
  }
  profileView(user.profile || {});
}
function onboardingView(profile = {}, step = 0, error = '') {
  const fields = [
    `<label class="field"><span>Lĩnh vực quan tâm</span><select name="industry"><option value="">Chọn lĩnh vực</option>${categoryData.industries.map(item => `<option value="${escapeHtml(item)}" ${profile.industry === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}</select></label><label class="field"><span>Ngành học</span><input name="major" value="${escapeHtml(profile.major || '')}" maxlength="120" placeholder="Ví dụ: Công nghệ thông tin"></label><label class="field"><span>Trường</span><select name="school"><option value="">Chọn trường</option>${categoryData.schools.map(item => `<option value="${escapeHtml(item)}" ${profile.school === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}</select></label>`,
    `<label class="field"><span>Vị trí mong muốn (mỗi dòng một vị trí)</span><textarea name="desiredRoles" placeholder="Frontend Developer">${escapeHtml((profile.desiredRoles || []).join('\n'))}</textarea></label><label class="field"><span>Loại hình công việc</span><select name="jobType"><option value="">Chọn loại hình</option>${['Thực tập', 'Toàn thời gian', 'Bán thời gian', 'Freelance'].map(item => `<option value="${item}" ${profile.jobTypes?.includes(item) ? 'selected' : ''}>${item}</option>`).join('')}</select></label>`,
    `<label class="field"><span>Địa điểm mong muốn</span><select name="location"><option value="">Chọn địa điểm</option>${categoryData.locations.map(item => `<option value="${escapeHtml(item)}" ${profile.location === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}</select></label><p class="modal-intro">Bạn có thể bổ sung kỹ năng, học vấn và kinh nghiệm trong hồ sơ sau.</p>`
  ];
  setContent(`<h2 id="modal-title">Bắt đầu hồ sơ · ${step + 1}/3</h2><p class="modal-intro">Chọn thông tin giúp chúng tôi hiểu định hướng nghề nghiệp của bạn. Bạn có thể bỏ qua và cập nhật sau.</p><form id="onboarding-form" data-step="${step}">${fields[step]}${error ? errorBox(error) : ''}<div class="onboarding-actions">${step ? '<button type="button" class="auth-tab" data-onboarding-back>Quay lại</button>' : ''}<button type="button" class="auth-tab" data-onboarding-skip>Bỏ qua</button><button class="btn btn-primary btn-large">${step === 2 ? 'Hoàn tất' : 'Tiếp tục'}</button></div></form>`);
}
function profileView(profile = {}, message = '') {
  const selected = new Set(profile.skills || []);
  const chips = categoryData.skills.map(skill => `<button class="tag-option${selected.has(skill) ? ' selected' : ''}" type="button" data-skill="${escapeHtml(skill)}" aria-pressed="${selected.has(skill)}">${escapeHtml(skill)}</button>`).join('');
  const completeFields = [profile.fullName, profile.industry, profile.school, profile.major, profile.gradYear, profile.location, profile.bio, (profile.skills || []).length ? 'yes' : '', (profile.desiredRoles || []).length ? 'yes' : '', (profile.education || []).length ? 'yes' : '', (profile.experiences || []).length ? 'yes' : '', (profile.projects || []).length ? 'yes' : '', (profile.languages || []).length ? 'yes' : ''];
  const percent = Math.round(completeFields.filter(Boolean).length / completeFields.length * 100);
  const completionTips = [[profile.fullName, 'Thêm họ tên'], [profile.industry, 'Chọn lĩnh vực'], [profile.school, 'Thêm trường học'], [profile.major, 'Thêm chuyên ngành'], [profile.location, 'Chọn địa điểm'], [(profile.skills || []).length, 'Thêm kỹ năng'], [(profile.desiredRoles || []).length, 'Chọn vị trí mong muốn'], [(profile.experiences || []).length, 'Bổ sung kinh nghiệm'], [(profile.projects || []).length, 'Thêm dự án'], [(profile.languages || []).length, 'Thêm ngoại ngữ']].filter(([value]) => !value).map(([, tip]) => tip);
  const schoolOptions = categoryData.schools.map(item => `<option value="${escapeHtml(item)}" ${profile.school === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('');
  const locationOptions = categoryData.locations.map(item => `<option value="${escapeHtml(item)}" ${profile.location === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('');
  setContent(`<div class="dashboard-head"><div><h2 id="modal-title">Hồ sơ của bạn</h2><span class="dashboard-role">${escapeHtml(currentUser?.email || '')}</span></div><button class="auth-tab" id="logout-button">Đăng xuất</button></div>
    <div class="profile-completion"><div class="completion-top"><strong>Mức độ hoàn thiện</strong><span>${percent}%</span></div><div class="completion-track"><i></i></div>${completionTips.length ? `<small class="completion-tips">Gợi ý tiếp theo: ${completionTips.slice(0, 3).map(escapeHtml).join(' · ')}</small>` : '<small class="completion-tips">Hồ sơ đã có các thông tin cốt lõi.</small>'}</div>
    ${message ? `<div class="form-success">${escapeHtml(message)}</div>` : ''}
    <form id="profile-form"><details class="profile-section" open><summary>Thông tin cá nhân và học vấn</summary><div class="profile-form-grid">
    <label class="field span-two"><span>Họ và tên *</span><input name="fullName" value="${escapeHtml(profile.fullName || '')}" required maxlength="100"></label>
    <label class="field span-two"><span>Lĩnh vực quan tâm</span><select name="industry"><option value="">Chọn lĩnh vực</option>${categoryData.industries.map(item => `<option value="${escapeHtml(item)}" ${profile.industry === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}</select></label>
    <label class="field"><span>Số điện thoại</span><input name="phone" type="tel" value="${escapeHtml(profile.phone || '')}" placeholder="09xx xxx xxx" maxlength="20"></label>
    <label class="field"><span>Năm tốt nghiệp</span><input name="gradYear" inputmode="numeric" value="${escapeHtml(profile.gradYear || '')}" placeholder="2027" maxlength="4"></label>
    <label class="field span-two"><span>Trường</span><select name="school"><option value="">Chọn trường</option>${schoolOptions}</select></label>
    <label class="field"><span>Chuyên ngành</span><input name="major" value="${escapeHtml(profile.major || '')}" placeholder="Ví dụ: Công nghệ thông tin" maxlength="120"></label>
    <label class="field"><span>GPA</span><input name="gpa" value="${escapeHtml(profile.gpa || '')}" placeholder="3.5 / 4.0" maxlength="8"></label>
    <label class="field span-two"><span>Địa điểm mong muốn</span><select name="location"><option value="">Chọn địa điểm</option>${locationOptions}</select></label></div></details>
    <details class="profile-section" open><summary>Định hướng công việc</summary><div class="profile-form-grid">
    <label class="field span-two"><span>Giới thiệu ngắn</span><textarea name="bio" maxlength="1000" placeholder="Chia sẻ về định hướng và điều bạn muốn theo đuổi">${escapeHtml(profile.bio || '')}</textarea></label>
    <label class="field span-two"><span>Vị trí mong muốn (mỗi dòng một vị trí)</span><textarea name="desiredRoles" placeholder="Frontend Developer&#10;Thực tập sinh UI/UX">${escapeHtml((profile.desiredRoles || []).join('\n'))}</textarea></label>
    <label class="field span-two"><span>Loại hình công việc (mỗi dòng một loại)</span><textarea name="jobTypes" placeholder="Thực tập&#10;Toàn thời gian">${escapeHtml((profile.jobTypes || []).join('\n'))}</textarea></label>
    </div></details><details class="profile-section"><summary>Năng lực và kinh nghiệm</summary><div class="profile-form-grid">
    <label class="field span-two"><span>Học vấn (mỗi dòng một chương trình)</span><textarea name="education" placeholder="Chương trình · Trường · Thời gian">${escapeHtml((profile.education || []).join('\n'))}</textarea></label>
    <label class="field"><span>Kinh nghiệm</span><textarea name="experiences" placeholder="Mỗi dòng một kinh nghiệm">${escapeHtml((profile.experiences || []).join('\n'))}</textarea></label>
    <label class="field"><span>Dự án</span><textarea name="projects" placeholder="Mỗi dòng một dự án">${escapeHtml((profile.projects || []).join('\n'))}</textarea></label>
    <label class="field span-two"><span>Ngoại ngữ</span><input name="languages" value="${escapeHtml((profile.languages || []).join(', '))}" placeholder="Tiếng Anh, Tiếng Nhật"></label>
    <div class="field span-two"><span>Kỹ năng</span><div class="tag-list" id="skill-list">${chips || '<small>Danh mục kỹ năng chưa có.</small>'}</div></div>
    </div></details><details class="profile-section"><summary>Quyền riêng tư</summary><div class="profile-form-grid">
    <label class="field span-two"><span>Quyền riêng tư hồ sơ</span><select name="visibility"><option value="private" ${profile.visibility === 'private' ? 'selected' : ''}>Ẩn hồ sơ</option><option value="invited" ${profile.visibility === 'invited' ? 'selected' : ''}>Chỉ nhà tuyển dụng đã mời</option><option value="public" ${profile.visibility === 'public' ? 'selected' : ''}>Công khai</option></select></label>
    </div></details><div id="profile-error"></div><button class="btn btn-primary btn-large modal-submit" type="submit">Lưu hồ sơ <span>↗</span></button></form><button class="auth-tab danger-button" id="delete-account-button" type="button">Xóa tài khoản</button>`);
  modalContent.querySelector('.completion-track i').style.width = `${percent}%`;
}

document.addEventListener('click', async event => {
  const open = event.target.closest('[data-open]');
  if (open) { if (open.dataset.open === 'register' || open.dataset.open === 'employer') registerView('', '', open.dataset.open === 'employer' ? 'employer' : 'student'); else loginView(); return; }
  const view = event.target.closest('[data-view]');
  if (view) { if (view.dataset.view === 'register') registerView(); else if (view.dataset.view === 'forgot') forgotView(); else loginView(); return; }
  if (event.target.closest('#modal-close') || event.target === modal) { closeModal(); return; }
  const skill = event.target.closest('[data-skill]');
  if (skill) { skill.classList.toggle('selected'); skill.setAttribute('aria-pressed', skill.classList.contains('selected')); return; }
  if (event.target.closest('#logout-button')) {
    try { await request('/api/logout', { method: 'POST', body: '{}' }); currentUser = null; closeModal(); updateNav(); showToast('Bạn đã đăng xuất.'); }
    catch (error) { showToast(error.message); }
  }
  if (event.target.closest('#delete-account-button')) {
    if (!window.confirm('Bạn muốn xóa tài khoản? Hồ sơ sẽ bị ẩn và phiên đăng nhập bị kết thúc.')) return;
    try { await request('/api/account', { method: 'DELETE', body: JSON.stringify({ confirm: true }) }); currentUser = null; updateNav(); closeModal(); showToast('Tài khoản đã được xóa.'); }
    catch (error) { showToast(error.message); }
  }
  if (event.target.closest('#mobile-menu')) {
    const nav = document.querySelector('.desktop-nav');
    const expanded = nav.classList.toggle('mobile-open');
    const button = document.querySelector('#mobile-menu');
    button.setAttribute('aria-expanded', String(expanded));
    button.setAttribute('aria-label', expanded ? 'Đóng menu' : 'Mở menu');
  }
  if (event.target.closest('.desktop-nav a')) {
    document.querySelector('.desktop-nav').classList.remove('mobile-open');
    document.querySelector('#mobile-menu').setAttribute('aria-expanded', 'false');
  }
  if (event.target.closest('[data-onboarding-skip]')) {
    try { const result = await request('/api/profile', { method: 'PUT', body: JSON.stringify({ profile: { ...currentUser.profile, onboardingCompleted: true } }) }); currentUser.profile = result.profile; profileView(result.profile); }
    catch (error) { showToast(error.message); }
  }
  if (event.target.closest('[data-onboarding-back]')) {
    const form = document.querySelector('#onboarding-form');
    onboardingView(currentUser.profile || {}, Number(form.dataset.step) - 1);
  }
});
document.addEventListener('keydown', event => {
  if (modal.hidden) return;
  if (event.key === 'Escape') { closeModal(); return; }
  if (event.key !== 'Tab') return;
  const focusable = [...modal.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')];
  if (!focusable.length) return;
  if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1).focus(); }
  else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
});
document.addEventListener('submit', async event => {
  const submitButton = event.submitter || event.target.querySelector('button[type="submit"],button:not([type])');
  const originalButtonMarkup = submitButton?.innerHTML;
  if (submitButton) { submitButton.disabled = true; submitButton.innerHTML = 'Đang xử lý…'; }
  if (event.target.id === 'onboarding-form') {
    event.preventDefault();
    const form = event.target;
    const step = Number(form.dataset.step);
    const values = Object.fromEntries(new FormData(form));
    const profile = { ...currentUser.profile, ...values };
    if (values.desiredRoles) profile.desiredRoles = values.desiredRoles.split('\n').map(value => value.trim()).filter(Boolean);
    if (values.jobType) profile.jobTypes = [...new Set([...(profile.jobTypes || []), values.jobType])];
    delete profile.jobType;
    if (step === 2) profile.onboardingCompleted = true;
    try {
      const result = await request('/api/profile', { method: 'PUT', body: JSON.stringify({ profile }) });
      currentUser.profile = result.profile;
      if (step < 2) onboardingView(result.profile, step + 1);
      else profileView(result.profile, 'Onboarding đã hoàn tất. Bạn có thể cập nhật hồ sơ bất cứ lúc nào.');
    } catch (error) { onboardingView(profile, step, error.message); }
  }
  if (event.target.id === 'login-form') {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    try { const result = await request('/api/login', { method: 'POST', body: JSON.stringify(data) }); currentUser = result.user; updateNav(); if (currentUser.role === 'student' && !currentUser.profile?.onboardingCompleted) onboardingView(currentUser.profile || {}); else openDashboard(currentUser); showToast('Đăng nhập thành công.'); }
    catch (error) { loginView(error.message); }
  }
  if (event.target.id === 'forgot-form') {
    event.preventDefault(); const data = Object.fromEntries(new FormData(event.target));
    try { const result = await request('/api/forgot-password', { method: 'POST', body: JSON.stringify(data) }); const link = result.devResetUrl ? `<br><a href="${escapeHtml(result.devResetUrl)}">Mở liên kết đặt lại (local)</a>` : ''; forgotView('', `${escapeHtml(result.message)}${link}`); }
    catch (error) { forgotView(error.message); }
  }
  if (event.target.id === 'resend-verification-form') {
    event.preventDefault();
    const email = new FormData(event.target).get('email');
    try {
      const result = await request('/api/resend-verification', { method: 'POST', body: JSON.stringify({ email }) });
      const link = result.devVerifyUrl ? `<br><a href="${escapeHtml(result.devVerifyUrl)}">Xác minh email (local)</a>` : '';
      registerView('', `${escapeHtml(result.message)}${link}${verificationResendForm(email)}`);
    } catch (error) { registerView(error.message, verificationResendForm(email)); }
  }
  if (event.target.id === 'reset-form') {
    event.preventDefault(); const data = Object.fromEntries(new FormData(event.target));
    try { await request('/api/reset-password', { method: 'POST', body: JSON.stringify(data) }); history.replaceState({}, '', '/'); loginView(); showToast('Mật khẩu đã đổi. Hãy đăng nhập lại.'); }
    catch (error) { resetView(data.token, error.message); }
  }
  if (event.target.id === 'register-form') {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target)); data.consent = event.target.elements.consent.checked;
    try {
      const result = await request('/api/register', { method: 'POST', body: JSON.stringify(data) });
      const verification = result.devVerifyUrl ? `Ở môi trường local, hãy mở liên kết này:<br><a href="${escapeHtml(result.devVerifyUrl)}" target="_blank" rel="noopener">Xác minh email</a>` : 'Hãy kiểm tra hộp thư để xác minh email.';
      registerView('', `Tài khoản đã tạo. ${verification}${verificationResendForm(data.email)}`);
    } catch (error) { registerView(error.message, error.status === 503 ? verificationResendForm(data.email) : ''); }
  }
  if (event.target.id === 'profile-form') {
    event.preventDefault();
    const form = event.target;
    const profile = Object.fromEntries(new FormData(form));
    profile.skills = [...document.querySelectorAll('[data-skill].selected')].map(item => item.dataset.skill);
    profile.onboardingCompleted = Boolean(currentUser.profile?.onboardingCompleted);
    for (const key of ['desiredRoles', 'jobTypes', 'education', 'experiences', 'projects']) profile[key] = String(profile[key] || '').split('\n').map(value => value.trim()).filter(Boolean);
    profile.languages = String(profile.languages || '').split(',').map(value => value.trim()).filter(Boolean);
    try {
      const result = await request('/api/profile', { method: 'PUT', body: JSON.stringify({ profile }) });
      currentUser.profile = result.profile; profileView(result.profile, 'Hồ sơ đã được lưu.'); showToast('Đã lưu hồ sơ của bạn.');
    } catch (error) { document.querySelector('#profile-error').innerHTML = errorBox(error.message); }
  }
  if (event.target.id === 'change-email-form') {
    event.preventDefault(); const data = Object.fromEntries(new FormData(event.target));
    try { const result = await request('/api/change-email', { method: 'POST', body: JSON.stringify(data) }); const localLink = result.devVerifyUrl ? `<br><a href="${escapeHtml(result.devVerifyUrl)}">Xác minh email mới (local)</a>` : '<br>Hãy kiểm tra hộp thư để xác minh email mới.'; document.querySelector('#email-change-result').innerHTML = `<div class="form-success">${escapeHtml(result.message)}${localLink}</div>`; currentUser = null; updateNav(); }
    catch (error) { document.querySelector('#email-change-result').innerHTML = errorBox(error.message); }
  }
  if (event.target.id === 'change-password-form') {
    event.preventDefault(); const data = Object.fromEntries(new FormData(event.target));
    try { await request('/api/change-password', { method: 'POST', body: JSON.stringify(data) }); currentUser = null; updateNav(); loginView(); showToast('Đã đổi mật khẩu. Vui lòng đăng nhập lại.'); }
    catch (error) { document.querySelector('#password-change-result').innerHTML = errorBox(error.message); }
  }
  if (submitButton?.isConnected) { submitButton.disabled = false; submitButton.innerHTML = originalButtonMarkup; }
});

function updateNav() {
  const actions = document.querySelector('#nav-actions');
  if (!currentUser) {
    actions.innerHTML = '<button class="btn btn-quiet" data-open="login">Đăng nhập</button><button class="btn btn-primary btn-small" data-open="register">Tạo tài khoản <span aria-hidden="true">↗</span></button>';
    return;
  }
  actions.innerHTML = `<button class="btn btn-quiet" id="account-button">${escapeHtml(currentUser.profile?.fullName || currentUser.email)}</button><button class="btn btn-primary btn-small" id="logout-button">Đăng xuất</button>`;
  actions.querySelector('#account-button').addEventListener('click', () => openDashboard(currentUser));
}

async function init() {
  try { categoryData = await request('/api/categories'); } catch { /* API is not available when opening the HTML directly. */ }
  try { const result = await request('/api/me'); currentUser = result.user; updateNav(); } catch { /* signed out */ }
  const verifyToken = new URLSearchParams(location.search).get('verify');
  if (verifyToken) {
    try { await request(`/api/verify?token=${encodeURIComponent(verifyToken)}`); history.replaceState({}, '', '/'); loginView(); showToast('Email đã xác minh. Bạn có thể đăng nhập.'); }
    catch (error) { history.replaceState({}, '', '/'); registerView(error.message); }
  }
  const resetToken = new URLSearchParams(location.search).get('reset');
  if (resetToken) { history.replaceState({}, '', '/'); resetView(resetToken); }
}
init();
