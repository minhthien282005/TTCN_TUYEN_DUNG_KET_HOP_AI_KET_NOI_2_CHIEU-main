'use strict';

const crypto = require('node:crypto');

const text = (value, limit = 600) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, limit);
const norm = value => text(value, 3000).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().replace(/[^a-z0-9+#.]+/g, ' ').trim();
const respond = (res, status, value) => { if (res.writableEnded) return; res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
const companyFor = (db, user) => db.companies.find(company => company.ownerId === user.id);
const liveJobs = db => (db.jobs || []).filter(job => job.status === 'published' && (!job.expiresAt || Date.parse(job.expiresAt) > Date.now())).filter(job => db.companies.some(company => company.id === job.companyId && company.verificationStatus === 'verified'));
const cvData = (db, userId) => (db.resumes || []).filter(cv => cv.userId === userId && cv.scanStatus === 'clean' && ['review', 'confirmed'].includes(cv.status)).map(cv => cv.parseResult?.fields?.skills?.value || []).flat();
const values = value => Array.isArray(value) ? value.map(item => typeof item === 'string' ? item : item?.skill || item?.title || item?.name || '').filter(Boolean) : [];
const setOf = value => new Set(values(value).map(norm).filter(Boolean));

function scorePair(profile, job, resumeSkills = []) {
  const p = profile || {};
  const candidateSkills = setOf([...(p.skills || []), ...resumeSkills, ...values(p.certifications), ...values(p.projects)]);
  const jobSkills = values(job.skillCriteria || job.skills);
  const matchedSkills = jobSkills.filter(skill => candidateSkills.has(norm(skill)));
  const missingSkills = jobSkills.filter(skill => !candidateSkills.has(norm(skill)));
  const skillScore = jobSkills.length ? matchedSkills.length / jobSkills.length : 0.55;
  const roles = [...(p.desiredRoles || []), p.major, p.industry].map(norm).filter(Boolean);
  const jobRole = norm(`${job.title} ${job.industry || ''} ${job.description || ''}`);
  const roleHits = roles.filter(role => role.length > 2 && (jobRole.includes(role) || role.split(' ').some(word => word.length > 3 && jobRole.includes(word))));
  const roleScore = roles.length ? Math.min(1, roleHits.length / Math.min(2, roles.length)) : (jobRole.includes(norm(p.major)) && p.major ? 0.65 : 0.4);
  const location = norm(p.location); const jobLocation = norm(job.location); const workMode = norm(job.workMode);
  const locationScore = !location || !jobLocation ? 0.5 : location === jobLocation || ['remote', 'tu xa'].some(item => workMode.includes(item)) ? 1 : location.includes(jobLocation) || jobLocation.includes(location) ? 0.8 : 0.25;
  const types = (p.jobTypes || []).map(norm); const typeScore = !types.length ? 0.5 : types.some(type => norm(job.type).includes(type) || type.includes(norm(job.type))) ? 1 : 0.2;
  const hasEvidence = Boolean(p.school || p.major || p.experiences?.length || p.projects?.length || resumeSkills.length);
  const evidenceScore = hasEvidence ? (p.experiences?.length || p.projects?.length || resumeSkills.length ? 1 : 0.65) : 0.25;
  const score = Math.round((skillScore * 55 + roleScore * 20 + locationScore * 10 + typeScore * 5 + evidenceScore * 10));
  const reasons = [];
  if (matchedSkills.length) reasons.push(`Khớp ${matchedSkills.length}/${jobSkills.length} kỹ năng${matchedSkills.length === 1 ? '' : ' yêu cầu'}: ${matchedSkills.slice(0, 5).join(', ')}.`);
  if (roleHits.length) reasons.push(`Định hướng/ngành học gần với vị trí ${job.title}.`);
  if (locationScore >= 0.8) reasons.push(`Địa điểm hoặc hình thức làm việc phù hợp (${job.location || job.workMode || 'linh hoạt'}).`);
  if (evidenceScore >= 0.8) reasons.push('Hồ sơ có thông tin dự án, kinh nghiệm hoặc kỹ năng đã phân tích từ CV.');
  if (missingSkills.length) reasons.push(`Có thể bổ sung: ${missingSkills.slice(0, 4).join(', ')}.`);
  return { score: Math.max(0, Math.min(100, score)), matchedSkills, missingSkills, reasons: reasons.slice(0, 5) };
}

function candidateScore(user, job, db) { return scorePair(user.profile, job, cvData(db, user.id)); }
function studentMatches(db, user) {
  const alreadyApplied = new Set((db.applications || []).filter(item => item.studentId === user.id).map(item => item.jobId));
  return liveJobs(db).filter(job => !alreadyApplied.has(job.id)).map(job => ({ job, company: db.companies.find(company => company.id === job.companyId), match: candidateScore(user, job, db) }))
    .filter(item => item.match.score >= 35).sort((a, b) => b.match.score - a.match.score).slice(0, 30)
    .map(({ job, company, match }) => ({ id: job.id, slug: job.slug, title: job.title, company: company?.name || 'Doanh nghiệp', companyVerified: company?.verificationStatus === 'verified', location: job.location, workMode: job.workMode, type: job.type, salaryMin: job.salaryMin, salaryMax: job.salaryMax, skills: values(job.skillCriteria || job.skills), publishedAt: job.publishedAt, score: match.score, matchedSkills: match.matchedSkills, missingSkills: match.missingSkills, reasons: match.reasons, href: `/jobs/${encodeURIComponent(job.slug || 'viec-lam')}--${encodeURIComponent(job.id)}` }));
}
function employerMatches(db, user) {
  const company = companyFor(db, user); if (!company) return [];
  const jobs = liveJobs(db).filter(job => job.companyId === company.id);
  const applied = new Set((db.applications || []).filter(item => item.companyId === company.id).map(item => item.studentId));
  return jobs.flatMap(job => (db.users || []).filter(candidate => candidate.role === 'student' && !candidate.deletedAt && candidate.profile?.visibility === 'public' && !applied.has(candidate.id)).map(candidate => {
    const match = candidateScore(candidate, job, db);
    return { job: { id: job.id, title: job.title }, candidate: { id: candidate.id, name: text(candidate.profile?.fullName || candidate.name, 100), major: text(candidate.profile?.major, 120), school: text(candidate.profile?.school, 120), location: text(candidate.profile?.location, 100), skills: [...new Set([...(candidate.profile?.skills || []), ...cvData(db, candidate.id)])].slice(0, 12), desiredRoles: (candidate.profile?.desiredRoles || []).slice(0, 4), experienceCount: (candidate.profile?.experiences || []).length + (candidate.profile?.projects || []).length }, ...match };
  })).filter(item => item.score >= 45).sort((a, b) => b.score - a.score).slice(0, 60);
}

function makeNotification(db, userId, key, title, message, href, baseline = false) {
  db.notifications ||= []; db.emailOutbox ||= []; db.matchEvents ||= [];
  if (db.matchEvents.some(item => item.key === key)) return false;
  if (baseline) { db.matchEvents.push({ id: crypto.randomUUID(), key, userId, baseline: true, createdAt: new Date().toISOString() }); return true; }
  const now = new Date().toISOString(); const notificationId = crypto.randomUUID();
  db.notifications.push({ id: notificationId, userId, type: 'ai.match', title, message, href, readAt: null, createdAt: now });
  db.emailOutbox.push({ id: crypto.randomUUID(), notificationId, userId, status: 'queued', attempts: 0, nextAttemptAt: now, createdAt: now, updatedAt: now });
  db.matchEvents.push({ id: crypto.randomUUID(), key, userId, createdAt: now });
  return true;
}
const studentMatchKey = (db, student, match) => {
  const job = db.jobs.find(item => item.id === match.id);
  const resumesUpdated = (db.resumes || []).filter(item => item.userId === student.id && item.scanStatus === 'clean').map(item => item.updatedAt || item.createdAt).sort().join(',');
  return `student:${student.id}:${match.id}:${student.profile?.updatedAt || 'profile'}:${resumesUpdated}:${job?.updatedAt || 'job'}`;
};
const employerMatchKey = (db, owner, match) => {
  const candidate = db.users.find(item => item.id === match.candidate.id);
  const job = db.jobs.find(item => item.id === match.job.id);
  const resumesUpdated = (db.resumes || []).filter(item => item.userId === match.candidate.id && item.scanStatus === 'clean').map(item => item.updatedAt || item.createdAt).sort().join(',');
  return `employer:${owner.id}:${match.job.id}:${match.candidate.id}:${candidate?.profile?.updatedAt || 'profile'}:${resumesUpdated}:${job?.updatedAt || 'job'}`;
};
function syncNotifications(db, { baseline = false } = {}) {
  let changed = false;
  for (const student of db.users || []) {
    if (student.role !== 'student' || student.deletedAt) continue;
    const studentSuggestions = studentMatches(db, student).filter(item => item.score >= 55).map(match => ({ match, key: studentMatchKey(db, student, match) }));
    const pendingStudentSuggestions = baseline ? studentSuggestions : studentSuggestions.filter(item => !db.matchEvents.some(event => event.key === item.key)).slice(0, 5);
    for (const { match, key } of pendingStudentSuggestions) changed = makeNotification(db, student.id, key, 'AI tìm thấy công việc phù hợp', `${match.title} tại ${match.company} phù hợp ${match.score}% với hồ sơ của bạn.`, match.href, baseline) || changed;
  }
  const owners = (db.users || []).filter(user => user.role === 'employer' && !user.deletedAt);
  for (const owner of owners) {
    const employerSuggestions = employerMatches(db, owner).filter(item => item.score >= 65).map(match => ({ match, key: employerMatchKey(db, owner, match) }));
    const pendingEmployerSuggestions = baseline ? employerSuggestions : employerSuggestions.filter(item => !db.matchEvents.some(event => event.key === item.key)).slice(0, 5);
    for (const { match, key } of pendingEmployerSuggestions) changed = makeNotification(db, owner.id, key, 'AI gợi ý ứng viên phù hợp', `${match.candidate.name} phù hợp ${match.score}% với tin ${match.job.title}.`, '/matches.html', baseline) || changed;
  }
  if (changed) {
    db.matchEvents = (db.matchEvents || []).slice(-10_000);
    db.notifications = (db.notifications || []).slice(-20_000);
    db.emailOutbox = (db.emailOutbox || []).slice(-20_000);
  }
  return changed;
}

function chatReply(db, user, message) {
  const q = norm(message); const profile = user?.role === 'student' ? user.profile || {} : null;
  if (/^(hi|hello|xin chao|chao|hey)/.test(q)) return `Chào ${text(user?.name || 'bạn', 40)}! Mình có thể tìm việc theo kỹ năng, giải thích độ phù hợp, gợi ý cách cải thiện CV hoặc giúp nhà tuyển dụng khám phá ứng viên.`;
  if (user?.role === 'student' && /phong van|interview|thu ung tuyen|cover letter/.test(q)) {
    const role = (profile.desiredRoles || [])[0] || 'vị trí bạn ứng tuyển';
    const project = (profile.projects || [])[0]?.title || (profile.experiences || [])[0]?.title || '';
    return `Để chuẩn bị cho ${role}: chọn 2–3 ví dụ STAR (tình huống, nhiệm vụ, hành động, kết quả); luyện giới thiệu bản thân trong 60–90 giây; đọc kỹ yêu cầu và chuẩn bị câu hỏi cho nhà tuyển dụng.${project ? ` Bạn có thể bắt đầu từ dự án/kinh nghiệm “${text(project, 100)}” và nêu rõ phần việc cùng kết quả của mình.` : ' Hãy thêm một dự án cụ thể vào hồ sơ để câu trả lời có bằng chứng.'}`;
  }
  if (user?.role === 'employer' && /mo ta|yeu cau|tin tuyen|bai dang|dang tuyen/.test(q)) {
    const ownJobs = liveJobs(db).filter(job => job.companyId === companyFor(db, user)?.id);
    if (!ownJobs.length) return 'Chưa thấy tin công khai của doanh nghiệp. Tạo tin, ghi rõ trách nhiệm hằng ngày, kỹ năng bắt buộc và quyền lợi; sau khi được duyệt, mình có thể tìm ứng viên theo tiêu chí đó.';
    const job = ownJobs[0]; const gaps = [];
    if ((job.description || '').length < 120) gaps.push('mở rộng mô tả công việc bằng 3–5 trách nhiệm cụ thể');
    if (!(job.skillCriteria || job.skills || []).length) gaps.push('thêm các kỹ năng bắt buộc và tách kỹ năng ưu tiên');
    if ((job.requirements || '').length < 40) gaps.push('nêu mức kinh nghiệm, kỹ năng và điều kiện tối thiểu');
    if ((job.benefits || '').length < 25) gaps.push('ghi rõ lương/phụ cấp, đào tạo hoặc chế độ');
    return gaps.length ? `Mình xem tin “${job.title}” và thấy có thể cải thiện: ${gaps.join('; ')}. Viết cụ thể, trung tính và chỉ giữ tiêu chí liên quan trực tiếp tới công việc để ứng viên tự đánh giá chính xác. Mở /ai-tools.html để tạo bản nháp.` : `Tin “${job.title}” đã có mô tả, tiêu chí và quyền lợi cơ bản. Hãy làm rõ kết quả mong đợi trong 3 tháng đầu và giữ yêu cầu kỹ năng đúng với công việc thực tế. Có thể tạo bản nháp thay thế tại /ai-tools.html.`;
  }
  if (/cv|ho so|resume|ky nang|skill|thieu|cai thien/.test(q)) {
    if (!profile) return 'Một CV dễ đọc nên nêu rõ vị trí mong muốn, kỹ năng gắn với dự án cụ thể, kết quả đo được và học vấn liên quan. Dùng tiêu đề mục ngắn, kiểm tra lỗi chính tả và cập nhật hồ sơ công khai nếu bạn muốn nhà tuyển dụng khám phá. Đăng nhập rồi mở /ai-tools.html để tạo bản nháp mô tả kinh nghiệm.';
    const skills = [...new Set([...(profile.skills || []), ...cvData(db, user.id)])];
    const roles = profile.desiredRoles || [];
    const suggestions = [];
    if (!skills.length) suggestions.push('thêm kỹ năng vào CV hoặc hồ sơ');
    if (!roles.length) suggestions.push('ghi rõ 1–3 vị trí mong muốn');
    if (!profile.location) suggestions.push('bổ sung địa điểm làm việc');
    if (!(profile.projects || []).length && !(profile.experiences || []).length) suggestions.push('thêm dự án hoặc trải nghiệm kèm kết quả cụ thể');
    return suggestions.length ? `Dựa trên hồ sơ hiện có, bạn nên ${suggestions.join('; ')}. Kỹ năng mình đọc được: ${skills.slice(0, 10).join(', ') || 'chưa có'}. Bạn kiểm tra và cập nhật lại thông tin trước khi ứng tuyển; mở /ai-tools.html để tạo bản nháp mô tả kinh nghiệm nhé.` : `Hồ sơ đã có ${skills.length} kỹ năng${roles.length ? ` và định hướng ${roles.join(', ')}` : ''}. Hãy bổ sung kết quả đo được cho từng dự án/kinh nghiệm và nêu rõ công nghệ đã dùng; xem gợi ý phù hợp tại /matches.html hoặc tạo bản nháp tại /ai-tools.html.`;
  }
  if (/ung vien|candidate|tuyen dung|nha tuyen|ho so phu hop/.test(q) && user?.role === 'employer') {
    const matches = employerMatches(db, user).slice(0, 3);
    return matches.length ? `Mình tìm thấy ${matches.length} ứng viên đáng xem: ${matches.map(item => `${item.candidate.name} (${item.score}%, ${item.job.title})`).join('; ')}. Mở Gợi ý phù hợp để xem kỹ năng trùng và tiêu chí giải thích.` : 'Chưa có ứng viên đạt ngưỡng phù hợp cho các tin đang công khai. Bạn có thể bổ sung kỹ năng bắt buộc, mô tả rõ trách nhiệm, hoặc hướng dẫn ứng viên đặt hồ sơ ở chế độ công khai.';
  }
  if (/viec|job|cong viec|thuc tap|intern|tim/.test(q)) {
    const list = user?.role === 'student' ? studentMatches(db, user).slice(0, 3) : liveJobs(db).filter(job => { const term = q.split(' ').filter(word => word.length > 3); return !term.length || term.some(word => norm(`${job.title} ${job.industry} ${job.skills?.join(' ')}`).includes(word)); }).slice(0, 3).map(job => ({ title: job.title, company: db.companies.find(company => company.id === job.companyId)?.name, score: null }));
    return list.length ? `Đây là ${list.length} cơ hội nên xem: ${list.map(item => `${item.title} — ${item.company}${item.score ? ` (phù hợp ${item.score}%)` : ''}`).join('; ')}. Mở trang Gợi ý phù hợp hoặc Tìm việc để xem chi tiết.` : 'Mình chưa tìm thấy cơ hội phù hợp với thông tin hiện có. Thử cho mình biết vị trí, kỹ năng hoặc địa điểm bạn quan tâm.';
  }
  if (user?.role === 'student') return 'Mình có thể giúp bạn tìm việc theo kỹ năng/địa điểm, phân tích điểm mạnh và kỹ năng còn thiếu, hoặc góp ý cách viết CV. Bạn đang quan tâm vị trí nào?';
  if (user?.role === 'employer') return 'Mình có thể gợi ý ứng viên theo yêu cầu tin tuyển dụng, giải thích kỹ năng khớp và đề xuất cải thiện mô tả công việc. Bạn muốn tuyển vị trí nào?';
  return 'Mình có thể tìm tin tuyển dụng đang công khai và giải thích cách Ketnoi ghép nối hai phía. Đăng nhập để nhận gợi ý cá nhân hóa theo hồ sơ.';
}
async function modelChatReply(db, user, message, externalConsent) {
  if (!process.env.OPENAI_API_KEY || !externalConsent) return { reply: chatReply(db, user, message), mode: 'contextual' };
  const profile = user?.role === 'student' ? user.profile || {} : null;
  const context = user?.role === 'student' ? {
    role: 'student', skills: [...new Set([...(profile.skills || []), ...cvData(db, user.id)])].slice(0, 30),
    desiredRoles: (profile.desiredRoles || []).slice(0, 8), location: text(profile.location, 100), major: text(profile.major, 100),
    matches: studentMatches(db, user).slice(0, 5).map(item => ({ title: item.title, company: item.company, score: item.score, matchedSkills: item.matchedSkills, missingSkills: item.missingSkills }))
  } : user?.role === 'employer' ? {
    role: 'employer', jobs: liveJobs(db).filter(job => job.companyId === companyFor(db, user)?.id).slice(0, 20).map(job => ({ title: job.title, skills: values(job.skillCriteria || job.skills) })),
    candidateSuggestions: employerMatches(db, user).slice(0, 10).map(item => ({ job: item.job.title, major: item.candidate.major, school: item.candidate.school, skills: item.candidate.skills, matchedSkills: item.matchedSkills, score: item.score }))
  } : { role: 'guest', jobs: liveJobs(db).slice(0, 8).map(job => ({ title: job.title, company: db.companies.find(company => company.id === job.companyId)?.name, location: job.location, skills: values(job.skillCriteria || job.skills) })) };
  try {
    const response = await fetch(process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions', {
      method: 'POST', signal: AbortSignal.timeout(12_000),
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', temperature: 0.35, max_tokens: 500, messages: [
        { role: 'system', content: 'Bạn là trợ lý nghề nghiệp Ketnoi, trả lời bằng tiếng Việt, rõ ràng và hữu ích. Chỉ dựa trên dữ liệu ngữ cảnh đã cho; không bịa tin việc/kỹ năng. Giải thích gợi ý, không tự quyết định tuyển dụng. Tôn trọng yêu cầu riêng tư; không yêu cầu hay tiết lộ dữ liệu liên hệ. Ngữ cảnh dữ liệu (JSON): ' + JSON.stringify(context) },
        { role: 'user', content: text(message, 1000) }
      ] })
    });
    if (!response.ok) throw new Error(`AI provider returned ${response.status}`);
    const data = await response.json(); const reply = text(data.choices?.[0]?.message?.content, 5000);
    if (!reply) throw new Error('AI provider returned an empty response');
    return { reply, mode: 'generative' };
  } catch {
    return { reply: chatReply(db, user, message), mode: 'contextual' };
  }
}
function localDraft(role, task, input) {
  if (role === 'employer' && task === 'job_description') {
    const title = text(input.title, 120); const industry = text(input.industry, 120); const level = text(input.level, 80);
    const responsibilities = text(input.responsibilities || input.existingDescription, 1800); const requirements = text(input.requirements, 1200); const skills = text(input.skills, 500); const benefits = text(input.benefits, 500);
    const lines = [`${title}${level ? ` · ${level}` : ''}${industry ? ` | ${industry}` : ''}`, '', 'Mô tả công việc', responsibilities || '• [Bổ sung 2–4 nhiệm vụ chính và kết quả mong đợi của vị trí.]', '', 'Yêu cầu', requirements || (skills ? `• Kỹ năng/kiến thức: ${skills}.\n• [Bổ sung mức kinh nghiệm hoặc điều kiện thật của vị trí.]` : '• [Bổ sung kỹ năng bắt buộc và mức kinh nghiệm phù hợp với vị trí.]'), benefits ? `\n\nQuyền lợi\n${benefits}` : ''];
    return lines.join('\n').trim();
  }
  if (role === 'student' && task === 'cv_bullet') {
    const project = text(input.project, 180); const target = text(input.targetRole, 120); const skills = text(input.skills, 400); const actions = text(input.actions, 1000); const result = text(input.result, 500);
    return `${project ? `${project}${target ? ` · định hướng ${target}` : ''}. ` : ''}${actions || 'Mô tả ngắn gọn phần việc bạn trực tiếp đảm nhiệm.'}${skills ? ` Áp dụng ${skills}.` : ''} Kết quả: ${result || '[bổ sung kết quả hoặc số liệu thực tế của bạn]'}`.trim();
  }
  if (role === 'student' && task === 'cv_summary') {
    const target = text(input.targetRole, 120) || 'vị trí bạn đang hướng tới'; const skills = text(input.skills, 400); const evidence = text(input.evidence, 600);
    return [`Định hướng: ${target}`, skills ? `Kỹ năng: ${skills}` : '', evidence ? `Dự án/kinh nghiệm: ${evidence}` : '', '[Bổ sung mục tiêu nghề nghiệp cụ thể của bạn.]'].filter(Boolean).join('\n');
  }
  return '';
}
async function generateDraft(db, user, task, input, externalConsent) {
  const fallback = localDraft(user.role, task, input);
  if (!fallback) return { error: 'Tác vụ AI không hợp lệ.' };
  if (!process.env.OPENAI_API_KEY || !externalConsent) return { suggestion: fallback, mode: 'contextual' };
  try {
    const system = user.role === 'employer'
      ? 'Bạn hỗ trợ nhà tuyển dụng viết tin tuyển dụng tiếng Việt chuyên nghiệp, dễ đọc và bao hàm. Chỉ dùng dữ kiện đầu vào; không tự đặt lương, chế độ, điều kiện hay công nghệ. Không thêm tiêu chí phân biệt đối xử. Trả về nội dung hoàn chỉnh, không lời dẫn.'
      : 'Bạn hỗ trợ sinh viên viết CV tiếng Việt rõ ràng, súc tích. Chỉ dùng dữ kiện người dùng cung cấp; tuyệt đối không bịa số liệu, thành tích, vai trò hay kỹ năng. Nếu thiếu kết quả, ghi [bổ sung kết quả thực tế]. Trả về nội dung có thể đưa vào CV, không lời dẫn.';
    const response = await fetch(process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions', {
      method: 'POST', signal: AbortSignal.timeout(12_000), headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', temperature: 0.35, max_tokens: 650, messages: [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify({ task, details: input }) }] })
    });
    if (!response.ok) throw new Error('AI provider unavailable');
    const data = await response.json(); const suggestion = text(data.choices?.[0]?.message?.content, 5000);
    if (!suggestion) throw new Error('AI provider returned an empty response');
    return { suggestion, mode: 'generative' };
  } catch { return { suggestion: fallback, mode: 'contextual' }; }
}
function readLimitedBody(req, limit = 10_000) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0; let done = false;
    req.on('data', chunk => { size += chunk.length; if (size > limit) { done = true; reject(Object.assign(new Error('Nội dung vượt giới hạn.'), { status: 413 })); } else if (!done) chunks.push(chunk); });
    req.on('end', () => { if (done) return; try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { reject(Object.assign(new Error('Dữ liệu JSON không hợp lệ.'), { status: 400 })); } });
    req.on('error', error => { if (!done) reject(error); });
  });
}

module.exports = {
  handleRequest(req, res, url, user, { db, save, audit }) {
    if (!url.pathname.startsWith('/api/sprint5/')) return null;
    db.matchEvents ||= []; db.notifications ||= []; db.emailOutbox ||= [];
    if (req.method === 'GET' && url.pathname === '/api/sprint5/matches') {
      if (!user) return respond(res, 401, { error: 'Đăng nhập để xem gợi ý phù hợp.' });
      if (user.role === 'student') return respond(res, 200, { role: user.role, matches: studentMatches(db, user), profileComplete: Boolean(user.profile?.skills?.length && user.profile?.visibility === 'public') });
      if (user.role === 'employer') return respond(res, 200, { role: user.role, matches: employerMatches(db, user), hasCompany: Boolean(companyFor(db, user)) });
      return respond(res, 403, { error: 'Gợi ý phù hợp dành cho sinh viên và nhà tuyển dụng.' });
    }
    if (req.method === 'POST' && url.pathname === '/api/sprint5/chat') {
      let body = ''; let tooLarge = false;
      return new Promise(resolve => {
        req.on('data', chunk => { if (!tooLarge) { body += chunk; if (body.length > 8000) tooLarge = true; } });
        req.on('end', async () => {
        try {
          if (tooLarge) { respond(res, 413, { error: 'Tin nhắn vượt quá giới hạn.' }); return resolve(); }
          const input = JSON.parse(body || '{}'); const message = text(input.message, 1000);
          if (message.length < 2) { respond(res, 400, { error: 'Hãy nhập câu hỏi từ 2 ký tự trở lên.' }); return resolve(); }
          const accountConsent = user && [...(db.consents || [])].reverse().find(item => item.userId === user.id && item.purpose === 'ai_assistant_external' && item.version === 'sprint5-1.0')?.granted === true;
          const externalConsent = Boolean(input.externalConsent && (user ? accountConsent : true));
          const answer = await modelChatReply(db, user, message, externalConsent);
          audit?.(user?.id || null, 'ai.chat', 'homepage_assistant');
          respond(res, 200, answer); resolve();
        } catch { respond(res, 400, { error: 'Tin nhắn không hợp lệ.' }); resolve(); }
        });
      });
    }
    if (req.method === 'POST' && url.pathname === '/api/sprint5/assist') {
      if (!user || !['student', 'employer'].includes(user.role)) return respond(res, user ? 403 : 401, { error: 'Đăng nhập bằng tài khoản sinh viên hoặc nhà tuyển dụng để dùng công cụ AI.' });
      return readLimitedBody(req).then(async body => {
        const task = text(body.task, 40); const allowed = user.role === 'employer' ? ['job_description'] : ['cv_bullet', 'cv_summary'];
        if (!allowed.includes(task)) return respond(res, 400, { error: 'Tác vụ không dành cho vai trò tài khoản này.' });
        const input = {};
        for (const key of ['title', 'industry', 'level', 'responsibilities', 'existingDescription', 'requirements', 'skills', 'benefits', 'project', 'targetRole', 'actions', 'result', 'evidence']) input[key] = text(body[key], ['responsibilities', 'existingDescription', 'actions'].includes(key) ? 1800 : 600);
        if (task === 'job_description' && input.title.length < 4) return respond(res, 400, { error: 'Nhập chức danh từ 4 ký tự trở lên trước khi tạo gợi ý.' });
        if (task === 'job_description' && !input.responsibilities && !input.existingDescription && !input.requirements && !input.skills) return respond(res, 400, { error: 'Thêm ít nhất nhiệm vụ, kỹ năng hoặc mô tả cũ để bản nháp sát với công việc thật.' });
        if (['cv_bullet', 'cv_summary'].includes(task) && !input.targetRole && !input.project && !input.actions && !input.evidence) return respond(res, 400, { error: 'Nhập vị trí, dự án hoặc trải nghiệm để trợ lý có thông tin gợi ý.' });
        const accountConsent = [...(db.consents || [])].reverse().find(item => item.userId === user.id && item.purpose === 'ai_assistant_external' && item.version === 'sprint5-1.0')?.granted === true;
        const result = await generateDraft(db, user, task, input, Boolean(body.externalConsent && accountConsent));
        audit?.(user.id, `ai.${task}`, 'ai_assistant');
        respond(res, result.error ? 400 : 200, result);
      }).catch(error => respond(res, error.status || 400, { error: error.message || 'Không tạo được gợi ý.' }));
    }
    if (url.pathname === '/api/sprint5/consent' && req.method === 'POST') {
      if (!user) return respond(res, 401, { error: 'Đăng nhập để lưu lựa chọn xử lý dữ liệu AI.' });
      let body = ''; req.on('data', chunk => { body += chunk; });
      return new Promise(resolve => req.on('end', () => {
        try {
          const input = JSON.parse(body || '{}'); if (typeof input.granted !== 'boolean') { respond(res, 400, { error: 'Lựa chọn đồng ý không hợp lệ.' }); return resolve(); }
          db.consents ||= []; db.consents.push({ id: crypto.randomUUID(), userId: user.id, purpose: 'ai_assistant_external', granted: input.granted, version: 'sprint5-1.0', at: new Date().toISOString() }); save();
          audit?.(user.id, input.granted ? 'ai.external_consent.granted' : 'ai.external_consent.revoked', 'ai_assistant');
          respond(res, 200, { granted: input.granted }); resolve();
        } catch { respond(res, 400, { error: 'Dữ liệu đồng ý không hợp lệ.' }); resolve(); }
      }));
    }
    if (req.method === 'GET' && url.pathname === '/api/sprint5/status') {
      const consent = user && [...(db.consents || [])].reverse().find(item => item.userId === user.id && item.purpose === 'ai_assistant_external' && item.version === 'sprint5-1.0')?.granted === true;
      return respond(res, 200, { matching: 'active', assistant: 'contextual', generativeAvailable: Boolean(process.env.OPENAI_API_KEY), externalAiConsented: Boolean(consent), refreshSeconds: 60 });
    }
    return respond(res, 404, { error: 'Không tìm thấy endpoint Sprint 5.' });
  },
  syncNotifications,
  deleteUserData(db, user) {
    db.matchEvents ||= [];
    db.matchEvents = db.matchEvents.filter(item => item.userId !== user.id && !String(item.key || '').includes(user.id));
    db.consents = (db.consents || []).filter(item => !(item.userId === user.id && item.purpose === 'ai_assistant_external'));
  },
  startWorker({ db, save }) {
    // Establish a quiet baseline on first start so existing accounts are not spammed with historical matches.
    if (!db.matchBaselineAt) {
      syncNotifications(db, { baseline: true }); db.matchBaselineAt = new Date().toISOString(); save();
    }
    let busy = false;
    const run = () => {
      if (busy) return; busy = true;
      try { if (syncNotifications(db)) save(); } finally { busy = false; }
    };
    const timer = setInterval(run, 60_000); timer.unref();
    return () => clearInterval(timer);
  }
};
// Note: Sprint 5 update date 10/11/2026.
