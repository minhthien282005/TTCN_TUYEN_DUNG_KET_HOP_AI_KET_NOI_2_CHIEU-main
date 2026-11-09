const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createServer: createTcpServer } = require('node:net');

const root = path.resolve(__dirname, '../..');
const serverFile = path.join(root, 'Sprint 1_ Tài khoản, Phân quyền & Hồ sơ Sinh viên', 'server.js');
const password = 'Sprint4-Test-Password!';
let dataDir; let baseUrl; let child;

function account(role, name, email, skills = ['React', 'JavaScript']) {
  const id = crypto.randomUUID(); const salt = crypto.randomBytes(16).toString('hex');
  return { id, role, name, email, passwordHash: `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`, verified: true, createdAt: new Date().toISOString(), profile: { fullName: name, visibility: 'private', school: 'Hanoi University', major: 'Computer Science', gradYear: 2027, gpa: 3.5, skills, education: [], experiences: [], projects: [], languages: [], desiredRoles: [], jobTypes: [] } };
}
async function freePort() { const server = createTcpServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port; }
async function call(route, { method = 'GET', body, cookie, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}${route}`, { method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : Buffer.from(await response.arrayBuffer());
  return { status: response.status, data, cookie: response.headers.get('set-cookie')?.split(';')[0] || '' };
}
async function login(user) { const result = await call('/api/login', { method: 'POST', body: { email: user.email, password } }); assert.equal(result.status, 200); return result.cookie; }
async function waitForServer() { for (let attempt = 0; attempt < 100; attempt++) { try { if ((await fetch(`${baseUrl}/api/me`)).ok) return; } catch {} await new Promise(resolve => setTimeout(resolve, 100)); } throw new Error('Sprint 4 integration server did not start.'); }

test('application, ATS stages, screening, optimistic locking, CV privacy and notifications', { timeout: 60_000 }, async t => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ketnoi-s4-test-'));
  const employer = account('employer', 'Recruiter One', 'hr1@example.test');
  const otherEmployer = account('employer', 'Recruiter Two', 'hr2@example.test');
  const student = account('student', 'Student One', 'student1@example.test');
  const secondStudent = account('student', 'Student Two', 'student2@example.test', ['Python']);
  const company = { id: crypto.randomUUID(), ownerId: employer.id, name: 'Verified Company', slug: 'verified-company', verificationStatus: 'verified', applicationStages: undefined };
  const otherCompany = { id: crypto.randomUUID(), ownerId: otherEmployer.id, name: 'Other Company', slug: 'other-company', verificationStatus: 'verified' };
  const jobId = crypto.randomUUID();
  const job = { id: jobId, companyId: company.id, ownerId: employer.id, title: 'Frontend Intern', status: 'published', expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(), skillCriteria: [{ skill: 'React', importance: 'required', weight: 30 }, { skill: 'JavaScript', importance: 'preferred', weight: 10 }], skills: [{ skill: 'React', importance: 'required', weight: 30 }, { skill: 'JavaScript', importance: 'preferred', weight: 10 }] };
  const withdrawJob = { ...job, id: crypto.randomUUID(), title: 'Backend Intern', skillCriteria: [], skills: [], screeningQuestions: [] };
  const cvDir = path.join(dataDir, 'cv-files'); fs.mkdirSync(cvDir, { recursive: true });
  for (const candidate of [student, secondStudent]) { const cvId = crypto.randomUUID(); const storageName = `${crypto.randomUUID()}.pdf`; fs.writeFileSync(path.join(cvDir, storageName), '%PDF-1.4 Sprint 4 test CV'); candidate.cvId = cvId; candidate.storageName = storageName; }
  const resumes = [student, secondStudent].map(candidate => ({ id: candidate.cvId, userId: candidate.id, originalName: `${candidate.name}.pdf`, mimeType: 'application/pdf', status: 'confirmed', scanStatus: 'clean', isDefault: true, bytes: 26, storageName: candidate.storageName, createdAt: new Date().toISOString() }));
  fs.writeFileSync(path.join(dataDir, 'db.json'), JSON.stringify({ users: [employer, otherEmployer, student, secondStudent], sessions: [], consents: [], audit: [], companies: [company, otherCompany], jobs: [job, withdrawJob], resumes, embeddings: [], savedJobs: [], jobViews: [], reports: [] }));
  const port = await freePort(); baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, [serverFile], { env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, NODE_ENV: 'test' }, stdio: 'ignore', windowsHide: true });
  t.after(async () => { if (child && child.exitCode === null) { child.kill(); await new Promise(resolve => child.once('exit', resolve)); } if (dataDir && fs.existsSync(dataDir)) fs.rmSync(dataDir, { recursive: true, force: true }); });
  await waitForServer();
  const employerCookie = await login(employer); const otherEmployerCookie = await login(otherEmployer); const studentCookie = await login(student); const secondStudentCookie = await login(secondStudent);

  for (const route of ['/apply.html', '/applications.html', '/ats.html', '/notifications.html', '/sprint4/sprint4.css', '/sprint4/apply.js', '/sprint4/ats.js']) {
    const asset = await fetch(`${baseUrl}${route}`); assert.equal(asset.status, 200, `${route} should be served from Sprint 4 folder`);
  }

  assert.equal((await call(`/api/sprint4/jobs/${jobId}/apply-data`, { cookie: employerCookie })).status, 403);
  const configured = await call(`/api/sprint4/employer/jobs/${jobId}/screening`, { method: 'PUT', cookie: employerCookie, body: { questions: [
    { prompt: 'Bạn có thể làm việc toàn thời gian trong kỳ thực tập không?', type: 'single_choice', options: ['Có', 'Không'], required: true, knockout: true, correctAnswer: 'Có' },
    { prompt: 'Hãy chia sẻ một dự án bạn tự hào.', type: 'text', required: true }
  ] } });
  assert.equal(configured.status, 200); assert.equal(configured.data.questions[0].correctAnswer, 'Có');
  const applyData = await call(`/api/sprint4/jobs/${jobId}/apply-data`, { cookie: studentCookie });
  assert.equal(applyData.status, 200); assert.equal(applyData.data.questions[0].correctAnswer, undefined); assert.equal(applyData.data.cvs.length, 1);
  const body = { jobId, cvId: student.cvId, coverLetter: 'I built accessible React interfaces.', answers: [{ questionId: configured.data.questions[0].id, value: 'Có' }, { questionId: configured.data.questions[1].id, value: 'Campus planner' }] };
  const key = crypto.randomUUID();
  const submitted = await call('/api/sprint4/student/applications', { method: 'POST', cookie: studentCookie, headers: { 'Idempotency-Key': key }, body });
  assert.equal(submitted.status, 201); assert.equal(submitted.data.application.status, 'submitted'); assert.equal(submitted.data.application.score, 100);
  const replay = await call('/api/sprint4/student/applications', { method: 'POST', cookie: studentCookie, headers: { 'Idempotency-Key': key }, body });
  assert.equal(replay.status, 200); assert.equal(replay.data.idempotentReplay, true); assert.equal(replay.data.application.id, submitted.data.application.id);
  assert.equal((await call('/api/sprint4/student/applications', { method: 'POST', cookie: studentCookie, headers: { 'Idempotency-Key': key }, body: { ...body, coverLetter: 'Changed request under the same key.' } })).status, 409);
  assert.equal((await call('/api/sprint4/student/applications', { method: 'POST', cookie: studentCookie, headers: { 'Idempotency-Key': crypto.randomUUID() }, body })).status, 409);

  const firstList = await call(`/api/sprint4/employer/applications?jobId=${jobId}`, { cookie: employerCookie });
  assert.equal(firstList.status, 200); assert.equal(firstList.data.applications.length, 1);
  const filtered = await call(`/api/sprint4/employer/applications?jobId=${jobId}&stage=submitted&minScore=90&skill=React&school=Hanoi&minGpa=3`, { cookie: employerCookie });
  assert.equal(filtered.data.total, 1);
  const deniedList = await call('/api/sprint4/employer/applications', { cookie: otherEmployerCookie }); assert.equal(deniedList.status, 200); assert.equal(deniedList.data.total, 0);
  const viewed = await call(`/api/sprint4/employer/applications/${submitted.data.application.id}`, { cookie: employerCookie }); assert.equal(viewed.data.application.status, 'viewed');
  const stage = await call(`/api/sprint4/employer/applications/${submitted.data.application.id}/stage`, { method: 'PATCH', cookie: employerCookie, body: { status: 'screening', expectedVersion: viewed.data.application.version } });
  assert.equal(stage.status, 200); assert.equal(stage.data.application.status, 'screening');
  const conflict = await call(`/api/sprint4/employer/applications/${submitted.data.application.id}/stage`, { method: 'PATCH', cookie: employerCookie, body: { status: 'interview', expectedVersion: viewed.data.application.version } });
  assert.equal(conflict.status, 409);
  const interview = await call(`/api/sprint4/employer/applications/${submitted.data.application.id}/stage`, { method: 'PATCH', cookie: employerCookie, body: { status: 'interview', expectedVersion: stage.data.application.version } });
  assert.equal(interview.status, 200); assert.equal(interview.data.application.stageLog.length, 4);
  const rejected = await call(`/api/sprint4/employer/applications/${submitted.data.application.id}/stage`, { method: 'PATCH', cookie: employerCookie, body: { status: 'rejected', reason: 'skills', expectedVersion: interview.data.application.version } });
  assert.equal(rejected.status, 200); assert.match(rejected.data.application.rejectionNote, /kỹ năng/i);
  const cv = await call(`/api/sprint4/employer/applications/${submitted.data.application.id}/cv`, { cookie: employerCookie }); assert.equal(cv.status, 200); assert.match(cv.data.toString(), /^%PDF/);
  assert.equal((await call(`/api/sprint4/employer/applications/${submitted.data.application.id}/cv`, { cookie: otherEmployerCookie })).status, 404);

  const secondApply = await call(`/api/sprint4/student/applications`, { method: 'POST', cookie: secondStudentCookie, headers: { 'Idempotency-Key': crypto.randomUUID() }, body: { ...body, cvId: secondStudent.cvId, answers: [{ questionId: configured.data.questions[0].id, value: 'Không' }, { questionId: configured.data.questions[1].id, value: 'Other project' }] } });
  assert.equal(secondApply.status, 201); assert.equal(secondApply.data.application.status, 'rejected');
  const unread = await call('/api/sprint4/notifications', { cookie: studentCookie }); assert.equal(unread.status, 200); assert.ok(unread.data.unread >= 3);
  const studentNotification = unread.data.notifications[0]; assert.equal((await call(`/api/sprint4/notifications/${studentNotification.id}/read`, { method: 'POST', cookie: otherEmployerCookie, body: {} })).status, 404);
  assert.equal((await call('/api/sprint4/notifications/read-all', { method: 'POST', cookie: studentCookie, body: {} })).status, 200);

  const stages = await call('/api/sprint4/employer/pipeline', { cookie: employerCookie });
  const renamed = stages.data.stages.map(item => item.key === 'screening' ? { ...item, label: 'Đánh giá chuyên môn' } : item);
  assert.equal((await call('/api/sprint4/employer/pipeline', { method: 'PUT', cookie: employerCookie, body: { stages: renamed } })).status, 200);

  const withdrawApply = await call('/api/sprint4/student/applications', { method: 'POST', cookie: secondStudentCookie, headers: { 'Idempotency-Key': crypto.randomUUID() }, body: { jobId: withdrawJob.id, cvId: secondStudent.cvId } });
  assert.equal(withdrawApply.status, 201);
  const withdrawn = await call(`/api/sprint4/student/applications/${withdrawApply.data.application.id}/withdraw`, { method: 'POST', cookie: secondStudentCookie, body: { reason: 'I accepted another internship.' } });
  assert.equal(withdrawn.status, 200); assert.equal(withdrawn.data.application.status, 'withdrawn');
  assert.equal((await call(`/api/sprint4/student/applications/${withdrawApply.data.application.id}/withdraw`, { method: 'POST', cookie: secondStudentCookie, body: { reason: 'Try again.' } })).status, 409);

  const deleted = await call('/api/account', { method: 'DELETE', cookie: studentCookie, body: { confirm: true } }); assert.equal(deleted.status, 200);
  const finalDb = JSON.parse(fs.readFileSync(path.join(dataDir, 'db.json'), 'utf8'));
  assert.equal(finalDb.applications.some(item => item.studentId === student.id), false);
  assert.equal(finalDb.notifications.some(item => item.userId === student.id), false);
});
