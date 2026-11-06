const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createServer: createTcpServer } = require('node:net');
const { performance } = require('node:perf_hooks');

const root = path.resolve(__dirname, '../..');
const serverFile = path.join(root, 'Sprint 1_ Tài khoản, Phân quyền & Hồ sơ Sinh viên', 'server.js');
let dataDir;
let child;
let baseUrl;
let seed;
const password = 'Sprint2-Test-Password!';

function account(role, name, email) {
  const id = crypto.randomUUID(); const salt = crypto.randomBytes(16).toString('hex');
  return { id, role, name, email, passwordHash: `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`, verified: true, createdAt: new Date().toISOString(), profile: { fullName: name, visibility: 'private', skills: [], education: [], experiences: [], projects: [], languages: [], desiredRoles: [], jobTypes: [] } };
}
async function freePort() {
  const server = createTcpServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port;
}
async function call(endpoint, { method = 'GET', body, raw, cookie } = {}) {
  const headers = {};
  if (body !== undefined || raw !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(`${baseUrl}${endpoint}`, { method, headers, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : Buffer.from(await response.arrayBuffer());
  return { status: response.status, payload, cookie: response.headers.get('set-cookie')?.split(';')[0] || '' };
}
async function login(user) {
  const result = await call('/api/login', { method: 'POST', body: { email: user.email, password } });
  assert.equal(result.status, 200, `login failed for ${user.role}: ${JSON.stringify(result.payload)}`);
  return result.cookie;
}
async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt++) {
    try { const response = await fetch(`${baseUrl}/api/me`); if (response.ok) return; } catch { /* Server is still starting. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Sprint 2 test server did not start.');
}

test('Sprint 2 P0 flows and search p95 at 10,000 jobs', { timeout: 120_000 }, async t => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ketnoi-s2-test-'));
  const admin = account('admin', 'Test Admin', 'admin@example.test');
  const employer = account('employer', 'Test Employer', 'employer@example.test');
  const verifier = account('employer', 'Verification Company', 'verify@example.test');
  const unverifiedEmployer = account('employer', 'Unverified Company', 'unverified@example.test');
  const student = account('student', 'Test Student', 'student@example.test');
  const company = { id: crypto.randomUUID(), ownerId: employer.id, name: 'Verified QA Company', slug: 'verified-qa-company', website: 'https://example.test', taxId: '0100000000', description: 'Test employer company', industry: 'Công nghệ thông tin', location: 'Hà Nội', size: '11–50 nhân sự', branches: [], culture: '', benefits: [], socials: [], mediaUrls: [], verificationStatus: 'verified', documents: [] };
  const pendingCompany = { id: crypto.randomUUID(), ownerId: verifier.id, name: 'Company Pending Review', slug: 'company-pending-review', verificationStatus: 'pending_review', documents: [] };
  const unverifiedCompany = { id: crypto.randomUUID(), ownerId: unverifiedEmployer.id, name: 'Company Not Verified', slug: 'company-not-verified', verificationStatus: 'unverified', documents: [] };
  const documentId = crypto.randomUUID(); const documentName = `${documentId}.pdf`;
  pendingCompany.documents.push({ id: documentId, fileName: 'business-license.pdf', mimeType: 'application/pdf', bytes: 20, storageName: documentName, sha256: 'a'.repeat(64), scanStatus: 'clean', uploadedAt: new Date().toISOString() });
  const companyDocDir = path.join(dataDir, 'company-documents'); fs.mkdirSync(companyDocDir, { recursive: true }); fs.writeFileSync(path.join(companyDocDir, documentName), '%PDF-1.4\nQA fixture\n');
  const jobs = Array.from({ length: 10_000 }, (_, index) => {
    const now = new Date(Date.now() - index * 1000).toISOString();
    return { id: crypto.randomUUID(), companyId: company.id, ownerId: employer.id, title: `Frontend Developer ${index}`, slug: `frontend-developer-${index}`, description: 'Build accessible web products with React and JavaScript.', industry: 'Technology', location: 'Hanoi', type: 'Toàn thời gian', workMode: 'Kết hợp', level: 'Junior', experience: '1 year', languages: 'English', target: 'New graduate', headcount: 1, salaryMin: 12_000_000 + index, salaryMax: 20_000_000 + index, skills: [{ skill: 'React', importance: 'required', weight: 30 }], skillCriteria: [{ skill: 'React', importance: 'required', weight: 30 }], criteriaWeights: { skills: 60, education: 15, experience: 15, languages: 5, projects: 5 }, status: 'published', createdAt: now, updatedAt: now, publishedAt: now, expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString() };
  });
  const expiredJob = { ...jobs[0], id: crypto.randomUUID(), title: 'Expired QA Role', status: 'published', expiresAt: new Date(Date.now() - 60_000).toISOString() };
  fs.writeFileSync(path.join(dataDir, 'db.json'), JSON.stringify({ users: [admin, employer, verifier, unverifiedEmployer, student], sessions: [], consents: [], audit: [], companies: [company, pendingCompany, unverifiedCompany], jobs: [...jobs, expiredJob], savedJobs: [], jobViews: [], reports: [] }));
  const port = await freePort(); baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, [serverFile], { env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, NODE_ENV: 'test', CLAMSCAN_PATH: path.join(dataDir, 'missing-clam-scanner.exe') }, stdio: 'ignore', windowsHide: true });
  t.after(async () => {
    if (child && child.exitCode === null) { child.kill(); await new Promise(resolve => child.once('exit', resolve)); }
    if (dataDir && fs.existsSync(dataDir)) fs.rmSync(dataDir, { recursive: true, force: true });
  });
  await waitForServer();
  const adminCookie = await login(admin); const employerCookie = await login(employer); const studentCookie = await login(student); const verifierCookie = await login(verifier); const unverifiedCookie = await login(unverifiedEmployer);

  await t.test('company review, safe upload fail-closed, and approval', async () => {
    const queue = await call('/api/moderation/companies', { cookie: adminCookie });
    assert.equal(queue.status, 200);
    assert.ok(queue.payload.companies.some(item => item.id === pendingCompany.id));
    const download = await call(`/api/moderation/companies/${pendingCompany.id}/documents/${documentId}`, { cookie: adminCookie });
    assert.equal(download.status, 200); assert.match(download.payload.toString(), /^%PDF-/);
    const approval = await call('/api/moderation/companies', { method: 'POST', cookie: adminCookie, body: { companyId: pendingCompany.id, action: 'approve' } });
    assert.equal(approval.status, 200); assert.equal(approval.payload.verificationStatus, 'verified');
    const uploaded = await call('/api/employer/company/documents', { method: 'POST', cookie: employerCookie, body: { document: { fileName: 'license.pdf', mimeType: 'application/pdf', dataBase64: Buffer.from('%PDF-1.4\nfixture').toString('base64') } } });
    assert.equal(uploaded.status, 503); assert.equal(uploaded.payload.error.includes('ClamAV'), true);
    assert.deepEqual(fs.readdirSync(companyDocDir).filter(name => fs.statSync(path.join(companyDocDir, name)).isFile()), [documentName], 'unscanned upload must not be persisted');
    assert.equal((await call('/api/moderation/companies', { cookie: studentCookie })).status, 403);
    assert.equal((await call('/api/moderation/companies', { cookie: verifierCookie })).status, 403);
  });

  let newJobId;
  await t.test('draft and submission lifecycle enforce company verification and expiry', async () => {
    const draft = { title: 'Unverified draft QA', description: 'Draft description long enough for server validation and later review.', industry: 'Technology', location: 'Hanoi', type: 'Toàn thời gian', expiresAt: '' };
    const draftResult = await call('/api/employer/jobs', { method: 'POST', cookie: unverifiedCookie, body: { job: { ...draft, status: 'draft' } } });
    assert.equal(draftResult.status, 201); assert.equal(draftResult.payload.job.status, 'draft');
    const blocked = await call('/api/employer/jobs', { method: 'POST', cookie: unverifiedCookie, body: { job: { ...draft, expiresAt: new Date(Date.now() + 20 * 86_400_000).toISOString() } } });
    assert.equal(blocked.status, 403);
    const submission = await call('/api/employer/jobs', { method: 'POST', cookie: employerCookie, body: { job: { title: 'Lập trình viên QA', description: 'Build and maintain a recruitment search experience with clear requirements and benefits.', industry: 'Công nghệ thông tin', location: 'Hà Nội', type: 'Toàn thời gian', workMode: 'Kết hợp', level: 'Junior', experience: '1 year', languages: 'English', expiresAt: new Date(Date.now() + 20 * 86_400_000).toISOString(), salaryMin: 10_000_000, salaryMax: 20_000_000, skillCriteria: [{ skill: 'React', importance: 'required', weight: 30 }], criteriaWeights: { skills: 60, education: 15, experience: 15, languages: 5, projects: 5 } } } });
    assert.equal(submission.status, 201); assert.equal(submission.payload.job.status, 'pending_review'); newJobId = submission.payload.job.id;
    assert.equal((await call(`/api/jobs?q=${encodeURIComponent('lap trinh vien QA')}`)).payload.jobs.some(item => item.id === newJobId), false);
    const queue = await call('/api/moderation/jobs', { cookie: adminCookie }); assert.ok(queue.payload.jobs.some(item => item.id === newJobId));
    const approved = await call(`/api/moderation/jobs/${newJobId}`, { method: 'POST', cookie: adminCookie, body: { action: 'approve' } });
    assert.equal(approved.status, 200); assert.equal(approved.payload.job.status, 'published');
    const second = await call('/api/employer/jobs', { method: 'POST', cookie: employerCookie, body: { job: { title: 'Backend Developer QA', description: 'Backend role description with enough detail for the moderation workflow test.', industry: 'Technology', location: 'Hanoi', type: 'Toàn thời gian', expiresAt: new Date(Date.now() + 20 * 86_400_000).toISOString() } } });
    assert.equal(second.status, 201);
    const rejectWithoutNote = await call(`/api/moderation/jobs/${second.payload.job.id}`, { method: 'POST', cookie: adminCookie, body: { action: 'request_changes', note: '' } }); assert.equal(rejectWithoutNote.status, 400);
    const requestChanges = await call(`/api/moderation/jobs/${second.payload.job.id}`, { method: 'POST', cookie: adminCookie, body: { action: 'request_changes', note: 'Please clarify the experience requirement.' } }); assert.equal(requestChanges.status, 200); assert.equal(requestChanges.payload.job.status, 'needs_changes');
  });

  await t.test('accent-insensitive filters, sort, detail privacy, saved jobs, views, and company blocking', async () => {
    const found = await call(`/api/jobs?q=${encodeURIComponent('lap trinh vien QA')}&location=Ha%20Noi&type=${encodeURIComponent('Toàn thời gian')}&skill=React&salaryMin=9000000&sort=salary`);
    assert.equal(found.status, 200); assert.ok(found.payload.jobs.some(item => item.id === newJobId));
    const detail = await call(`/api/jobs/${newJobId}`, { cookie: studentCookie });
    assert.equal(detail.status, 200); assert.equal(detail.payload.job.company.name, company.name); assert.equal('ownerId' in detail.payload.job, false); assert.equal('taxId' in detail.payload.job.company, false);
    const saved = await call('/api/student/saved-jobs', { method: 'POST', cookie: studentCookie, body: { jobId: newJobId, group: 'Ưu tiên', note: 'Xem lại sau' } }); assert.equal(saved.status, 200);
    assert.ok((await call('/api/student/saved-jobs', { cookie: studentCookie })).payload.savedJobs.some(item => item.jobId === newJobId));
    assert.ok((await call('/api/student/job-history', { cookie: studentCookie })).payload.history.some(item => item.jobId === newJobId));
    const privacy = await call('/api/student/privacy', { method: 'PATCH', cookie: studentCookie, body: { visibility: 'invited', blockedCompanyIds: [company.id] } }); assert.equal(privacy.status, 200);
    assert.equal((await call(`/api/jobs/${newJobId}`, { cookie: studentCookie })).status, 404);
    assert.equal((await call(`/api/jobs?q=${encodeURIComponent('lap trinh vien QA')}`, { cookie: studentCookie })).payload.jobs.some(item => item.id === newJobId), false);
    assert.equal((await call('/api/student/privacy', { cookie: studentCookie })).payload.visibility, 'invited');
  });

  await t.test('admin account operations, malformed input, expiry, and 10k search p95', async () => {
    assert.equal((await call('/api/admin/users', { cookie: adminCookie })).status, 200);
    assert.equal((await call('/api/admin/metrics', { cookie: adminCookie })).payload.jobsExpired, 1);
    assert.equal((await call('/api/employer/company', { method: 'PUT', cookie: employerCookie, raw: '{' })).status, 400);
    const locked = await call(`/api/admin/users/${student.id}`, { method: 'PATCH', cookie: adminCookie, body: { locked: true } }); assert.equal(locked.status, 200);
    assert.equal((await call('/api/login', { method: 'POST', body: { email: student.email, password } })).status, 403);
    assert.equal((await call(`/api/admin/users/${student.id}`, { method: 'PATCH', cookie: adminCookie, body: { locked: false } })).status, 200);
    const reset = await call(`/api/admin/users/${student.id}/reset-password`, { method: 'POST', cookie: adminCookie, body: {} }); assert.equal(reset.status, 200); assert.ok(reset.payload.devResetUrl);
    const timings = [];
    for (let index = 0; index < 30; index++) { const start = performance.now(); const result = await call('/api/jobs?q=frontend&sort=relevance&pageSize=10'); timings.push(performance.now() - start); assert.equal(result.status, 200); assert.equal(result.payload.total, 10_000); }
    timings.sort((a, b) => a - b); const p95 = timings[Math.ceil(timings.length * 0.95) - 1];
    console.log(`Sprint 2 search p95, 10,000 jobs: ${p95.toFixed(1)} ms`);
    assert.ok(p95 < 800, `search p95 ${p95.toFixed(1)}ms exceeded 800ms`);
  });
});
