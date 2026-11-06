const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execFileAsync = promisify(execFile);

const text = (value, max = 3000) => String(value ?? '').trim().slice(0, max);
const list = (value, max = 20, length = 60) => Array.isArray(value) ? [...new Set(value.map(item => text(item, length)).filter(Boolean))].slice(0, max) : [];
const respond = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
const slug = value => text(value, 100).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const jobTypes = ['Thực tập', 'Toàn thời gian', 'Bán thời gian', 'Freelance', 'Hợp đồng'];
const workModes = ['Tại văn phòng', 'Kết hợp', 'Từ xa'];
const skillImportance = ['required', 'preferred'];
const normalizeSearch = value => text(value, 200).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('vi').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, ' ').trim();
const synonyms = new Map([['developer', ['developer', 'dev', 'lap trinh vien', 'programmer']], ['dev', ['developer', 'dev', 'lap trinh vien', 'programmer']], ['marketing', ['marketing', 'tiep thi']], ['designer', ['designer', 'thiet ke']], ['data', ['data', 'du lieu']]]);
function fuzzyTokenMatch(token, haystack) {
  if (haystack.includes(token)) return true;
  if (token.length < 5) return false;
  const words = haystack.split(' ');
  return words.some(word => {
    if (Math.abs(word.length - token.length) > 1) return false;
    let i = 0, j = 0, edits = 0;
    while (i < token.length && j < word.length) { if (token[i] === word[j]) { i++; j++; continue; } if (++edits > 1) return false; if (token.length > word.length) i++; else if (word.length > token.length) j++; else { i++; j++; } }
    return edits + (i < token.length || j < word.length ? 1 : 0) <= 1;
  });
}
function publicCompany(company) { return company ? ({ id: company.id, name: company.name, slug: company.slug, website: company.website, description: company.description, industry: company.industry, location: company.location, size: company.size, verified: company.verificationStatus === 'verified', branches: company.branches || [], culture: company.culture || '', benefits: company.benefits || [], socials: company.socials || [], mediaUrls: company.mediaUrls || [] }) : null; }
const publicJob = (job, company, includeCompany = false) => ({ id: job.id, title: job.title, description: job.description, requirements: job.requirements || '', benefits: job.benefits || '', recruitmentProcess: job.recruitmentProcess || '', industry: job.industry, location: job.location, type: job.type, level: job.level || '', experience: job.experience || '', target: job.target || '', headcount: job.headcount || 1, workMode: job.workMode, salaryMin: job.salaryMin, salaryMax: job.salaryMax, skills: job.skillCriteria || job.skills || [], criteriaWeights: job.criteriaWeights || {}, publishedAt: job.publishedAt, expiresAt: job.expiresAt, company: includeCompany ? publicCompany(company) : (company?.name || 'Doanh nghiệp') });
function jobSkills(value) {
  const entries = Array.isArray(value) ? value.slice(0, 30) : [];
  return entries.map(item => {
    const skill = text(typeof item === 'string' ? item : item?.skill, 80);
    const importance = item?.importance === 'preferred' ? 'preferred' : 'required';
    const weight = Math.max(1, Math.min(100, Number(item?.weight) || 1));
    return skill ? { skill, importance, weight } : null;
  }).filter(Boolean);
}

module.exports = async function sprint2Api(req, res, url, user, { db, save, audit, tokenHash, sendMail, appBaseUrl, onJobChanged = () => {} }) {
  db.companies ||= [];
  db.jobs ||= [];
  db.savedJobs ||= [];
  db.jobViews ||= [];
  db.reports ||= [];
  const companiesById = new Map(db.companies.map(company => [company.id, company]));
  let jobsExpired = false;
  for (const job of db.jobs) if (job.status === 'published' && job.expiresAt && Date.parse(job.expiresAt) <= Date.now()) { job.status = 'expired'; job.updatedAt = new Date().toISOString(); jobsExpired = true; }
  if (jobsExpired) save();
  const pathname = url.pathname;
  const companyFor = account => db.companies.find(company => company.ownerId === account.id);
  const failAuth = () => respond(res, 401, { error: 'Vui lòng đăng nhập để tiếp tục.' });
  const failRole = () => respond(res, 403, { error: 'Chức năng này dành cho nhà tuyển dụng.' });
  const read = async () => {
    let raw = '';
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 100_000) { respond(res, 413, { error: 'Dữ liệu gửi lên quá lớn.' }); return null; }
    }
    try { return raw ? JSON.parse(raw) : {}; } catch { respond(res, 400, { error: 'Dữ liệu JSON không hợp lệ.' }); return null; }
  };
  const readUpload = async () => {
    let raw = '';
    for await (const chunk of req) { raw += chunk; if (raw.length > 7_200_000) { respond(res, 413, { error: 'Tệp tải lên vượt quá giới hạn 5 MB.' }); return null; } }
    try { return raw ? JSON.parse(raw) : {}; } catch { respond(res, 400, { error: 'Dữ liệu tải tệp không hợp lệ.' }); return null; }
  };
  const employer = () => user && !user.deletedAt && user.role === 'employer';
  if (req.method === 'GET' && pathname === '/api/companies') return respond(res, 200, { companies: db.companies.filter(company => company.verificationStatus === 'verified').map(publicCompany) });
  if (req.method === 'GET' && pathname === '/api/jobs') {
    const q = normalizeSearch(url.searchParams.get('q'));
    const location = normalizeSearch(url.searchParams.get('location'));
    const type = normalizeSearch(url.searchParams.get('type'));
    const industry = normalizeSearch(url.searchParams.get('industry'));
    const skill = normalizeSearch(url.searchParams.get('skill'));
    const sort = ['newest', 'salary', 'deadline', 'relevance'].includes(url.searchParams.get('sort')) ? url.searchParams.get('sort') : 'newest';
    const salaryMin = Number(url.searchParams.get('salaryMin')) || 0;
    const salaryMax = Number(url.searchParams.get('salaryMax')) || 0;
    const postedWithin = Math.max(0, Math.min(365, Number(url.searchParams.get('postedWithin')) || 0));
    const page = Math.max(1, Math.min(10000, Number(url.searchParams.get('page')) || 1));
    const pageSize = Math.max(1, Math.min(30, Number(url.searchParams.get('pageSize')) || 10));
    let jobs = db.jobs.filter(job => job.status === 'published' && companiesById.get(job.companyId)?.verificationStatus === 'verified' && (!job.expiresAt || Date.parse(job.expiresAt) > Date.now()));
    const blocked = user?.role === 'student' ? new Set(user.blockedCompanyIds || []) : new Set();
    const tokens = q.split(' ').filter(Boolean);
    jobs = jobs.filter(job => {
      const company = companiesById.get(job.companyId);
      const haystack = normalizeSearch([job.title, job.description, job.industry, ...(job.skills || []).map(item => item.skill || item), company?.name].join(' '));
      const queryMatches = tokens.every(token => {
        const choices = synonyms.get(token) || [token];
        return choices.some(choice => fuzzyTokenMatch(choice, haystack));
      });
      const skills = (job.skills || []).map(item => normalizeSearch(item.skill || item));
      const nowMinusDays = Date.now() - postedWithin * 86_400_000;
      const experience = normalizeSearch(url.searchParams.get('experience'));
      const languages = normalizeSearch(url.searchParams.get('language'));
      return !blocked.has(job.companyId) && queryMatches && (!location || normalizeSearch(job.location).includes(location)) && (!type || normalizeSearch(job.type) === type) && (!industry || normalizeSearch(job.industry).includes(industry)) && (!skill || skills.some(value => value.includes(skill))) && (!salaryMin || (job.salaryMax || 0) >= salaryMin) && (!salaryMax || !job.salaryMin || job.salaryMin <= salaryMax) && (!postedWithin || Date.parse(job.publishedAt || job.createdAt) >= nowMinusDays) && (!url.searchParams.get('workMode') || job.workMode === url.searchParams.get('workMode')) && (!url.searchParams.get('level') || normalizeSearch(job.level).includes(normalizeSearch(url.searchParams.get('level')))) && (!experience || normalizeSearch(job.experience).includes(experience)) && (!languages || normalizeSearch(job.languages).includes(languages)) && (!url.searchParams.get('companySize') || company?.size === url.searchParams.get('companySize'));
    });
    if (sort === 'salary') jobs.sort((a, b) => (b.salaryMax || b.salaryMin || 0) - (a.salaryMax || a.salaryMin || 0));
    else if (sort === 'deadline') jobs.sort((a, b) => (Date.parse(a.expiresAt) || Infinity) - (Date.parse(b.expiresAt) || Infinity));
    else if (sort === 'relevance' && tokens.length) jobs.sort((a, b) => Number(normalizeSearch(b.title).includes(q)) - Number(normalizeSearch(a.title).includes(q)));
    else jobs.sort((a, b) => (b.publishedAt || b.createdAt || '').localeCompare(a.publishedAt || a.createdAt || ''));
    const total = jobs.length;
    jobs = jobs.slice((page - 1) * pageSize, page * pageSize).map(job => publicJob(job, companiesById.get(job.companyId)));
    return respond(res, 200, { jobs, page, pageSize, total, pages: Math.ceil(total / pageSize) });
  }
  const detail = pathname.match(/^\/api\/jobs\/([\w-]+)$/);
  if (req.method === 'GET' && detail) {
    const job = db.jobs.find(item => item.id === detail[1] && item.status === 'published' && db.companies.some(company => company.id === item.companyId && company.verificationStatus === 'verified') && (!item.expiresAt || Date.parse(item.expiresAt) > Date.now()) && !(user?.role === 'student' && (user.blockedCompanyIds || []).includes(item.companyId)));
    if (!job) return respond(res, 404, { error: 'Không tìm thấy tin tuyển dụng.' });
    if (user?.role === 'student') {
      const current = db.jobViews.filter(item => item.userId === user.id && item.jobId !== job.id);
      const other = db.jobViews.filter(item => item.userId !== user.id);
      current.push({ userId: user.id, jobId: job.id, companyId: job.companyId, viewedAt: new Date().toISOString() });
      db.jobViews = [...other, ...current.sort((a, b) => b.viewedAt.localeCompare(a.viewedAt)).slice(0, 50)]; save();
    }
    return respond(res, 200, { job: publicJob(job, db.companies.find(item => item.id === job.companyId), true) });
  }
  if (pathname === '/api/employer/company' && req.method === 'GET') {
    if (!user) return failAuth(); if (!employer()) return failRole();
    return respond(res, 200, { company: companyFor(user) || null });
  }
  if (pathname === '/api/employer/company' && ['PUT', 'PATCH'].includes(req.method)) {
    if (!user) return failAuth(); if (!employer()) return failRole();
    const body = await read(); if (!body) return;
    const source = body.company || body;
    const name = text(source.name, 120); const website = text(source.website, 300); const description = text(source.description, 2000);
    if (name.length < 2) return respond(res, 400, { error: 'Tên doanh nghiệp cần có ít nhất 2 ký tự.' });
    if (website && !/^https?:\/\//i.test(website)) return respond(res, 400, { error: 'Website cần bắt đầu bằng http:// hoặc https://.' });
    let company = companyFor(user);
    if (!company) { company = { id: crypto.randomUUID(), ownerId: user.id, createdAt: new Date().toISOString() }; db.companies.push(company); }
    const branches = Array.isArray(source.branches) ? source.branches.slice(0, 30).map(branch => ({ name: text(branch.name, 100), address: text(branch.address, 250) })).filter(branch => branch.address) : company.branches || [];
    const benefits = Array.isArray(source.benefits) ? list(source.benefits, 20, 100) : company.benefits || [];
    const socials = Array.isArray(source.socials) ? source.socials.slice(0, 10).map(item => ({ label: text(item.label, 60), url: text(item.url, 300) })).filter(item => item.label && /^https?:\/\//i.test(item.url)) : company.socials || [];
    const mediaUrls = Array.isArray(source.mediaUrls) ? source.mediaUrls.slice(0, 10).map(item => text(item, 500)).filter(item => /^https:\/\//i.test(item)) : company.mediaUrls || [];
    Object.assign(company, { name, slug: slug(name), website, description, taxId: text(source.taxId ?? company.taxId, 30), industry: text(source.industry, 120), location: text(source.location, 100), size: text(source.size, 40), branches, culture: text(source.culture ?? company.culture, 1500), benefits, socials, mediaUrls, verificationStatus: company.verificationStatus || 'unverified', updatedAt: new Date().toISOString() });
    audit(user.id, 'company.update', 'company'); save();
    return respond(res, 200, { company });
  }
  if (pathname === '/api/employer/company/documents' && req.method === 'POST') {
    if (!user) return failAuth(); if (!employer()) return failRole();
    const company = companyFor(user); if (!company) return respond(res, 409, { error: 'Lưu hồ sơ doanh nghiệp trước khi tải giấy tờ.' });
    const body = await readUpload(); if (!body) return;
    const input = body.document || body; const originalName = path.basename(text(input.fileName, 160));
    const typeInfo = { 'application/pdf': { extension: '.pdf', signature: bytes => bytes.subarray(0, 5).toString() === '%PDF-' }, 'image/png': { extension: '.png', signature: bytes => bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) }, 'image/jpeg': { extension: '.jpg', signature: bytes => bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 } }[text(input.mimeType, 80)];
    if (!typeInfo || !originalName || path.extname(originalName).toLowerCase() !== typeInfo.extension && !(typeInfo.extension === '.jpg' && path.extname(originalName).toLowerCase() === '.jpeg')) return respond(res, 400, { error: 'Chỉ nhận giấy phép dạng PDF, PNG hoặc JPEG.' });
    if (typeof input.dataBase64 !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.dataBase64)) return respond(res, 400, { error: 'Nội dung tệp không hợp lệ.' });
    const bytes = Buffer.from(input.dataBase64, 'base64');
    if (!bytes.length || bytes.length > 5 * 1024 * 1024 || !typeInfo.signature(bytes)) return respond(res, 400, { error: 'Tệp rỗng, vượt 5 MB hoặc không khớp định dạng khai báo.' });
    const scanner = process.env.CLAMSCAN_PATH || 'clamscan';
    const privateRoot = path.join(process.env.DATA_DIR || path.resolve(__dirname, '..', 'data'), 'company-documents');
    const tempDir = await fsp.mkdtemp(path.join(privateRoot, '.scan-')).catch(async error => { if (error.code !== 'ENOENT') throw error; await fsp.mkdir(privateRoot, { recursive: true, mode: 0o700 }); return fsp.mkdtemp(path.join(privateRoot, '.scan-')); });
    const tempFile = path.join(tempDir, `upload${typeInfo.extension}`);
    try {
      await fsp.writeFile(tempFile, bytes, { flag: 'wx', mode: 0o600 });
      try { await execFileAsync(scanner, ['--no-summary', tempFile], { timeout: 30_000, windowsHide: true, maxBuffer: 1024 * 1024 }); }
      catch (error) {
        if (error.code === 1) return respond(res, 400, { error: 'Máy quét phát hiện nội dung độc hại; tệp đã bị loại bỏ.' });
        console.error(JSON.stringify({ event: 'company_document.scan_unavailable', code: error.code || null }));
        return respond(res, 503, { error: 'Chưa có ClamAV hoạt động. Cấu hình CLAMSCAN_PATH để tải giấy tờ an toàn.' });
      }
      const id = crypto.randomUUID(); const fileName = `${id}${typeInfo.extension}`;
      await fsp.rename(tempFile, path.join(privateRoot, fileName));
      const document = { id, fileName: originalName, mimeType: input.mimeType, bytes: bytes.length, storageName: fileName, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), scanStatus: 'clean', uploadedAt: new Date().toISOString() };
      company.documents ||= []; company.documents.push(document); company.verificationStatus = 'pending_review'; company.updatedAt = new Date().toISOString(); audit(user.id, 'company.document_upload', company.id); save();
      return respond(res, 201, { document: { id, fileName: originalName, bytes: bytes.length, scanStatus: 'clean', uploadedAt: document.uploadedAt }, verificationStatus: company.verificationStatus });
    } finally { await fsp.rm(tempDir, { recursive: true, force: true }); }
  }
  if (pathname === '/api/employer/jobs' && req.method === 'GET') {
    if (!user) return failAuth(); if (!employer()) return failRole();
    const company = companyFor(user);
    return respond(res, 200, { jobs: db.jobs.filter(job => job.ownerId === user.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), company });
  }
  if (pathname === '/api/employer/jobs' && req.method === 'POST') {
    if (!user) return failAuth(); if (!employer()) return failRole();
    const company = companyFor(user); if (!company) return respond(res, 409, { error: 'Hãy lưu hồ sơ doanh nghiệp trước khi đăng tin.' });
    const body = await read(); if (!body) return;
    const source = body.job || body;
    const title = text(source.title, 120); const description = text(source.description, 10000);
    if (title.length < 4 || description.length < 30) return respond(res, 400, { error: 'Tiêu đề cần ít nhất 4 ký tự và mô tả ít nhất 30 ký tự.' });
    const type = text(source.type, 50);
    if (!jobTypes.includes(type)) return respond(res, 400, { error: 'Loại công việc không hợp lệ.' });
    const validSalary = value => value === undefined || value === null || value === '' || (Number.isFinite(Number(value)) && Number(value) >= 0);
    if (!validSalary(source.salaryMin) || !validSalary(source.salaryMax)) return respond(res, 400, { error: 'Mức lương cần là số không âm.' });
    if (source.expiresAt && (!Number.isFinite(Date.parse(source.expiresAt)) || Date.parse(source.expiresAt) <= Date.now() || Date.parse(source.expiresAt) > Date.now() + 90 * 86_400_000)) return respond(res, 400, { error: 'Ngày hết hạn cần trong tương lai và không quá 90 ngày.' });
    const status = source.status === 'draft' ? 'draft' : 'pending_review';
    if (status !== 'draft' && company.verificationStatus !== 'verified') return respond(res, 403, { error: 'Doanh nghiệp cần được xác minh trước khi gửi tin để đăng công khai.' });
    if (status !== 'draft' && !source.expiresAt) return respond(res, 400, { error: 'Tin gửi duyệt cần có hạn đăng trong 90 ngày tới.' });
    const skillCriteria = jobSkills(source.skillCriteria || source.skills);
    if (skillCriteria.length && !skillCriteria.some(item => item.importance === 'required')) return respond(res, 400, { error: 'Cần có ít nhất một kỹ năng bắt buộc.' });
    const defaults = { skills: 60, education: 15, experience: 15, languages: 5, projects: 5 };
    const criteriaWeights = Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, Math.max(0, Math.min(100, source.criteriaWeights?.[key] === undefined ? fallback : Number(source.criteriaWeights[key]) || 0))]));
    if (Object.values(criteriaWeights).reduce((sum, value) => sum + value, 0) !== 100) return respond(res, 400, { error: 'Tổng trọng số tiêu chí phải bằng 100%.' });
    const job = { id: crypto.randomUUID(), companyId: company.id, ownerId: user.id, title, slug: slug(title), description, requirements: text(source.requirements, 6000), benefits: text(source.benefits, 4000), recruitmentProcess: text(source.recruitmentProcess, 2000), industry: text(source.industry, 120), location: text(source.location, 100), type, level: text(source.level, 60), experience: text(source.experience, 100), languages: text(source.languages, 200), target: text(source.target, 100), headcount: Math.max(1, Math.min(1000, Number(source.headcount) || 1)), workMode: workModes.includes(source.workMode) ? source.workMode : 'Tại văn phòng', salaryMin: validSalary(source.salaryMin) && source.salaryMin !== '' && source.salaryMin !== null ? Number(source.salaryMin) : null, salaryMax: validSalary(source.salaryMax) && source.salaryMax !== '' && source.salaryMax !== null ? Number(source.salaryMax) : null, skillCriteria, skills: skillCriteria, criteriaWeights, status, moderationNote: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), publishedAt: null, expiresAt: source.expiresAt ? new Date(source.expiresAt).toISOString() : null };
    if (job.salaryMin !== null && job.salaryMax !== null && job.salaryMin > job.salaryMax) return respond(res, 400, { error: 'Mức lương tối thiểu không thể cao hơn tối đa.' });
    db.jobs.push(job); audit(user.id, `job.${job.status === 'draft' ? 'create_draft' : 'submit_review'}`, job.id); save(); onJobChanged(job);
    return respond(res, 201, { job });
  }
  const edit = pathname.match(/^\/api\/employer\/jobs\/([\w-]+)$/);
  if (req.method === 'PATCH' && edit) {
    if (!user) return failAuth(); if (!employer()) return failRole();
    const job = db.jobs.find(item => item.id === edit[1] && item.ownerId === user.id);
    if (!job) return respond(res, 404, { error: 'Không tìm thấy tin của bạn.' });
    const body = await read(); if (!body) return;
    const source = body.job || body; const updated = { ...job };
    for (const [key, max] of Object.entries({ title: 120, description: 10000, industry: 120, location: 100, type: 50, workMode: 30 })) if (source[key] !== undefined) updated[key] = text(source[key], max);
    if (source.skills !== undefined || source.skillCriteria !== undefined) { updated.skillCriteria = jobSkills(source.skillCriteria || source.skills); updated.skills = updated.skillCriteria; }
    const validSalary = value => value === undefined || value === null || value === '' || (Number.isFinite(Number(value)) && Number(value) >= 0);
    if (!validSalary(source.salaryMin) || !validSalary(source.salaryMax)) return respond(res, 400, { error: 'Mức lương cần là số không âm.' });
    if (source.salaryMin !== undefined) updated.salaryMin = source.salaryMin === '' || source.salaryMin === null ? null : Number(source.salaryMin);
    if (source.salaryMax !== undefined) updated.salaryMax = source.salaryMax === '' || source.salaryMax === null ? null : Number(source.salaryMax);
    if (source.title !== undefined) updated.slug = slug(updated.title);
    if (source.expiresAt !== undefined) {
      if (!Number.isFinite(Date.parse(source.expiresAt)) || Date.parse(source.expiresAt) <= Date.now() || Date.parse(source.expiresAt) > Date.now() + 90 * 86_400_000) return respond(res, 400, { error: 'Ngày hết hạn cần trong tương lai và không quá 90 ngày.' });
      updated.expiresAt = new Date(source.expiresAt).toISOString();
    }
    for (const [key, max] of Object.entries({ requirements: 6000, benefits: 4000, recruitmentProcess: 2000, level: 60, experience: 100, languages: 200, target: 100 })) if (source[key] !== undefined) updated[key] = text(source[key], max);
    if (source.headcount !== undefined) updated.headcount = Math.max(1, Math.min(1000, Number(source.headcount) || 1));
    if (source.criteriaWeights !== undefined) {
      const defaults = updated.criteriaWeights || { skills: 60, education: 15, experience: 15, languages: 5, projects: 5 };
      updated.criteriaWeights = Object.fromEntries(Object.keys(defaults).map(key => [key, Math.max(0, Math.min(100, Number(source.criteriaWeights[key] ?? defaults[key]) || 0))]));
      if (Object.values(updated.criteriaWeights).reduce((sum, value) => sum + value, 0) !== 100) return respond(res, 400, { error: 'Tổng trọng số tiêu chí phải bằng 100%.' });
    }
    if ((updated.skillCriteria || []).length && !updated.skillCriteria.some(item => item.importance === 'required')) return respond(res, 400, { error: 'Cần có ít nhất một kỹ năng bắt buộc.' });
    if (updated.title.length < 4 || updated.description.length < 30 || !jobTypes.includes(updated.type) || !workModes.includes(updated.workMode) || (updated.salaryMin !== null && updated.salaryMax !== null && updated.salaryMin > updated.salaryMax)) return respond(res, 400, { error: 'Thông tin tin tuyển dụng chưa hợp lệ.' });
    if (source.status !== 'draft' && db.companies.find(company => company.id === job.companyId)?.verificationStatus !== 'verified') return respond(res, 403, { error: 'Doanh nghiệp cần được xác minh trước khi gửi tin để đăng công khai.' });
    if (source.status !== 'draft' && (!updated.expiresAt || Date.parse(updated.expiresAt) <= Date.now())) return respond(res, 400, { error: 'Tin gửi duyệt cần có hạn đăng trong tương lai.' });
    Object.assign(job, updated, { status: source.status === 'draft' ? 'draft' : 'pending_review', moderationNote: '', updatedAt: new Date().toISOString(), publishedAt: null });
    audit(user.id, 'job.update_submit_review', job.id); save(); onJobChanged(job); return respond(res, 200, { job });
  }
  const jobAction = pathname.match(/^\/api\/employer\/jobs\/([\w-]+)\/(clone|renew|status)$/);
  if (jobAction && ['POST', 'PATCH'].includes(req.method)) {
    if (!user) return failAuth(); if (!employer()) return failRole();
    const sourceJob = db.jobs.find(item => item.id === jobAction[1] && item.ownerId === user.id);
    if (!sourceJob) return respond(res, 404, { error: 'Không tìm thấy tin của bạn.' });
    const company = db.companies.find(item => item.id === sourceJob.companyId);
    if (jobAction[2] === 'clone') {
      const clone = { ...sourceJob, id: crypto.randomUUID(), title: `${sourceJob.title} (bản sao)`.slice(0, 120), slug: slug(`${sourceJob.title} bản sao`), status: 'draft', moderationNote: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), publishedAt: null, expiresAt: null };
      db.jobs.push(clone); audit(user.id, 'job.clone', sourceJob.id); save(); onJobChanged(clone); return respond(res, 201, { job: clone });
    }
    const body = await read(); if (!body) return;
    if (jobAction[2] === 'renew') {
      if (company?.verificationStatus !== 'verified') return respond(res, 403, { error: 'Doanh nghiệp cần xác minh trước khi gia hạn tin.' });
      const expiry = Date.parse(body.expiresAt);
      if (!Number.isFinite(expiry) || expiry <= Date.now() || expiry > Date.now() + 90 * 86_400_000) return respond(res, 400, { error: 'Hạn mới cần trong tương lai và không quá 90 ngày.' });
      sourceJob.expiresAt = new Date(expiry).toISOString(); sourceJob.status = 'pending_review'; sourceJob.publishedAt = null; sourceJob.moderationNote = ''; sourceJob.updatedAt = new Date().toISOString(); audit(user.id, 'job.renew_submit_review', sourceJob.id); save(); onJobChanged(sourceJob); return respond(res, 200, { job: sourceJob });
    }
    const next = body.status;
    if (next === 'paused' && sourceJob.status !== 'published') return respond(res, 409, { error: 'Chỉ có thể tạm dừng tin đang công khai.' });
    if (next === 'closed' && !['published', 'paused', 'expired'].includes(sourceJob.status)) return respond(res, 409, { error: 'Trạng thái tin hiện tại không thể đóng.' });
    if (!['paused', 'closed'].includes(next)) return respond(res, 400, { error: 'Chọn paused hoặc closed.' });
    sourceJob.status = next; sourceJob.updatedAt = new Date().toISOString(); audit(user.id, `job.${next}`, sourceJob.id); save(); onJobChanged(sourceJob); return respond(res, 200, { job: sourceJob });
  }
  if (req.method === 'DELETE' && edit) {
    if (!user) return failAuth(); if (!employer()) return failRole();
    const job = db.jobs.find(item => item.id === edit[1] && item.ownerId === user.id);
    if (!job) return respond(res, 404, { error: 'Không tìm thấy tin của bạn.' });
    job.status = 'archived'; job.updatedAt = new Date().toISOString(); audit(user.id, 'job.archive', job.id); save(); onJobChanged(job); return respond(res, 200, { job });
  }
  if (pathname === '/api/student/saved-jobs' && req.method === 'GET') {
    if (!user) return failAuth(); if (user.role !== 'student') return respond(res, 403, { error: 'Chức năng này dành cho sinh viên.' });
    const saved = db.savedJobs.filter(item => item.userId === user.id).sort((a, b) => b.savedAt.localeCompare(a.savedAt)).map(item => ({ ...item, job: publicJob(db.jobs.find(job => job.id === item.jobId) || {}, db.companies.find(company => company.id === item.companyId)) }));
    return respond(res, 200, { savedJobs: saved });
  }
  if (pathname === '/api/student/saved-jobs' && req.method === 'POST') {
    if (!user) return failAuth(); if (user.role !== 'student') return respond(res, 403, { error: 'Chức năng này dành cho sinh viên.' });
    const body = await read(); if (!body) return;
    const job = db.jobs.find(item => item.id === body.jobId && item.status === 'published' && (!item.expiresAt || Date.parse(item.expiresAt) > Date.now()));
    if (!job) return respond(res, 404, { error: 'Tin không còn mở để lưu.' });
    let saved = db.savedJobs.find(item => item.userId === user.id && item.jobId === job.id);
    if (!saved && db.savedJobs.filter(item => item.userId === user.id).length >= 100) return respond(res, 409, { error: 'Bạn đã đạt giới hạn 100 tin đã lưu.' });
    if (!saved) { saved = { id: crypto.randomUUID(), userId: user.id, jobId: job.id, companyId: job.companyId, savedAt: new Date().toISOString() }; db.savedJobs.push(saved); }
    saved.group = text(body.group, 60); saved.note = text(body.note, 500); audit(user.id, 'job.save', job.id); save(); return respond(res, 200, { savedJob: saved });
  }
  const unsave = pathname.match(/^\/api\/student\/saved-jobs\/([\w-]+)$/);
  if (req.method === 'DELETE' && unsave) {
    if (!user) return failAuth(); if (user.role !== 'student') return respond(res, 403, { error: 'Chức năng này dành cho sinh viên.' });
    const before = db.savedJobs.length; db.savedJobs = db.savedJobs.filter(item => !(item.userId === user.id && item.jobId === unsave[1]));
    if (db.savedJobs.length !== before) { audit(user.id, 'job.unsave', unsave[1]); save(); }
    return respond(res, 200, { message: 'Đã cập nhật tin đã lưu.' });
  }
  if (pathname === '/api/student/job-history' && req.method === 'GET') {
    if (!user) return failAuth(); if (user.role !== 'student') return respond(res, 403, { error: 'Chức năng này dành cho sinh viên.' });
    const history = db.jobViews.filter(item => item.userId === user.id).sort((a, b) => b.viewedAt.localeCompare(a.viewedAt)).slice(0, 50).map(item => ({ ...item, job: publicJob(db.jobs.find(job => job.id === item.jobId) || {}, db.companies.find(company => company.id === item.companyId)) }));
    return respond(res, 200, { history });
  }
  if (pathname === '/api/student/privacy' && req.method === 'GET') {
    if (!user) return failAuth(); if (user.role !== 'student') return respond(res, 403, { error: 'Chức năng này dành cho sinh viên.' });
    const blocked = new Set(user.blockedCompanyIds || []);
    return respond(res, 200, { visibility: ['public', 'invited', 'private'].includes(user.profile?.visibility) ? user.profile.visibility : 'private', blockedCompanies: db.companies.filter(company => blocked.has(company.id)).map(company => ({ id: company.id, name: company.name })) });
  }
  if (pathname === '/api/student/privacy' && req.method === 'PATCH') {
    if (!user) return failAuth(); if (user.role !== 'student') return respond(res, 403, { error: 'Chức năng này dành cho sinh viên.' });
    const body = await read(); if (!body) return;
    if (body.visibility !== undefined && !['public', 'invited', 'private'].includes(body.visibility)) return respond(res, 400, { error: 'Chế độ hồ sơ không hợp lệ.' });
    if (body.blockedCompanyIds !== undefined && (!Array.isArray(body.blockedCompanyIds) || body.blockedCompanyIds.length > 100)) return respond(res, 400, { error: 'Danh sách chặn tối đa 100 doanh nghiệp.' });
    if (body.visibility !== undefined) { user.profile ||= {}; user.profile.visibility = body.visibility; }
    if (body.blockedCompanyIds !== undefined) {
      const valid = new Set(db.companies.map(company => company.id));
      if (body.blockedCompanyIds.some(id => !valid.has(id))) return respond(res, 400, { error: 'Danh sách có doanh nghiệp không tồn tại.' });
      user.blockedCompanyIds = [...new Set(body.blockedCompanyIds)];
    }
    audit(user.id, 'student.privacy.update', 'student_profile'); save(); return respond(res, 200, { visibility: user.profile?.visibility || 'private', blockedCompanyIds: user.blockedCompanyIds || [] });
  }
  const reportJob = pathname.match(/^\/api\/jobs\/([\w-]+)\/report$/);
  if (req.method === 'POST' && reportJob) {
    if (!user) return failAuth(); if (user.role !== 'student') return respond(res, 403, { error: 'Chức năng báo cáo dành cho sinh viên.' });
    const job = db.jobs.find(item => item.id === reportJob[1] && item.status === 'published'); if (!job) return respond(res, 404, { error: 'Không tìm thấy tin tuyển dụng.' });
    const body = await read(); if (!body) return;
    const reason = text(body.reason, 500); if (reason.length < 5) return respond(res, 400, { error: 'Vui lòng mô tả lý do báo cáo (ít nhất 5 ký tự).' });
    db.reports.push({ id: crypto.randomUUID(), type: 'job', jobId: job.id, companyId: job.companyId, userId: user.id, reason, status: 'pending', createdAt: new Date().toISOString() }); audit(user.id, 'job.report', job.id); save(); return respond(res, 201, { message: 'Đã gửi báo cáo để quản trị viên xem xét.' });
  }
  if (pathname === '/api/admin/metrics' && req.method === 'GET') {
    if (!user) return failAuth(); if (user.role !== 'admin') return respond(res, 403, { error: 'Bạn không có quyền quản trị.' });
    const day = new Date(); day.setHours(0, 0, 0, 0);
    const monthAgo = Date.now() - 30 * 86_400_000;
    const activeToday = new Set(db.audit.filter(event => event.action === 'account.login' && Date.parse(event.at) >= day.getTime()).map(event => event.userId).filter(Boolean));
    const activeMonth = new Set(db.audit.filter(event => event.action === 'account.login' && Date.parse(event.at) >= monthAgo).map(event => event.userId).filter(Boolean));
    return respond(res, 200, { users: db.users.length, newUsersToday: db.users.filter(account => Date.parse(account.createdAt) >= day.getTime()).length, activeToday: activeToday.size, activeMonth: activeMonth.size, companiesPending: db.companies.filter(company => ['pending_review', 'needs_more'].includes(company.verificationStatus)).length, publishedJobs: db.jobs.filter(job => job.status === 'published').length, jobsPending: db.jobs.filter(job => job.status === 'pending_review').length, jobsExpired: db.jobs.filter(job => job.status === 'expired').length, reportsPending: db.reports.filter(report => report.status === 'pending').length, savedJobs: db.savedJobs.length, jobViews: db.jobViews.length });
  }
  if (pathname === '/api/admin/users' && req.method === 'GET') {
    if (!user) return failAuth(); if (user.role !== 'admin') return respond(res, 403, { error: 'Bạn không có quyền quản trị.' });
    const query = normalizeSearch(url.searchParams.get('q'));
    const users = db.users.filter(account => !query || normalizeSearch(`${account.name} ${account.email}`).includes(query)).slice(0, 200).map(account => ({ id: account.id, name: account.name, email: account.email, role: account.role, verified: Boolean(account.verified), locked: Boolean(account.lockedAt), lockedAt: account.lockedAt || null, createdAt: account.createdAt, recentAudit: db.audit.filter(event => event.userId === account.id).slice(-5).reverse() }));
    return respond(res, 200, { users });
  }
  const adminUser = pathname.match(/^\/api\/admin\/users\/([\w-]+)$/);
  if (req.method === 'PATCH' && adminUser) {
    if (!user) return failAuth(); if (user.role !== 'admin') return respond(res, 403, { error: 'Bạn không có quyền quản trị.' });
    const target = db.users.find(account => account.id === adminUser[1]); if (!target) return respond(res, 404, { error: 'Không tìm thấy tài khoản.' });
    const body = await read(); if (!body) return;
    if (target.id === user.id && (body.locked === true || body.role && body.role !== 'admin')) return respond(res, 400, { error: 'Không thể khóa hoặc hạ quyền tài khoản admin đang thao tác.' });
    if (body.role !== undefined && !['student', 'employer', 'admin'].includes(body.role)) return respond(res, 400, { error: 'Vai trò không hợp lệ.' });
    if (target.role === 'admin' && body.role && body.role !== 'admin' && db.users.filter(account => account.role === 'admin' && !account.lockedAt).length <= 1) return respond(res, 409, { error: 'Không thể hạ quyền admin cuối cùng.' });
    if (body.locked === true && target.role === 'admin' && !target.lockedAt && db.users.filter(account => account.role === 'admin' && !account.lockedAt).length <= 1) return respond(res, 409, { error: 'Không thể khóa admin đang hoạt động cuối cùng.' });
    if (body.role !== undefined) target.role = body.role;
    if (body.locked === true) target.lockedAt = target.lockedAt || new Date().toISOString();
    if (body.locked === false) delete target.lockedAt;
    audit(user.id, 'admin.user.update', target.id); save(); return respond(res, 200, { user: { id: target.id, name: target.name, email: target.email, role: target.role, locked: Boolean(target.lockedAt) } });
  }
  const resetAdminUser = pathname.match(/^\/api\/admin\/users\/([\w-]+)\/reset-password$/);
  if (req.method === 'POST' && resetAdminUser) {
    if (!user) return failAuth(); if (user.role !== 'admin') return respond(res, 403, { error: 'Bạn không có quyền quản trị.' });
    const target = db.users.find(account => account.id === resetAdminUser[1] && !account.deletedAt); if (!target) return respond(res, 404, { error: 'Không tìm thấy tài khoản.' });
    const token = crypto.randomBytes(32).toString('hex'); target.resetTokenHash = tokenHash(token); target.resetExpiresAt = Date.now() + 15 * 60_000; audit(user.id, 'admin.user.password_reset_request', target.id); save();
    const resetUrl = `${appBaseUrl}/?reset=${token}`;
    try { await sendMail(target.email, 'Đặt lại mật khẩu Ketnoi', `<p><a href="${resetUrl}">Tạo mật khẩu mới</a> · Liên kết có hiệu lực 15 phút.</p>`); }
    catch (error) { console.error(JSON.stringify({ event: 'email.delivery_failed', purpose: 'admin_password_reset', error: error.message })); return respond(res, 503, { error: 'Chưa gửi được email đặt lại mật khẩu.' }); }
    return respond(res, 200, { message: 'Đã gửi hướng dẫn đặt lại mật khẩu.', ...(process.env.NODE_ENV !== 'production' && !process.env.RESEND_API_KEY ? { devResetUrl: resetUrl } : {}) });
  }
  if (pathname === '/api/moderation/companies' && req.method === 'GET') {
    if (!user) return failAuth(); if (user.role !== 'admin') return respond(res, 403, { error: 'Bạn không có quyền kiểm duyệt.' });
    const companies = db.companies.filter(company => ['pending_review', 'rejected', 'unverified'].includes(company.verificationStatus)).map(company => ({ ...company, owner: (() => { const owner = db.users.find(account => account.id === company.ownerId); return owner ? { name: owner.name, email: owner.email } : null; })(), documents: (company.documents || []).map(({ storageName, ...document }) => ({ ...document, downloadUrl: `/api/moderation/companies/${company.id}/documents/${document.id}` })) }));
    return respond(res, 200, { companies });
  }
  const companyDocument = pathname.match(/^\/api\/moderation\/companies\/([\w-]+)\/documents\/([\w-]+)$/);
  if (req.method === 'GET' && companyDocument) {
    if (!user) return failAuth(); if (user.role !== 'admin') return respond(res, 403, { error: 'Bạn không có quyền xem giấy tờ xác minh.' });
    const company = db.companies.find(item => item.id === companyDocument[1]); const document = company?.documents?.find(item => item.id === companyDocument[2] && item.scanStatus === 'clean');
    if (!document || !/^[\da-f-]{36}\.(?:pdf|png|jpg)$/.test(document.storageName)) return respond(res, 404, { error: 'Không tìm thấy giấy tờ đã quét sạch.' });
    const filePath = path.join(process.env.DATA_DIR || path.resolve(__dirname, '..', 'data'), 'company-documents', document.storageName);
    if (!fs.existsSync(filePath)) return respond(res, 404, { error: 'Tệp không còn trên máy chủ.' });
    res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="${document.id}${path.extname(document.storageName)}"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    fs.createReadStream(filePath).pipe(res); audit(user.id, 'admin.company_document.view', company.id); save(); return;
  }
  if (pathname === '/api/moderation/companies' && req.method === 'POST') {
    if (!user) return failAuth(); if (user.role !== 'admin') return respond(res, 403, { error: 'Bạn không có quyền kiểm duyệt.' });
    const body = await read(); if (!body) return;
    const company = db.companies.find(item => item.id === body.companyId); if (!company) return respond(res, 404, { error: 'Không tìm thấy doanh nghiệp.' });
    if (!['approve', 'reject', 'request_more'].includes(body.action)) return respond(res, 400, { error: 'Thao tác kiểm duyệt không hợp lệ.' });
    const note = text(body.note, 500);
    if (body.action !== 'approve' && note.length < 5) return respond(res, 400, { error: 'Ghi lý do từ chối hoặc yêu cầu bổ sung (ít nhất 5 ký tự).' });
    if (body.action === 'approve' && !(company.documents || []).some(item => item.scanStatus === 'clean')) return respond(res, 409, { error: 'Doanh nghiệp cần có giấy tờ đã quét virus sạch.' });
    company.verificationStatus = body.action === 'approve' ? 'verified' : body.action === 'reject' ? 'rejected' : 'needs_more';
    company.verificationNote = body.action === 'approve' ? '' : note; company.verifiedAt = body.action === 'approve' ? new Date().toISOString() : null; company.updatedAt = new Date().toISOString();
    audit(user.id, `company.verification.${body.action}`, company.id); save(); return respond(res, 200, { company: publicCompany(company), verificationStatus: company.verificationStatus, note: company.verificationNote });
  }
  if (pathname === '/api/moderation/jobs' && req.method === 'GET') {
    if (!user) return failAuth(); if (user.role !== 'admin') return respond(res, 403, { error: 'Bạn không có quyền kiểm duyệt.' });
    return respond(res, 200, { jobs: db.jobs.filter(job => job.status === 'pending_review').map(job => ({ ...job, company: db.companies.find(item => item.id === job.companyId)?.name || '', companyVerified: db.companies.find(item => item.id === job.companyId)?.verificationStatus === 'verified' })) });
  }
  if (pathname === '/api/moderation/reports' && req.method === 'GET') {
    if (!user) return failAuth(); if (user.role !== 'admin') return respond(res, 403, { error: 'Bạn không có quyền quản trị.' });
    return respond(res, 200, { reports: db.reports.filter(report => report.status === 'pending').map(report => ({ ...report, job: db.jobs.find(job => job.id === report.jobId) ? { id: report.jobId, title: db.jobs.find(job => job.id === report.jobId).title } : null })) });
  }
  const reportAction = pathname.match(/^\/api\/moderation\/reports\/([\w-]+)$/);
  if (req.method === 'POST' && reportAction) {
    if (!user) return failAuth(); if (user.role !== 'admin') return respond(res, 403, { error: 'Bạn không có quyền quản trị.' });
    const report = db.reports.find(item => item.id === reportAction[1] && item.status === 'pending'); if (!report) return respond(res, 404, { error: 'Không tìm thấy báo cáo đang chờ.' });
    const body = await read(); if (!body) return;
    if (!['dismiss', 'remove_job'].includes(body.action)) return respond(res, 400, { error: 'Chọn dismiss hoặc remove_job.' });
    if (body.action === 'remove_job') { const job = db.jobs.find(item => item.id === report.jobId); if (job) { job.status = 'closed'; job.moderationNote = text(body.note || 'Tin bị gỡ theo báo cáo.', 500); job.updatedAt = new Date().toISOString(); } }
    report.status = body.action === 'dismiss' ? 'dismissed' : 'actioned'; report.resolution = text(body.note, 500); report.resolvedAt = new Date().toISOString(); report.resolvedBy = user.id; audit(user.id, `report.${body.action}`, report.id); save(); return respond(res, 200, { report });
  }
  const moderate = pathname.match(/^\/api\/moderation\/jobs\/([\w-]+)$/);
  if (req.method === 'POST' && moderate) {
    if (!user) return failAuth(); if (user.role !== 'admin') return respond(res, 403, { error: 'Bạn không có quyền kiểm duyệt.' });
    const job = db.jobs.find(item => item.id === moderate[1] && item.status === 'pending_review');
    if (!job) return respond(res, 404, { error: 'Tin đang chờ kiểm duyệt không tồn tại.' });
    const body = await read(); if (!body) return;
    if (!['approve', 'reject', 'request_changes', 'remove'].includes(body.action)) return respond(res, 400, { error: 'Thao tác kiểm duyệt không hợp lệ.' });
    if (body.action === 'approve' && db.companies.find(item => item.id === job.companyId)?.verificationStatus !== 'verified') return respond(res, 409, { error: 'Cần xác minh doanh nghiệp trước khi đăng tin.' });
    if (body.action === 'approve' && (!job.expiresAt || Date.parse(job.expiresAt) <= Date.now())) return respond(res, 400, { error: 'Tin cần có hạn đăng hợp lệ trong tương lai trước khi duyệt.' });
    if (body.action !== 'approve' && text(body.note, 500).length < 5) return respond(res, 400, { error: 'Cần ghi lý do để nhà tuyển dụng biết nội dung cần xử lý.' });
    job.status = body.action === 'approve' ? 'published' : body.action === 'reject' ? 'rejected' : body.action === 'request_changes' ? 'needs_changes' : 'closed'; job.moderationNote = body.action === 'approve' ? '' : text(body.note, 500); job.updatedAt = new Date().toISOString();
    if (body.action === 'approve') job.publishedAt = new Date().toISOString();
    audit(user.id, `job.moderation.${body.action}`, job.id); save(); onJobChanged(job); return respond(res, 200, { job });
  }
  return null;
};
