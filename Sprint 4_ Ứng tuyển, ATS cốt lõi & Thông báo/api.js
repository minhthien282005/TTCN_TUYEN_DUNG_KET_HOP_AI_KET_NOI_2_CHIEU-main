'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_STAGES = [
  { key: 'submitted', label: 'Mới nộp' }, { key: 'viewed', label: 'Đã xem' },
  { key: 'screening', label: 'Sàng lọc' }, { key: 'interview', label: 'Phỏng vấn' },
  { key: 'offered', label: 'Đề nghị' }, { key: 'hired', label: 'Tuyển dụng' }
];
const REJECTION_REASONS = ['skills', 'experience', 'education', 'screening', 'position_filled', 'other'];
const REJECTION_LABELS = { skills: 'Thiếu một số kỹ năng bắt buộc.', experience: 'Kinh nghiệm chưa phù hợp với yêu cầu.', education: 'Trình độ hoặc chuyên ngành chưa phù hợp.', screening: 'Câu trả lời sàng lọc chưa đáp ứng tiêu chí.', position_filled: 'Vị trí đã tuyển đủ.', other: 'Nhà tuyển dụng đã từ chối hồ sơ.' };
const text = (value, max = 500) => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').trim().slice(0, max);
const normalize = value => text(value, 10000).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('vi').replace(/đ/g, 'd').replace(/[^a-z0-9+#.]+/g, ' ').trim();
const respond = (res, status, body) => { if (res.writableEnded) return; res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
const html = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const companyFor = (db, user) => db.companies.find(company => company.ownerId === user.id);
const stagesFor = company => Array.isArray(company?.applicationStages) && company.applicationStages.length === DEFAULT_STAGES.length ? company.applicationStages : DEFAULT_STAGES;
const stageLabel = (company, key) => stagesFor(company).find(item => item.key === key)?.label || (key === 'rejected' ? 'Từ chối' : key === 'withdrawn' ? 'Đã rút' : key);
const publicQuestions = questions => (questions || []).map(({ id, prompt, type, required, knockout, options }) => ({ id, prompt, type, required: Boolean(required), knockout: Boolean(knockout), options: options || [] }));
const liveJob = (db, id) => {
  const job = db.jobs.find(item => item.id === id && item.status === 'published' && (!item.expiresAt || Date.parse(item.expiresAt) > Date.now()));
  const company = job && db.companies.find(item => item.id === job.companyId && item.verificationStatus === 'verified');
  return job && company ? { job, company } : null;
};
function applicationScore(profile = {}, job = {}) {
  const profileSkills = new Set((profile.skills || []).map(normalize).filter(Boolean));
  const required = (job.skillCriteria || job.skills || []).filter(item => (item.importance || 'required') === 'required');
  const preferred = (job.skillCriteria || job.skills || []).filter(item => item.importance === 'preferred');
  if (!required.length && !preferred.length) return { score: 0, matchedSkills: [], missingSkills: [] };
  const matchedSkills = []; const missingSkills = [];
  let earned = 0; let possible = 0;
  for (const item of [...required, ...preferred]) {
    const skill = text(typeof item === 'string' ? item : item.skill, 80); const weight = Math.max(1, Math.min(100, Number(item.weight) || 1)) * (item.importance === 'preferred' ? 0.5 : 1);
    possible += weight;
    if (profileSkills.has(normalize(skill))) { earned += weight; matchedSkills.push(skill); }
    else if (item.importance !== 'preferred') missingSkills.push(skill);
  }
  return { score: Math.round(earned * 100 / possible), matchedSkills: matchedSkills.slice(0, 30), missingSkills: missingSkills.slice(0, 30) };
}
function stageLog(db, application, actorId, from, to, action, note = '') {
  db.applicationStageLogs.push({ id: crypto.randomUUID(), applicationId: application.id, actorId: actorId || null, from, to, action, note: text(note, 500), at: new Date().toISOString() });
}
function notify(db, userId, type, title, message, href, email = true) {
  if (!userId) return;
  const now = new Date().toISOString(); const notificationId = crypto.randomUUID();
  db.notifications.push({ id: notificationId, userId, type, title: text(title, 140), message: text(message, 500), href: text(href, 240), readAt: null, createdAt: now });
  if (email) db.emailOutbox.push({ id: crypto.randomUUID(), notificationId, userId, status: 'queued', attempts: 0, nextAttemptAt: now, createdAt: now, updatedAt: now });
}
function readJson(req, maxBytes = 100_000) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0; let settled = false;
    req.on('data', chunk => { size += chunk.length; if (size > maxBytes) { settled = true; reject(Object.assign(new Error('Dữ liệu gửi lên vượt giới hạn.'), { status: 413 })); } else chunks.push(chunk); });
    req.on('end', () => { if (settled) return; try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { reject(Object.assign(new Error('Dữ liệu JSON không hợp lệ.'), { status: 400 })); } });
    req.on('error', error => { if (!settled) reject(error); });
  });
}
function validateQuestions(value) {
  if (!Array.isArray(value) || value.length > 10) return { error: 'Mỗi tin có thể có tối đa 10 câu hỏi sàng lọc.' };
  const seen = new Set(); const questions = [];
  for (const item of value) {
    const prompt = text(item?.prompt, 300); const type = item?.type === 'single_choice' ? 'single_choice' : item?.type === 'boolean' ? 'boolean' : 'text';
    const options = type === 'single_choice' ? [...new Set((Array.isArray(item.options) ? item.options : []).map(option => text(option, 100)).filter(Boolean))].slice(0, 8) : type === 'boolean' ? ['Có', 'Không'] : [];
    if (prompt.length < 5 || (type === 'single_choice' && options.length < 2)) return { error: 'Câu hỏi cần ít nhất 5 ký tự; câu chọn đáp án cần tối thiểu 2 lựa chọn.' };
    const knockout = Boolean(item.knockout); const correctAnswer = text(item.correctAnswer, 100);
    if (knockout && (type === 'text' || !options.some(option => normalize(option) === normalize(correctAnswer)))) return { error: 'Câu loại trực tiếp cần đáp án đúng nằm trong các lựa chọn.' };
    let id = text(item.id, 60) || crypto.randomUUID(); if (seen.has(id)) id = crypto.randomUUID(); seen.add(id);
    questions.push({ id, prompt, type, required: item.required !== false, knockout, options, ...(knockout ? { correctAnswer } : {}) });
  }
  return { questions };
}
function publicApplication(application, db, { employer = false } = {}) {
  const job = db.jobs.find(item => item.id === application.jobId); const company = db.companies.find(item => item.id === job?.companyId);
  const student = db.users.find(item => item.id === application.studentId);
  const value = {
    id: application.id, jobId: application.jobId, jobTitle: job?.title || '', companyName: company?.name || '', status: application.status,
    statusLabel: stageLabel(company, application.status), score: application.score, matchedSkills: application.matchedSkills || [], missingSkills: application.missingSkills || [],
    createdAt: application.createdAt, updatedAt: application.updatedAt, version: application.version, withdrawnAt: application.withdrawnAt || null,
    rejectionReason: application.rejectionReason || '', rejectionNote: application.rejectionNote || '', stageLog: db.applicationStageLogs.filter(item => item.applicationId === application.id).map(item => ({ from: item.from, to: item.to, action: item.action, note: item.note, at: item.at }))
  };
  if (employer) {
    value.student = student ? { id: student.id, name: student.profile?.fullName || student.name, email: student.email, school: student.profile?.school || '', major: student.profile?.major || '', gradYear: student.profile?.gradYear || null, gpa: student.profile?.gpa || null, skills: student.profile?.skills || [] } : null;
    value.coverLetter = application.coverLetter || ''; value.screeningAnswers = application.answers || [];
    const cv = db.resumes.find(item => item.id === application.cvId && item.userId === application.studentId);
    value.cv = cv ? { id: cv.id, originalName: cv.originalName, mimeType: cv.mimeType, status: cv.status, href: `/api/sprint4/employer/applications/${encodeURIComponent(application.id)}/cv` } : null;
  }
  return value;
}

module.exports = {
  handleRequest: async (req, res, url, user, { db, save, audit, sendMail, dataDir }) => {
    if (!url.pathname.startsWith('/api/sprint4/')) return null;
    for (const key of ['applications', 'applicationStageLogs', 'applicationIdempotency', 'notifications', 'emailOutbox']) db[key] ||= [];
    db.resumes ||= []; db.jobs ||= []; db.companies ||= []; db.users ||= [];
    if (!user) return respond(res, 401, { error: 'Vui lòng đăng nhập để tiếp tục.' });
    const student = user.role === 'student'; const employer = user.role === 'employer'; const admin = user.role === 'admin';
    const read = async (limit = 100_000) => { try { return await readJson(req, limit); } catch (error) { respond(res, error.status || 400, { error: error.message }); return null; } };
    const pathname = url.pathname;

    const applyData = pathname.match(/^\/api\/sprint4\/jobs\/([\w-]+)\/apply-data$/);
    if (req.method === 'GET' && applyData) {
      if (!student) return respond(res, 403, { error: 'Chỉ sinh viên mới được nộp hồ sơ.' });
      const found = liveJob(db, applyData[1]); if (!found) return respond(res, 404, { error: 'Tin không còn nhận hồ sơ.' });
      const cvs = db.resumes.filter(item => item.userId === user.id && item.scanStatus === 'clean' && ['review', 'confirmed'].includes(item.status)).map(item => ({ id: item.id, originalName: item.originalName, status: item.status, isDefault: Boolean(item.isDefault), createdAt: item.createdAt }));
      const previous = db.applications.find(item => item.jobId === found.job.id && item.studentId === user.id);
      return respond(res, 200, { job: { id: found.job.id, title: found.job.title, company: found.company.name, location: found.job.location, type: found.job.type }, questions: publicQuestions(found.job.screeningQuestions), cvs, alreadyApplied: Boolean(previous) });
    }

    if (req.method === 'POST' && pathname === '/api/sprint4/student/applications') {
      if (!student) return respond(res, 403, { error: 'Chỉ sinh viên mới được nộp hồ sơ.' });
      const body = await read(60_000); if (!body) return;
      const jobId = text(body.jobId, 80); const found = liveJob(db, jobId); if (!found) return respond(res, 404, { error: 'Tin không còn nhận hồ sơ.' });
      const key = text(req.headers['idempotency-key'] || body.idempotencyKey, 120);
      if (key.length < 8) return respond(res, 400, { error: 'Thiếu Idempotency-Key hợp lệ để tránh nộp trùng.' });
      if (Array.isArray(body.answers) && body.answers.length > 10) return respond(res, 400, { error: 'Có tối đa 10 câu trả lời cho một tin.' });
      const canonicalRequest = JSON.stringify({ jobId, cvId: text(body.cvId, 80), coverLetter: text(body.coverLetter, 3000), portfolioLinks: Array.isArray(body.portfolioLinks) ? body.portfolioLinks.map(item => text(item, 500)).slice(0, 10) : [], answers: Array.isArray(body.answers) ? body.answers.slice(0, 10) : [] });
      const requestHash = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
      const previousKey = db.applicationIdempotency.find(item => item.studentId === user.id && item.key === key);
      if (previousKey) return previousKey.requestHash === requestHash ? respond(res, 200, { application: publicApplication(db.applications.find(item => item.id === previousKey.applicationId), db), idempotentReplay: true }) : respond(res, 409, { error: 'Idempotency-Key đã được dùng cho dữ liệu khác.' });
      if (db.applications.some(item => item.jobId === jobId && item.studentId === user.id)) return respond(res, 409, { error: 'Bạn đã nộp hồ sơ cho tin này rồi.' });
      const cvId = text(body.cvId, 80); const cv = db.resumes.find(item => item.id === cvId && item.userId === user.id && item.scanStatus === 'clean' && ['review', 'confirmed'].includes(item.status));
      if (!cv) return respond(res, 400, { error: 'Chọn CV đã được quét và xử lý thành công trước khi nộp.' });
      const coverLetter = text(body.coverLetter, 3000);
      const portfolioLinks = (Array.isArray(body.portfolioLinks) ? body.portfolioLinks : []).slice(0, 10).map(item => text(item, 500)).filter(item => /^https:\/\//i.test(item));
      const questionById = new Map((found.job.screeningQuestions || []).map(item => [item.id, item])); const inputAnswers = Array.isArray(body.answers) ? body.answers.filter(item => item && typeof item === 'object') : [];
      const answers = []; let knockout = false;
      for (const question of found.job.screeningQuestions || []) {
        const answer = inputAnswers.find(item => item.questionId === question.id); const value = text(answer?.value, 1000);
        if (question.required && !value) return respond(res, 400, { error: `Vui lòng trả lời câu hỏi: ${question.prompt}` });
        if (value && question.type === 'single_choice' && !(question.options || []).some(option => normalize(option) === normalize(value))) return respond(res, 400, { error: 'Câu trả lời không nằm trong danh sách lựa chọn.' });
        if (value && question.type === 'boolean' && !['có', 'không', 'yes', 'no'].includes(normalize(value))) return respond(res, 400, { error: 'Câu trả lời Có/Không không hợp lệ.' });
        if (question.knockout && value && normalize(value) !== normalize(question.correctAnswer)) knockout = true;
        answers.push({ questionId: question.id, prompt: question.prompt, value });
      }
      if (inputAnswers.some(item => !questionById.has(item.questionId))) return respond(res, 400, { error: 'Có câu trả lời không thuộc bộ câu hỏi của tin.' });
      const score = applicationScore(user.profile || {}, found.job); const now = new Date().toISOString(); const application = {
        id: crypto.randomUUID(), jobId, companyId: found.company.id, studentId: user.id, cvId, coverLetter, portfolioLinks, answers,
        status: knockout ? 'rejected' : 'submitted', rejectionReason: knockout ? 'screening' : '', rejectionNote: knockout ? 'Câu trả lời chưa đáp ứng tiêu chí bắt buộc của tin.' : '',
        score: score.score, matchedSkills: score.matchedSkills, missingSkills: score.missingSkills, version: 1, createdAt: now, updatedAt: now, withdrawnAt: null
      };
      db.applications.push(application); db.applicationIdempotency.push({ id: crypto.randomUUID(), studentId: user.id, key, requestHash, applicationId: application.id, createdAt: now });
      stageLog(db, application, user.id, null, application.status, knockout ? 'screening_auto_reject' : 'submitted', application.rejectionNote);
      audit(user.id, 'application.submit', application.id);
      const owner = db.users.find(item => item.id === found.company.ownerId && !item.deletedAt);
      if (knockout) notify(db, user.id, 'application.rejected', 'Hồ sơ chưa qua câu hỏi bắt buộc', application.rejectionNote, '/applications.html');
      else {
        notify(db, user.id, 'application.received', 'Đã nhận hồ sơ ứng tuyển', `Hồ sơ của bạn cho vị trí ${found.job.title} đã được gửi.`, '/applications.html');
        notify(db, owner?.id, 'application.new', 'Có hồ sơ ứng tuyển mới', `Có ứng viên mới cho vị trí ${found.job.title}.`, '/ats.html?job=' + encodeURIComponent(jobId));
      }
      save(); return respond(res, 201, { application: publicApplication(application, db) });
    }

    if (req.method === 'GET' && pathname === '/api/sprint4/student/applications') {
      if (!student) return respond(res, 403, { error: 'Chỉ sinh viên mới xem được hồ sơ ứng tuyển của mình.' });
      return respond(res, 200, { applications: db.applications.filter(item => item.studentId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(item => publicApplication(item, db)) });
    }
    const withdraw = pathname.match(/^\/api\/sprint4\/student\/applications\/([\w-]+)\/withdraw$/);
    if (req.method === 'POST' && withdraw) {
      if (!student) return respond(res, 403, { error: 'Chỉ sinh viên mới rút được hồ sơ.' });
      const application = db.applications.find(item => item.id === withdraw[1] && item.studentId === user.id); if (!application) return respond(res, 404, { error: 'Không tìm thấy hồ sơ ứng tuyển.' });
      if (!['submitted', 'viewed', 'screening', 'interview'].includes(application.status)) return respond(res, 409, { error: 'Không thể rút hồ sơ sau khi đã nhận đề nghị hoặc hồ sơ đã kết thúc.' });
      const body = await read(20_000); if (!body) return; const reason = text(body.reason, 500);
      if (reason.length < 5) return respond(res, 400, { error: 'Vui lòng ghi lý do rút (ít nhất 5 ký tự).' });
      const from = application.status; application.status = 'withdrawn'; application.withdrawReason = reason; application.withdrawnAt = new Date().toISOString(); application.updatedAt = application.withdrawnAt; application.version += 1;
      stageLog(db, application, user.id, from, 'withdrawn', 'student_withdraw', reason); audit(user.id, 'application.withdraw', application.id);
      const job = db.jobs.find(item => item.id === application.jobId); const company = db.companies.find(item => item.id === application.companyId);
      notify(db, company?.ownerId, 'application.withdrawn', 'Ứng viên đã rút hồ sơ', `Ứng viên đã rút hồ sơ cho vị trí ${job?.title || ''}.`, '/ats.html?job=' + encodeURIComponent(application.jobId));
      save(); return respond(res, 200, { application: publicApplication(application, db) });
    }

    if (req.method === 'GET' && pathname === '/api/sprint4/notifications') {
      const values = db.notifications.filter(item => item.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100);
      return respond(res, 200, { notifications: values, unread: values.filter(item => !item.readAt).length });
    }
    const readNotification = pathname.match(/^\/api\/sprint4\/notifications\/([\w-]+)\/read$/);
    if (req.method === 'POST' && readNotification) {
      const notification = db.notifications.find(item => item.id === readNotification[1] && item.userId === user.id); if (!notification) return respond(res, 404, { error: 'Không tìm thấy thông báo.' });
      notification.readAt ||= new Date().toISOString(); save(); return respond(res, 200, { notification });
    }
    if (req.method === 'POST' && pathname === '/api/sprint4/notifications/read-all') {
      const now = new Date().toISOString(); for (const notification of db.notifications) if (notification.userId === user.id && !notification.readAt) notification.readAt = now;
      save(); return respond(res, 200, { message: 'Đã đánh dấu đã đọc.' });
    }

    if (req.method === 'GET' && pathname === '/api/sprint4/employer/jobs') {
      if (!employer) return respond(res, 403, { error: 'Khu vực ATS dành cho nhà tuyển dụng.' });
      const company = companyFor(db, user); const jobs = db.jobs.filter(item => item.companyId === company?.id && ['published', 'paused', 'closed', 'expired'].includes(item.status)).map(job => ({ id: job.id, title: job.title, status: job.status, applicationCount: db.applications.filter(item => item.jobId === job.id && !['withdrawn'].includes(item.status)).length }));
      return respond(res, 200, { jobs, stages: stagesFor(company) });
    }
    const screeningRoute = pathname.match(/^\/api\/sprint4\/employer\/jobs\/([\w-]+)\/screening$/);
    if (screeningRoute && ['GET', 'PUT'].includes(req.method)) {
      if (!employer) return respond(res, 403, { error: 'Khu vực ATS dành cho nhà tuyển dụng.' });
      const company = companyFor(db, user); const job = db.jobs.find(item => item.id === screeningRoute[1] && item.companyId === company?.id); if (!job) return respond(res, 404, { error: 'Không tìm thấy tin của doanh nghiệp.' });
      if (req.method === 'GET') return respond(res, 200, { questions: publicQuestions(job.screeningQuestions), configured: (job.screeningQuestions || []).map(item => ({ ...item })) });
      const body = await read(30_000); if (!body) return; const validated = validateQuestions(body.questions);
      if (validated.error) return respond(res, 400, { error: validated.error });
      job.screeningQuestions = validated.questions; job.updatedAt = new Date().toISOString(); audit(user.id, 'application.screening_questions.update', job.id); save();
      return respond(res, 200, { questions: job.screeningQuestions });
    }
    if (req.method === 'GET' && pathname === '/api/sprint4/employer/pipeline') {
      if (!employer) return respond(res, 403, { error: 'Khu vực ATS dành cho nhà tuyển dụng.' });
      return respond(res, 200, { stages: stagesFor(companyFor(db, user)) });
    }
    if (req.method === 'PUT' && pathname === '/api/sprint4/employer/pipeline') {
      if (!employer) return respond(res, 403, { error: 'Khu vực ATS dành cho nhà tuyển dụng.' });
      const company = companyFor(db, user); if (!company) return respond(res, 409, { error: 'Hãy tạo hồ sơ doanh nghiệp trước.' });
      const body = await read(20_000); if (!body) return; const items = Array.isArray(body.stages) ? body.stages : [];
      if (items.length !== DEFAULT_STAGES.length || new Set(items.map(item => item.key)).size !== DEFAULT_STAGES.length || DEFAULT_STAGES.some(stage => !items.some(item => item.key === stage.key))) return respond(res, 400, { error: 'Pipeline cần đủ 6 giai đoạn chuẩn, mỗi giai đoạn một lần.' });
      const stages = items.map(item => ({ key: text(item.key, 30), label: text(item.label, 32) }));
      if (stages.some(item => item.label.length < 2)) return respond(res, 400, { error: 'Tên giai đoạn cần từ 2 đến 32 ký tự.' });
      company.applicationStages = stages; audit(user.id, 'application.pipeline.update', company.id); save(); return respond(res, 200, { stages });
    }
    if (req.method === 'GET' && pathname === '/api/sprint4/employer/applications') {
      if (!employer) return respond(res, 403, { error: 'Khu vực ATS dành cho nhà tuyển dụng.' });
      const company = companyFor(db, user); if (!company) return respond(res, 409, { error: 'Hồ sơ doanh nghiệp chưa được tạo.' });
      const jobId = text(url.searchParams.get('jobId'), 80); const stage = text(url.searchParams.get('stage'), 30); const q = normalize(url.searchParams.get('q'));
      const minScore = Math.max(0, Math.min(100, Number(url.searchParams.get('minScore')) || 0)); const minGpa = Math.max(0, Math.min(4, Number(url.searchParams.get('minGpa')) || 0));
      const skill = normalize(url.searchParams.get('skill')); const school = normalize(url.searchParams.get('school'));
      const after = Date.parse(url.searchParams.get('after') || '') || 0; const before = Date.parse(url.searchParams.get('before') || '') || Number.MAX_SAFE_INTEGER;
      const jobs = db.jobs.filter(item => item.companyId === company.id && (!jobId || item.id === jobId)); const allowedJobs = new Set(jobs.map(item => item.id));
      let applications = db.applications.filter(item => {
        if (!allowedJobs.has(item.jobId) || (stage && item.status !== stage) || item.score < minScore || Date.parse(item.createdAt) < after || Date.parse(item.createdAt) > before) return false;
        const profile = db.users.find(account => account.id === item.studentId)?.profile || {};
        if (minGpa && Number(profile.gpa || 0) < minGpa) return false;
        if (school && !normalize(profile.school).includes(school)) return false;
        if (skill && !(profile.skills || []).some(value => normalize(value).includes(skill))) return false;
        return true;
      });
      if (q) applications = applications.filter(item => { const candidate = db.users.find(account => account.id === item.studentId); return normalize(`${candidate?.name || ''} ${candidate?.profile?.fullName || ''} ${candidate?.email || ''} ${candidate?.profile?.skills?.join(' ') || ''}`).includes(q); });
      applications.sort((a, b) => b.score - a.score || b.createdAt.localeCompare(a.createdAt));
      return respond(res, 200, { applications: applications.slice(0, 200).map(item => publicApplication(item, db, { employer: true })), total: applications.length, jobs: jobs.map(item => ({ id: item.id, title: item.title })), stages: stagesFor(company) });
    }
    const employerApplication = pathname.match(/^\/api\/sprint4\/employer\/applications\/([\w-]+)$/);
    if (employerApplication && req.method === 'GET') {
      if (!employer) return respond(res, 403, { error: 'Khu vực ATS dành cho nhà tuyển dụng.' });
      const app = db.applications.find(item => item.id === employerApplication[1]); const company = companyFor(db, user);
      if (!app || app.companyId !== company?.id) return respond(res, 404, { error: 'Không tìm thấy hồ sơ ứng tuyển.' });
      if (app.status === 'submitted') { app.status = 'viewed'; app.version += 1; app.updatedAt = new Date().toISOString(); stageLog(db, app, user.id, 'submitted', 'viewed', 'employer_view'); notify(db, app.studentId, 'application.viewed', 'Nhà tuyển dụng đã xem hồ sơ', `Hồ sơ của bạn cho vị trí ${db.jobs.find(item => item.id === app.jobId)?.title || ''} đã được xem.`, '/applications.html'); audit(user.id, 'application.view', app.id); save(); }
      return respond(res, 200, { application: publicApplication(app, db, { employer: true }), stages: stagesFor(company) });
    }
    const cvRoute = pathname.match(/^\/api\/sprint4\/employer\/applications\/([\w-]+)\/cv$/);
    if (cvRoute && req.method === 'GET') {
      if (!employer) return respond(res, 403, { error: 'Khu vực ATS dành cho nhà tuyển dụng.' });
      const app = db.applications.find(item => item.id === cvRoute[1]); const company = companyFor(db, user);
      const cv = app && app.companyId === company?.id && db.resumes.find(item => item.id === app.cvId && item.userId === app.studentId && item.scanStatus === 'clean');
      if (!cv || !/^[\da-f-]{36}\.(?:pdf|docx)$/.test(cv.storageName)) return respond(res, 404, { error: 'Không tìm thấy CV đã quét.' });
      const filePath = path.join(dataDir || path.resolve(__dirname, '..', '..', 'data'), 'cv-files', cv.storageName);
      if (!fs.existsSync(filePath)) return respond(res, 404, { error: 'Tệp CV không còn trên máy chủ.' });
      res.writeHead(200, { 'Content-Type': cv.mimeType === 'application/pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': `inline; filename="${cv.id}${path.extname(cv.storageName)}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'self'" });
      fs.createReadStream(filePath).pipe(res); audit(user.id, 'application.cv.view', app.id); save(); return;
    }
    const stageRoute = pathname.match(/^\/api\/sprint4\/employer\/applications\/([\w-]+)\/stage$/);
    if (stageRoute && req.method === 'PATCH') {
      if (!employer) return respond(res, 403, { error: 'Khu vực ATS dành cho nhà tuyển dụng.' });
      const app = db.applications.find(item => item.id === stageRoute[1]); const company = companyFor(db, user);
      if (!app || app.companyId !== company?.id) return respond(res, 404, { error: 'Không tìm thấy hồ sơ ứng tuyển.' });
      const body = await read(20_000); if (!body) return;
      if (!Number.isInteger(body.expectedVersion)) return respond(res, 400, { error: 'Thiếu phiên bản hồ sơ để khóa lạc quan.' });
      if (body.expectedVersion !== app.version) return respond(res, 409, { error: 'Hồ sơ đã được cập nhật bởi người khác. Tải lại trước khi thao tác.', version: app.version });
      if (['rejected', 'withdrawn', 'hired'].includes(app.status)) return respond(res, 409, { error: 'Hồ sơ đã ở trạng thái kết thúc.' });
      const next = text(body.status, 30); const from = app.status; const configured = stagesFor(company); const fromIndex = configured.findIndex(item => item.key === from); const nextIndex = configured.findIndex(item => item.key === next);
      let action = 'stage_change'; let note = '';
      if (next === 'rejected') {
        const reason = text(body.reason, 40); note = text(body.note, 500);
        if (!REJECTION_REASONS.includes(reason)) return respond(res, 400, { error: 'Chọn một lý do từ chối hợp lệ.' });
        if (reason === 'other' && note.length < 5) return respond(res, 400, { error: 'Ghi lý do cụ thể (ít nhất 5 ký tự).' });
        app.rejectionReason = reason; app.rejectionNote = note || REJECTION_LABELS[reason]; note = `${REJECTION_LABELS[reason]}${note ? ` ${note}` : ''}`; action = 'employer_reject';
      } else if (nextIndex < 0 || nextIndex <= fromIndex) return respond(res, 400, { error: 'Chỉ được chuyển hồ sơ tiến về giai đoạn sau trong pipeline.' });
      const now = new Date().toISOString(); app.status = next; app.version += 1; app.updatedAt = now;
      stageLog(db, app, user.id, from, next, action, note); audit(user.id, `application.${action}`, app.id);
      const job = db.jobs.find(item => item.id === app.jobId); const title = job?.title || 'vị trí tuyển dụng';
      notify(db, app.studentId, next === 'rejected' ? 'application.rejected' : 'application.stage_changed', next === 'rejected' ? 'Cập nhật kết quả ứng tuyển' : 'Hồ sơ ứng tuyển có cập nhật', next === 'rejected' ? `Hồ sơ cho vị trí ${title} đã được cập nhật. ${app.rejectionNote}` : `Hồ sơ của bạn cho vị trí ${title} đã chuyển sang ${stageLabel(company, next)}.`, '/applications.html');
      save(); return respond(res, 200, { application: publicApplication(app, db) });
    }
    if (admin) return respond(res, 403, { error: 'Sprint 4 không có thao tác admin trong endpoint này.' });
    return respond(res, 404, { error: 'Không tìm thấy endpoint Sprint 4.' });
  },
  startWorker({ db, save, sendMail }) {
    db.notifications ||= []; db.emailOutbox ||= []; let running = false;
    for (const item of db.emailOutbox) if (item.status === 'processing') { item.status = item.attempts < 3 ? 'retry_wait' : 'failed'; item.nextAttemptAt = new Date().toISOString(); }
    save();
    const processNext = async () => {
      if (running) return; const item = db.emailOutbox.find(entry => ['queued', 'retry_wait'].includes(entry.status) && entry.attempts < 3 && Date.parse(entry.nextAttemptAt || 0) <= Date.now());
      if (!item) return; running = true; item.status = 'processing'; item.attempts += 1; item.updatedAt = new Date().toISOString(); save();
      try {
        const notification = db.notifications.find(value => value.id === item.notificationId); const account = db.users.find(value => value.id === item.userId && !value.deletedAt);
        if (!notification || !account?.email) item.status = 'skipped';
        else {
          const sent = await sendMail(account.email, notification.title, `<p>${html(notification.message)}</p><p><a href="${html(notification.href || '/notifications.html')}">Mở Ketnoi</a></p>`);
          item.status = sent ? 'sent' : 'skipped'; item.sentAt = sent ? new Date().toISOString() : null;
        }
        item.error = ''; item.updatedAt = new Date().toISOString(); save();
      } catch (error) {
        item.error = text(error.message, 240); item.status = item.attempts < 3 ? 'retry_wait' : 'failed';
        if (item.status === 'retry_wait') item.nextAttemptAt = new Date(Date.now() + item.attempts * 5000).toISOString();
        item.updatedAt = new Date().toISOString(); save();
      } finally { running = false; }
    };
    const timer = setInterval(processNext, 1000); timer.unref(); processNext(); return () => clearInterval(timer);
  },
  deleteUserData(db, user) {
    for (const key of ['applications', 'applicationStageLogs', 'applicationIdempotency', 'notifications', 'emailOutbox']) db[key] ||= [];
    if (user.role === 'student') {
      const ids = new Set(db.applications.filter(item => item.studentId === user.id).map(item => item.id));
      db.applications = db.applications.filter(item => item.studentId !== user.id);
      db.applicationStageLogs = db.applicationStageLogs.filter(item => !ids.has(item.applicationId));
      db.applicationIdempotency = db.applicationIdempotency.filter(item => item.studentId !== user.id);
    }
    const notificationIds = new Set(db.notifications.filter(item => item.userId === user.id).map(item => item.id));
    db.notifications = db.notifications.filter(item => item.userId !== user.id);
    db.emailOutbox = db.emailOutbox.filter(item => item.userId !== user.id && !notificationIds.has(item.notificationId));
  },
  DEFAULT_STAGES,
  applicationScore
};
