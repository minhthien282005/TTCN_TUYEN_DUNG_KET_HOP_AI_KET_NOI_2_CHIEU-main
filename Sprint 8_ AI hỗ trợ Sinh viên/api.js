'use strict';

const crypto = require('node:crypto');
const { activeApplicationCounts, hasOpenPositions } = require('../Sprint 2_ Doanh nghiệp, Tin tuyển dụng, Tìm kiếm & Kiểm duyệt/job-capacity');
const clean = (value, max = 500) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const norm = value => clean(value, 1000).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9+#.]+/g, ' ').trim();
const send = (res, status, body) => { if (!res.writableEnded) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); } };
const read = req => new Promise((resolve, reject) => {
  let raw = ''; req.on('data', chunk => { raw += chunk; if (raw.length > 12_000) reject(Object.assign(new Error('Nội dung vượt quá giới hạn.'), { status: 413 })); });
  req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { reject(Object.assign(new Error('Dữ liệu JSON không hợp lệ.'), { status: 400 })); } }); req.on('error', reject);
});
const skillsOf = profile => (Array.isArray(profile?.skills) ? profile.skills : []).map(value => typeof value === 'string' ? value : value?.name || value?.skill || '').filter(Boolean);
const allStudentSkills = (db, user) => [...new Set([...skillsOf(user.profile), ...(db.resumes || []).filter(cv => cv.userId === user.id && cv.scanStatus === 'clean' && ['review', 'confirmed'].includes(cv.status)).flatMap(cv => cv.parseResult?.fields?.skills?.value || []).map(value => typeof value === 'string' ? value : value?.name || value?.skill || '').filter(Boolean)])];
const studentOnly = (res, user) => user ? (user.role === 'student' ? true : (send(res, 403, { error: 'Trợ lý Sprint 8 dành cho tài khoản sinh viên.' }), false)) : (send(res, 401, { error: 'Đăng nhập bằng tài khoản sinh viên để tiếp tục.' }), false);

function targetJobs(db, user) {
  const applicationCounts = activeApplicationCounts(db);
  return (db.jobs || []).filter(job => job.status === 'published' && hasOpenPositions(db, job, applicationCounts) && (!job.expiresAt || Date.parse(job.expiresAt) > Date.now()) && (db.companies || []).some(company => company.id === job.companyId && company.verificationStatus === 'verified'))
    .map(job => {
      const required = (job.skillCriteria || job.skills || []).map(item => typeof item === 'string' ? item : item.skill || item.name || '').filter(Boolean);
      const known = new Set(allStudentSkills(db, user).map(norm));
      const missing = required.filter(skill => !known.has(norm(skill)));
      const roleText = norm(`${job.title} ${job.industry || ''}`); const roleFit = (user.profile?.desiredRoles || []).some(role => roleText.includes(norm(role)) || norm(role).includes(roleText));
      return { id: job.id, title: job.title, company: db.companies.find(item => item.id === job.companyId)?.name || '', requiredSkills: required, missingSkills: missing, fit: Math.max(0, Math.min(100, Math.round((required.length ? (required.length - missing.length) / required.length * 75 : 40) + (roleFit ? 25 : 0)))) };
    }).sort((a, b) => b.fit - a.fit).slice(0, 20);
}

function buildRoadmap(user, job, db) {
  const profile = user.profile || {}; const current = allStudentSkills(db, user); const jobSkills = job?.requiredSkills || [];
  const topMissing = jobSkills.filter(skill => !current.some(item => norm(item) === norm(skill))).slice(0, 6);
  const evidence = [...(profile.projects || []), ...(profile.experiences || [])];
  const target = job?.title || (profile.desiredRoles || [])[0] || profile.major || 'Vị trí phù hợp với hồ sơ';
  const suggestedSkills = topMissing.length ? topMissing : ['Kỹ năng chuyên môn cho vị trí mục tiêu', 'Giao tiếp và trình bày kết quả'];
  const phases = [
    { week: 'Tuần 1', title: 'Xác định khoảng trống', tasks: [`Đối chiếu yêu cầu của ${target} với kỹ năng hiện có.`, `Chọn tối đa 2 kỹ năng ưu tiên: ${suggestedSkills.slice(0, 2).join(', ')}.`, 'Đặt mục tiêu học tập cụ thể và lịch luyện tập 4 buổi mỗi tuần.'] },
    { week: 'Tuần 2–3', title: 'Học và luyện tập có sản phẩm', tasks: suggestedSkills.slice(0, 3).map(skill => `Học nền tảng ${skill}, thực hành qua bài tập nhỏ và ghi lại nguồn học.`) },
    { week: 'Tuần 4', title: 'Tạo bằng chứng năng lực', tasks: [evidence.length ? 'Chọn một dự án/kinh nghiệm hiện có, bổ sung vai trò, công cụ và kết quả đo được.' : 'Hoàn thành một dự án nhỏ thể hiện kỹ năng đã học.', 'Cập nhật CV và hồ sơ bằng kết quả thật; không thêm kỹ năng chưa sử dụng.', 'Xem lại công việc mục tiêu và điều chỉnh ưu tiên dựa trên yêu cầu tuyển dụng.'] }
  ];
  return { target, jobId: job?.id || null, jobTitle: job?.title || '', currentSkills: current.slice(0, 20), skillGaps: topMissing, profileReadiness: { hasSkills: current.length > 0, hasEvidence: evidence.length > 0, hasPortfolio: Boolean((profile.externalLinks || []).length || (profile.projects || []).some(item => item.url || item.link)) }, phases, generatedAt: new Date().toISOString(), mode: 'personalized-rules' };
}

function questionsFor(job) {
  const skills = job?.requiredSkills || [];
  const technical = skills.slice(0, 4).map(skill => ({ category: 'Chuyên môn', prompt: `Hãy kể về một lần bạn sử dụng ${skill} để giải quyết một vấn đề cụ thể. Bạn đã làm gì và kết quả ra sao?`, skill }));
  return [...technical, { category: 'Hành vi', prompt: 'Hãy kể về một thử thách trong học tập hoặc dự án nhóm. Mục tiêu, hành động của bạn và kết quả là gì?' }, { category: 'Động lực', prompt: `Vì sao bạn quan tâm đến vị trí ${job?.title || 'mục tiêu'} và bạn muốn học thêm điều gì?` }].slice(0, 6);
}

function feedback(answer, question) {
  const text = clean(answer, 3000); const words = text.split(/\s+/).filter(Boolean); const normalized = ` ${norm(text)} `; const numbers = /\d+(?:[.,]\d+)?%?/.test(text);
  const hasPhrase = terms => terms.some(term => normalized.includes(` ${term} `));
  const action = hasPhrase(['toi', 'minh', 'da', 'xay', 'thiet ke', 'phan tich', 'trien khai', 'viet', 'toi uu', 'phoi hop', 'hoan thanh', 'giam', 'tang', 'tao']);
  const outcome = hasPhrase(['ket qua', 'giup', 'dat', 'tang', 'giam', 'hoan thanh', 'tiet kiem', 'cai thien', 'users', 'nguoi dung']) || numbers;
  const rating = Math.max(1, Math.min(5, 1 + Number(words.length >= 35) + Number(action) + Number(outcome) + Number(numbers)));
  const suggestions = [];
  if (words.length < 35) suggestions.push('Bổ sung bối cảnh và nhiệm vụ cụ thể; câu trả lời hiện còn ngắn.');
  if (!action) suggestions.push('Nêu rõ phần việc do chính bạn thực hiện bằng động từ hành động.');
  if (!outcome) suggestions.push('Kết thúc bằng kết quả hoặc điều bạn rút ra.');
  if (!numbers) suggestions.push('Nếu có dữ liệu đáng tin cậy, thêm con số để thể hiện quy mô/kết quả.');
  if (!suggestions.length) suggestions.push('Cấu trúc đã có hành động và kết quả; luyện nói gọn trong 60–90 giây, giữ đúng sự thật.');
  return { rating, wordCount: words.length, strengths: [action && 'Đã nêu hành động cá nhân.', outcome && 'Đã đề cập kết quả.'].filter(Boolean), suggestions, framework: 'STAR: Tình huống – Nhiệm vụ – Hành động – Kết quả', questionCategory: question.category };
}

async function modelFeedback(answer, question, user, db) {
  const consent = [...(db.consents || [])].reverse().find(item => item.userId === user.id && item.purpose === 'ai_assistant_external' && item.version === 'sprint5-1.0')?.granted === true;
  if (!process.env.OPENAI_API_KEY || !consent) return null;
  try {
    const response = await fetch(process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions', { method: 'POST', signal: AbortSignal.timeout(9000), headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', temperature: 0.25, max_tokens: 280, messages: [{ role: 'system', content: 'Bạn là huấn luyện viên phỏng vấn cho sinh viên Việt Nam. Chỉ góp ý câu trả lời, không bịa thành tích. Trả lời tiếng Việt, tối đa 4 gạch đầu dòng: điểm tốt, điểm thiếu theo STAR, một cách cải thiện cụ thể. Không lặp lại dữ liệu cá nhân không cần thiết.' }, { role: 'user', content: JSON.stringify({ question: question.prompt, answer: clean(answer, 3000) }) }] }) });
    if (!response.ok) return null;
    const data = await response.json(); const suggestion = clean(data.choices?.[0]?.message?.content, 1400);
    return suggestion ? { suggestion, mode: 'generative' } : null;
  } catch { return null; }
}

module.exports = {
  async handleRequest(req, res, url, user, { db, save, audit }) {
    if (!url.pathname.startsWith('/api/sprint8/')) return null;
    db.sprint8PracticeSessions ||= []; db.sprint8Roadmaps ||= []; db.jobs ||= []; db.companies ||= [];
    if (!studentOnly(res, user)) return;
    const path = url.pathname;
    if (req.method === 'GET' && path === '/api/sprint8/coach') {
      const jobs = targetJobs(db, user);
      return send(res, 200, { jobs, skills: allStudentSkills(db, user), roadmap: db.sprint8Roadmaps.filter(item => item.userId === user.id).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0]?.roadmap || null, sessions: db.sprint8PracticeSessions.filter(item => item.userId === user.id).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 10).map(item => ({ id: item.id, target: item.target, status: item.status, score: item.score, updatedAt: item.updatedAt })) });
    }
    if (req.method === 'POST' && path === '/api/sprint8/roadmap') {
      let body; try { body = await read(req); } catch (error) { return send(res, error.status || 400, { error: error.message }); }
      const job = body.jobId ? targetJobs(db, user).find(item => item.id === clean(body.jobId, 80)) : null;
      if (body.jobId && !job) return send(res, 404, { error: 'Công việc không còn công khai hoặc không tồn tại.' });
      const roadmap = buildRoadmap(user, job, db); const prior = db.sprint8Roadmaps.find(item => item.userId === user.id && item.roadmap.jobId === roadmap.jobId);
      if (prior) { prior.roadmap = roadmap; prior.updatedAt = roadmap.generatedAt; }
      else db.sprint8Roadmaps.push({ id: crypto.randomUUID(), userId: user.id, roadmap, createdAt: roadmap.generatedAt, updatedAt: roadmap.generatedAt });
      audit?.(user.id, 'sprint8.roadmap.generate', roadmap.jobId || 'career'); save(); return send(res, 200, { roadmap });
    }
    if (req.method === 'POST' && path === '/api/sprint8/interviews') {
      let body; try { body = await read(req); } catch (error) { return send(res, error.status || 400, { error: error.message }); }
      const job = body.jobId ? targetJobs(db, user).find(item => item.id === clean(body.jobId, 80)) : null;
      if (body.jobId && !job) return send(res, 404, { error: 'Công việc không còn công khai hoặc không tồn tại.' });
      const session = { id: crypto.randomUUID(), userId: user.id, jobId: job?.id || null, target: clean(job?.title || body.target || (user.profile?.desiredRoles || [])[0] || 'Phỏng vấn thực tập', 120), questions: questionsFor(job), answers: [], status: 'in_progress', score: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      db.sprint8PracticeSessions.push(session); audit?.(user.id, 'sprint8.practice.start', session.id); save(); return send(res, 201, { session });
    }
    const answerRoute = path.match(/^\/api\/sprint8\/interviews\/([\da-f-]+)\/answer$/);
    if (answerRoute && req.method === 'POST') {
      const session = db.sprint8PracticeSessions.find(item => item.id === answerRoute[1] && item.userId === user.id);
      if (!session) return send(res, 404, { error: 'Không tìm thấy buổi luyện tập.' });
      if (session.status !== 'in_progress') return send(res, 409, { error: 'Buổi luyện tập đã hoàn tất.' });
      let body; try { body = await read(req); } catch (error) { return send(res, error.status || 400, { error: error.message }); }
      const answer = clean(body.answer, 3000); const questionIndex = Number(body.questionIndex);
      if (!answer || answer.length < 12) return send(res, 400, { error: 'Hãy viết câu trả lời ít nhất 12 ký tự.' });
      if (!Number.isInteger(questionIndex) || questionIndex !== session.answers.length || questionIndex >= session.questions.length) return send(res, 409, { error: 'Câu hỏi đã thay đổi. Tải lại buổi luyện tập.' });
      const question = session.questions[questionIndex]; const result = feedback(answer, question); const model = await modelFeedback(answer, question, user, db);
      session.answers.push({ questionIndex, answer, feedback: result, createdAt: new Date().toISOString() }); session.score = Math.round(session.answers.reduce((sum, item) => sum + item.feedback.rating, 0) / session.answers.length * 20); session.updatedAt = new Date().toISOString();
      if (session.answers.length >= session.questions.length) session.status = 'completed';
      audit?.(user.id, 'sprint8.practice.answer', session.id); save(); return send(res, 200, { result: { ...result, ...(model || {}) }, session: { id: session.id, status: session.status, score: session.score, answered: session.answers.length, total: session.questions.length, nextQuestion: session.questions[session.answers.length] || null } });
    }
    const sessionRoute = path.match(/^\/api\/sprint8\/interviews\/([\da-f-]+)$/);
    if (sessionRoute && req.method === 'GET') {
      const session = db.sprint8PracticeSessions.find(item => item.id === sessionRoute[1] && item.userId === user.id);
      return session ? send(res, 200, { session }) : send(res, 404, { error: 'Không tìm thấy buổi luyện tập.' });
    }
    return send(res, 404, { error: 'Không tìm thấy endpoint Sprint 8.' });
  },
  deleteUserData(db, user) {
    db.sprint8PracticeSessions = (db.sprint8PracticeSessions || []).filter(item => item.userId !== user.id);
    db.sprint8Roadmaps = (db.sprint8Roadmaps || []).filter(item => item.userId !== user.id);
  }
};
