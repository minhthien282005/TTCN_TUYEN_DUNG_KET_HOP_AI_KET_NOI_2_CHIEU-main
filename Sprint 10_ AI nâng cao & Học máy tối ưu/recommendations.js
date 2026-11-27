'use strict';
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
async function api(url, options = {}) { const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) } }); const data = await response.json().catch(() => ({})); if (!response.ok) throw Object.assign(new Error(data.error || `Lỗi ${response.status}`), { status: response.status }); return data; }
function notice(message, error = false) { $('#s10-notice').textContent = message; $('#s10-notice').classList.toggle('error', error); }
function render(data) {
  const isStudent = data.role === 'student';
  $('#s10-title').textContent = isStudent ? 'Công việc phù hợp với bạn' : 'Ứng viên phù hợp với tin của bạn';
  $('#s10-description').textContent = isStudent ? `${data.items.length} gợi ý đã được sắp xếp theo hồ sơ và phản hồi của bạn.` : `${data.items.length} gợi ý ứng viên đã được sắp xếp theo tin công khai của doanh nghiệp.`;
  $('#s10-profile-link').href = isStudent ? '/cv.html' : '/employer.html';
  $('#s10-profile-link').textContent = isStudent ? 'Cập nhật hồ sơ →' : 'Cập nhật tin tuyển dụng →';
  $('#s10-model').textContent = data.model.semanticReranking ? `Xếp hạng thích nghi · semantic rerank ${data.model.semanticPairs} cặp · ${data.model.feedbackSignals} phản hồi` : `Xếp hạng thích nghi · hồ sơ + phản hồi · ${data.model.feedbackSignals} tín hiệu`;
  if (!data.items.length) { $('#s10-list').innerHTML = `<article class="s10-empty"><h3>Chưa có gợi ý phù hợp</h3><p>${isStudent ? 'Bổ sung kỹ năng, định hướng và địa điểm trong hồ sơ để tăng chất lượng gợi ý.' : 'Tạo hoặc công khai tin tuyển dụng và bật hồ sơ ứng viên công khai để bắt đầu.'}</p><a class="s10-button" href="${isStudent ? '/cv.html' : '/employer.html'}">${isStudent ? 'Cập nhật hồ sơ' : 'Quản lý tin tuyển dụng'}</a></article>`; return; }
  $('#s10-list').innerHTML = data.items.map(item => {
    const entityId = isStudent ? item.id : item.candidate.id;
    const jobId = isStudent ? item.id : item.job.id;
    const title = isStudent ? `<a href="${esc(item.href)}">${esc(item.title)}</a>` : esc(item.candidate.name);
    const subtitle = isStudent ? `${esc(item.company)} · ${esc(item.location || item.workMode || 'Linh hoạt')} · ${esc(item.type || 'Cơ hội nghề nghiệp')}` : `${esc(item.candidate.major || 'Sinh viên')} · ${esc(item.candidate.school || 'Chưa cập nhật trường')} · Gợi ý cho tin: ${esc(item.job.title)}`;
    const tags = isStudent ? (item.skills || []).slice(0, 8) : (item.candidate.skills || []).slice(0, 8);
    const matched = new Set(item.matchedSkills || []);
    const info = isStudent && item.semanticScore !== null ? `<span>Ngữ nghĩa ${item.semanticScore}/100</span>` : '';
    const reasons = (item.reasons || []).map(reason => `<li>${esc(reason)}</li>`).join('');
    const confidence = item.feedback === 'relevant' ? 'Bạn đã đánh dấu gợi ý hữu ích.' : item.feedback === 'not_relevant' ? 'Bạn đã đánh dấu gợi ý ít phù hợp; điểm đã được giảm.' : '';
    return `<article class="s10-card" data-job-id="${esc(jobId)}" data-entity-id="${esc(entityId)}" data-role="${data.role}"><div class="s10-card-head"><div><span class="s10-overline">${isStudent ? esc(item.companyVerified ? 'Doanh nghiệp đã xác minh' : 'Việc làm công khai') : `Gợi ý cho ${esc(item.job.title)}`}</span><h3>${title}</h3><p>${subtitle}</p>${confidence ? `<p>${esc(confidence)}</p>` : ''}</div><div class="s10-score"><strong>${item.rankScore}</strong><span>điểm ưu tiên</span><div class="s10-bar"><i style="width:${Math.min(100, Math.max(0, item.rankScore))}%"></i></div>${info}</div></div><div class="s10-tags">${tags.map(skill => `<span class="${matched.has(skill) ? 'matched' : ''}">${esc(skill)}</span>`).join('')}</div><details class="s10-reasons"><summary>Giải thích gợi ý</summary><ul>${reasons || '<li>Được xếp theo các tiêu chí phù hợp hiện có.</li>'}</ul></details><div class="s10-feedback"><button class="s10-vote" data-value="relevant" aria-pressed="${item.feedback === 'relevant'}">Hữu ích</button><button class="s10-vote" data-value="not_relevant" aria-pressed="${item.feedback === 'not_relevant'}">Ít phù hợp</button>${item.feedback ? '<button class="s10-vote" data-value="clear">Bỏ đánh giá</button>' : ''}</div></article>`;
  }).join('');
}
async function load() {
  try { const me = await api('/api/me'); if (!me.user) { notice('Đăng nhập để xem gợi ý cá nhân hóa.', true); $('#s10-list').innerHTML = '<article class="s10-empty"><h3>Gợi ý theo hồ sơ của bạn</h3><p>Đăng nhập để xem và điều chỉnh danh sách đề xuất.</p><a class="s10-button" href="/?open=login&amp;next=%2Fsprint10%2Frecommendations.html">Đăng nhập</a></article>'; return; } if (!['student', 'employer'].includes(me.user.role)) { notice('Tài khoản admin không có gợi ý tuyển dụng.', true); return; } render(await api('/api/sprint10/recommendations')); }
  catch (error) { notice(error.message, true); }
}
$('#s10-list').addEventListener('click', async event => {
  const button = event.target.closest('[data-value]'); if (!button) return;
  const card = button.closest('[data-job-id]'); button.disabled = true;
  try { await api('/api/sprint10/feedback', { method: 'POST', body: JSON.stringify({ jobId: card.dataset.jobId, candidateId: card.dataset.role === 'employer' ? card.dataset.entityId : null, value: button.dataset.value }) }); notice('Đã cập nhật phản hồi; gợi ý được sắp xếp lại.'); await load(); }
  catch (error) { notice(error.message, true); button.disabled = false; }
});
load();
