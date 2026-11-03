const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PORT = Number(process.env.PORT || 3000);
const TOKEN_PEPPER = process.env.TOKEN_PEPPER || 'local-prototype-only';
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
const skillTaxonomy = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'skills.json'), 'utf8'));
fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], sessions: [], consents: [], audit: [] }, null, 2));
if (process.env.NODE_ENV === 'production' && (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM || !process.env.TOKEN_PEPPER || !process.env.APP_BASE_URL)) {
  throw new Error('Production requires RESEND_API_KEY, MAIL_FROM, TOKEN_PEPPER and APP_BASE_URL.');
}
let db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
for (const key of ['users', 'sessions', 'consents', 'audit']) db[key] ||= [];
let dataUpgraded = false;
for (const session of db.sessions) {
  if (session.token && !session.tokenHash) { session.tokenHash = crypto.createHmac('sha256', TOKEN_PEPPER).update(session.token).digest('hex'); delete session.token; dataUpgraded = true; }
}
for (const account of db.users) {
  if (account.verifyToken && !account.verifyTokenHash) { account.verifyTokenHash = crypto.createHmac('sha256', TOKEN_PEPPER).update(account.verifyToken).digest('hex'); delete account.verifyToken; dataUpgraded = true; }
  if (account.resetToken && !account.resetTokenHash) { account.resetTokenHash = crypto.createHmac('sha256', TOKEN_PEPPER).update(account.resetToken).digest('hex'); delete account.resetToken; dataUpgraded = true; }
  if (account.profile) for (const key of ['education', 'desiredRoles', 'jobTypes', 'experiences', 'projects', 'languages', 'skills']) account.profile[key] ||= [];
}
const attempts = new Map();
const requestWindows = new Map();
const categories = {
  industries: ['Công nghệ thông tin', 'Tài chính - Ngân hàng', 'Marketing', 'Thiết kế', 'Kinh doanh', 'Giáo dục', 'Kỹ thuật'],
  schools: ['Đại học Bách khoa Hà Nội', 'Đại học Công nghệ - ĐHQGHN', 'Đại học Kinh tế Quốc dân', 'Đại học Bách khoa TP.HCM', 'Đại học FPT', 'Khác'],
  locations: ['Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Cần Thơ', 'Remote'],
  skills: skillTaxonomy.map(skill => skill.name)
};
const tokenHash = token => crypto.createHmac('sha256', TOKEN_PEPPER).update(String(token)).digest('hex');
const boundedList = (value, maxItems = 30, maxLength = 160) => Array.isArray(value)
  ? [...new Set(value.map(item => cleanText(item, maxLength)).filter(Boolean))].slice(0, maxItems) : [];
function normalizeSkill(value) {
  const normalize = text => cleanText(text, 80).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const normalized = normalize(value);
  const found = skillTaxonomy.find(skill => [skill.name, ...skill.aliases].some(alias => normalize(alias) === normalized));
  return found?.name || cleanText(value, 80);
}

function save() {
  const temporary = `${DB_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(db, null, 2), { mode: 0o600 });
  fs.renameSync(temporary, DB_FILE);
}
if (dataUpgraded) save();
async function sendMail(to, subject, html) {
  if (!process.env.RESEND_API_KEY) return false;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, html })
  });
  if (!response.ok) throw new Error(`Email provider returned ${response.status}.`);
  return true;
}
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (err, key) => err ? reject(err) : resolve(`${salt}:${key.toString('hex')}`)));
}
async function verifyPassword(password, stored) {
  const [salt, keyHex] = String(stored || '').split(':');
  if (!salt || !keyHex) return false;
  const actual = await hashPassword(password, salt);
  const expected = Buffer.from(keyHex, 'hex');
  const supplied = Buffer.from(actual.split(':')[1], 'hex');
  return expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
}
function json(res, status, body, extraHeaders = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders });
  res.end(JSON.stringify(body));
}
function audit(userId, action, entity = 'account') {
  db.audit.push({ id: crypto.randomUUID(), userId, action, entity, at: new Date().toISOString() });
  if (db.audit.length > 5000) db.audit = db.audit.slice(-5000);
}
function publicUser(user) {
  return { id: user.id, email: user.email, role: user.role, verified: Boolean(user.verified), profile: user.profile || {} };
}
function cookieValue(req, name) {
  const pair = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : '';
}
function authUser(req) {
  const token = cookieValue(req, 'sid');
  const session = db.sessions.find(s => (s.tokenHash === tokenHash(token) || s.token === token) && s.expiresAt > Date.now());
  return session ? db.users.find(u => u.id === session.userId) : null;
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 100_000) reject(new Error('Dữ liệu gửi lên quá lớn.')); });
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error('Dữ liệu JSON không hợp lệ.')); } });
    req.on('error', reject);
  });
}
function cleanText(value, max = 500) { return String(value || '').trim().slice(0, max); }
function emailValid(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function sessionCookie(token) { return `sid=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`; }
function clearCookie() { return `sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`; }

async function api(req, res, url) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const key = `${req.socket.remoteAddress}:${req.method}:${url.pathname}`;
    const bucket = requestWindows.get(key) || { count: 0, resetAt: Date.now() + 60_000 };
    if (bucket.resetAt <= Date.now()) { bucket.count = 0; bucket.resetAt = Date.now() + 60_000; }
    bucket.count += 1; requestWindows.set(key, bucket);
    if (bucket.count > 120) return json(res, 429, { error: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.' });
  }
  const user = authUser(req);
  if (req.method === 'GET' && url.pathname === '/api/categories') return json(res, 200, categories);
  if (req.method === 'POST' && url.pathname === '/api/skills/normalize') {
    const body = await readBody(req);
    if (!Array.isArray(body.skills) || body.skills.length > 100) return json(res, 400, { error: 'skills cần là danh sách tối đa 100 phần tử.' });
    return json(res, 200, { skills: [...new Set(body.skills.map(normalizeSkill).filter(Boolean))] });
  }
  if (req.method === 'GET' && url.pathname === '/api/me') return json(res, 200, { user: user ? publicUser(user) : null });
  if (req.method === 'POST' && url.pathname === '/api/register') {
    const body = await readBody(req);
    const email = cleanText(body.email, 254).toLowerCase();
    const name = cleanText(body.name, 100);
    const password = String(body.password || '');
    const role = body.role === 'employer' ? 'employer' : 'student';
    if (!name || !emailValid(email) || password.length < 8 || password.length > 128 || body.consent !== true)
      return json(res, 400, { error: 'Vui lòng điền tên, email hợp lệ, mật khẩu từ 8 ký tự và xác nhận đồng ý xử lý dữ liệu.' });
    if (db.users.some(u => u.email === email)) return json(res, 409, { error: 'Email này đã được đăng ký.' });
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const newUser = { id: crypto.randomUUID(), email, name, role, passwordHash: await hashPassword(password), verified: false, verifyTokenHash: tokenHash(verifyToken), verifyExpiresAt: Date.now() + 15 * 60_000, profile: { fullName: name, skills: [], education: [], experiences: [], projects: [], languages: [], desiredRoles: [], jobTypes: [] }, createdAt: new Date().toISOString() };
    db.users.push(newUser);
    db.consents.push({ id: crypto.randomUUID(), userId: newUser.id, purpose: 'account_profile', granted: true, version: '1.0', at: new Date().toISOString() });
    audit(newUser.id, 'account.register'); save();
    const verifyUrl = `${APP_BASE_URL}/?verify=${verifyToken}`;
    try { await sendMail(email, 'Xác minh email Ketnoi', `<p>Chào ${name},</p><p><a href="${verifyUrl}">Xác minh email</a> · Liên kết có hiệu lực 15 phút.</p>`); }
    catch (error) { console.error(JSON.stringify({ event: 'email.delivery_failed', purpose: 'verify', error: error.message })); return json(res, 503, { error: 'Chưa gửi được email xác minh. Vui lòng thử lại sau.' }); }
    return json(res, 201, { message: 'Tài khoản đã tạo. Xác minh email để bắt đầu.', ...(process.env.NODE_ENV !== 'production' && !process.env.RESEND_API_KEY ? { devVerifyUrl: verifyUrl } : {}) });
  }
  if (req.method === 'GET' && url.pathname === '/api/verify') {
    const account = db.users.find(u => u.verifyTokenHash && u.verifyExpiresAt > Date.now() && u.verifyTokenHash === tokenHash(url.searchParams.get('token')));
    if (!account) return json(res, 400, { error: 'Liên kết xác minh không hợp lệ hoặc đã được sử dụng.' });
    account.verified = true; delete account.verifyTokenHash; delete account.verifyExpiresAt; audit(account.id, 'account.verify'); save();
    return json(res, 200, { message: 'Email đã xác minh. Bạn có thể đăng nhập.' });
  }
  if (req.method === 'POST' && url.pathname === '/api/resend-verification') {
    const body = await readBody(req);
    const email = cleanText(body.email, 254).toLowerCase();
    const account = db.users.find(item => item.email === email && !item.verified && !item.deletedAt);
    if (!emailValid(email)) return json(res, 400, { error: 'Vui lòng nhập email hợp lệ.' });
    if (!account) return json(res, 200, { message: 'Nếu tài khoản cần xác minh, liên kết mới sẽ được gửi.' });
    const verifyToken = crypto.randomBytes(32).toString('hex');
    account.verifyTokenHash = tokenHash(verifyToken); account.verifyExpiresAt = Date.now() + 15 * 60_000; save();
    const verifyUrl = `${APP_BASE_URL}/?verify=${verifyToken}`;
    try { await sendMail(email, 'Xác minh email Ketnoi', `<p><a href="${verifyUrl}">Xác minh email</a> · Liên kết có hiệu lực 15 phút.</p>`); }
    catch (error) { console.error(JSON.stringify({ event: 'email.delivery_failed', purpose: 'verify_resend', error: error.message })); }
    return json(res, 200, { message: 'Nếu tài khoản cần xác minh, liên kết mới sẽ được gửi.', ...(process.env.NODE_ENV !== 'production' && !process.env.RESEND_API_KEY ? { devVerifyUrl: verifyUrl } : {}) });
  }
  if (req.method === 'POST' && url.pathname === '/api/forgot-password') {
    const body = await readBody(req);
    const email = cleanText(body.email, 254).toLowerCase();
    const account = db.users.find(u => u.email === email && !u.deletedAt);
    if (!emailValid(email)) return json(res, 400, { error: 'Vui lòng nhập email hợp lệ.' });
    if (!account) return json(res, 200, { message: 'Nếu email đã đăng ký, hướng dẫn đặt lại sẽ được gửi.' });
    const resetToken = crypto.randomBytes(32).toString('hex');
    account.resetTokenHash = tokenHash(resetToken);
    account.resetExpiresAt = Date.now() + 15 * 60_000;
    save();
    const resetUrl = `${APP_BASE_URL}/?reset=${resetToken}`;
    try { await sendMail(email, 'Đặt lại mật khẩu Ketnoi', `<p><a href="${resetUrl}">Tạo mật khẩu mới</a> · Liên kết có hiệu lực 15 phút.</p>`); }
    catch (error) { console.error(JSON.stringify({ event: 'email.delivery_failed', purpose: 'password_reset', error: error.message })); }
    return json(res, 200, { message: 'Nếu email đã đăng ký, hướng dẫn đặt lại sẽ được gửi.', ...(process.env.NODE_ENV !== 'production' && !process.env.RESEND_API_KEY ? { devResetUrl: resetUrl } : {}) });
  }
  if (req.method === 'POST' && url.pathname === '/api/reset-password') {
    const body = await readBody(req);
    const account = db.users.find(u => u.resetTokenHash && u.resetTokenHash === tokenHash(body.token) && u.resetExpiresAt > Date.now());
    if (!account) return json(res, 400, { error: 'Liên kết đặt lại không hợp lệ hoặc đã hết hạn.' });
    if (String(body.password || '').length < 8 || String(body.password).length > 128) return json(res, 400, { error: 'Mật khẩu cần có từ 8 đến 128 ký tự.' });
    account.passwordHash = await hashPassword(String(body.password)); delete account.resetToken; delete account.resetTokenHash; delete account.resetExpiresAt;
    db.sessions = db.sessions.filter(s => s.userId !== account.id); audit(account.id, 'account.password_reset'); save();
    return json(res, 200, { message: 'Mật khẩu đã được đặt lại. Bạn có thể đăng nhập.' });
  }
  if (req.method === 'POST' && url.pathname === '/api/login') {
    const body = await readBody(req);
    const email = cleanText(body.email, 254).toLowerCase();
    const key = `${req.socket.remoteAddress}:${email}`;
    const entry = attempts.get(key) || { count: 0, until: 0 };
    if (entry.until > Date.now()) { audit(null, 'account.login_locked'); save(); return json(res, 429, { error: 'Tài khoản tạm khóa do đăng nhập sai nhiều lần. Thử lại sau 15 phút.' }); }
    const account = db.users.find(u => u.email === email && !u.deletedAt);
    if (!account || !(await verifyPassword(String(body.password || ''), account.passwordHash))) {
      entry.count += 1;
      if (entry.count >= 5) { entry.count = 0; entry.until = Date.now() + 15 * 60_000; }
      attempts.set(key, entry); audit(account?.id || null, 'account.login_failed'); save(); return json(res, 401, { error: 'Email hoặc mật khẩu chưa chính xác.' });
    }
    attempts.delete(key);
    if (!account.verified) return json(res, 403, { error: 'Hãy xác minh email trước khi đăng nhập.' });
    const token = crypto.randomBytes(32).toString('hex');
    db.sessions = db.sessions.filter(s => s.expiresAt > Date.now() && s.userId !== account.id);
    db.sessions.push({ tokenHash: tokenHash(token), userId: account.id, expiresAt: Date.now() + 7 * 24 * 60 * 60_000 });
    audit(account.id, 'account.login'); save();
    return json(res, 200, { user: publicUser(account) }, { 'Set-Cookie': sessionCookie(token) });
  }
  if (req.method === 'POST' && url.pathname === '/api/logout') {
    if (user) { db.sessions = db.sessions.filter(s => s.userId !== user.id); audit(user.id, 'account.logout'); save(); }
    return json(res, 200, { message: 'Đã đăng xuất.' }, { 'Set-Cookie': clearCookie() });
  }
  if (req.method === 'POST' && url.pathname === '/api/refresh') {
    if (!user) return json(res, 401, { error: 'Phiên đăng nhập đã hết hạn.' }, { 'Set-Cookie': clearCookie() });
    const currentToken = cookieValue(req, 'sid');
    const session = db.sessions.find(item => (item.tokenHash === tokenHash(currentToken) || item.token === currentToken) && item.userId === user.id);
    if (!session) return json(res, 401, { error: 'Phiên đăng nhập đã hết hạn.' }, { 'Set-Cookie': clearCookie() });
    const nextToken = crypto.randomBytes(32).toString('hex');
    delete session.token;
    session.tokenHash = tokenHash(nextToken);
    session.expiresAt = Date.now() + 7 * 24 * 60 * 60_000;
    save();
    return json(res, 200, { user: publicUser(user) }, { 'Set-Cookie': sessionCookie(nextToken) });
  }
  if (!user) return json(res, 401, { error: 'Vui lòng đăng nhập.' });
  if (req.method === 'GET' && url.pathname === '/api/consents') {
    return json(res, 200, { consents: db.consents.filter(item => item.userId === user.id) });
  }
  if (req.method === 'POST' && url.pathname === '/api/consents') {
    const body = await readBody(req);
    const purpose = cleanText(body.purpose, 80);
    if (!['account_profile', 'matching', 'model_evaluation'].includes(purpose) || typeof body.granted !== 'boolean') {
      return json(res, 400, { error: 'Mục đích hoặc trạng thái đồng ý không hợp lệ.' });
    }
    const consent = { id: crypto.randomUUID(), userId: user.id, purpose, granted: body.granted, version: cleanText(body.version || '1.0', 20), at: new Date().toISOString() };
    db.consents.push(consent); audit(user.id, 'consent.change', purpose); save();
    return json(res, 201, { consent });
  }
  if (req.method === 'POST' && url.pathname === '/api/change-password') {
    const body = await readBody(req);
    if (!(await verifyPassword(String(body.currentPassword || ''), user.passwordHash))) return json(res, 400, { error: 'Mật khẩu hiện tại chưa chính xác.' });
    if (String(body.password || '').length < 8 || String(body.password).length > 128) return json(res, 400, { error: 'Mật khẩu mới cần có từ 8 đến 128 ký tự.' });
    user.passwordHash = await hashPassword(String(body.password)); db.sessions = db.sessions.filter(s => s.userId !== user.id); audit(user.id, 'account.password_change'); save();
    return json(res, 200, { message: 'Đã đổi mật khẩu. Vui lòng đăng nhập lại.' }, { 'Set-Cookie': clearCookie() });
  }
  if (req.method === 'POST' && url.pathname === '/api/change-email') {
    const body = await readBody(req);
    const email = cleanText(body.email, 254).toLowerCase();
    if (!(await verifyPassword(String(body.password || ''), user.passwordHash))) return json(res, 400, { error: 'Mật khẩu chưa chính xác.' });
    if (!emailValid(email)) return json(res, 400, { error: 'Email mới chưa hợp lệ.' });
    if (db.users.some(u => u.email === email && u.id !== user.id)) return json(res, 409, { error: 'Email này đã được sử dụng.' });
    const verifyToken = crypto.randomBytes(32).toString('hex');
    user.email = email; user.verified = false; user.verifyTokenHash = tokenHash(verifyToken); user.verifyExpiresAt = Date.now() + 15 * 60_000;
    audit(user.id, 'account.email_change'); db.sessions = db.sessions.filter(s => s.userId !== user.id); save();
    const verifyUrl = `${APP_BASE_URL}/?verify=${verifyToken}`;
    try { await sendMail(email, 'Xác minh email Ketnoi', `<p><a href="${verifyUrl}">Xác minh email mới</a> · Liên kết có hiệu lực 15 phút.</p>`); }
    catch (error) { console.error(JSON.stringify({ event: 'email.delivery_failed', purpose: 'email_change', error: error.message })); }
    return json(res, 200, { message: 'Email đã được cập nhật; cần xác minh lại.', ...(process.env.NODE_ENV !== 'production' && !process.env.RESEND_API_KEY ? { devVerifyUrl: verifyUrl } : {}) }, { 'Set-Cookie': clearCookie() });
  }
  if (req.method === 'GET' && url.pathname === '/api/profile') {
    if (user.role !== 'student') return json(res, 403, { error: 'Hồ sơ sinh viên chỉ dành cho tài khoản sinh viên.' });
    return json(res, 200, { profile: user.profile });
  }
  if (['PUT', 'PATCH'].includes(req.method) && url.pathname === '/api/profile') {
    if (user.role !== 'student') return json(res, 403, { error: 'Hồ sơ sinh viên chỉ dành cho tài khoản sinh viên.' });
    const body = await readBody(req);
    const profile = req.method === 'PATCH' ? { ...user.profile, ...(body.profile || {}) } : (body.profile || {});
    const fullName = cleanText(profile.fullName, 100);
    const phone = cleanText(profile.phone, 20);
    if (!fullName) return json(res, 400, { error: 'Họ và tên không được để trống.' });
    if (phone && !/^[+0-9() .-]{8,20}$/.test(phone)) return json(res, 400, { error: 'Số điện thoại chưa đúng định dạng.' });
    const gradYear = cleanText(profile.gradYear, 4);
    const gpa = cleanText(profile.gpa, 8);
    if (gradYear && (!/^\d{4}$/.test(gradYear) || Number(gradYear) < 1950 || Number(gradYear) > 2200)) return json(res, 400, { error: 'Năm tốt nghiệp cần nằm trong khoảng 1950–2200.' });
    if (gpa && !/^(?:[0-3](?:\.\d{1,2})?|4(?:\.0{1,2})?)$/.test(gpa)) return json(res, 400, { error: 'GPA cần nằm trong khoảng 0.00–4.00.' });
    user.profile = {
      fullName, phone, industry: cleanText(profile.industry, 120), school: cleanText(profile.school, 160), major: cleanText(profile.major, 120),
      gradYear, gpa, location: cleanText(profile.location, 100),
      bio: cleanText(profile.bio, 1000), desiredRoles: boundedList(profile.desiredRoles, 10, 120), jobTypes: boundedList(profile.jobTypes, 5, 50),
      education: boundedList(profile.education), skills: boundedList(profile.skills, 40, 80).map(normalizeSkill), experiences: boundedList(profile.experiences), projects: boundedList(profile.projects), languages: boundedList(profile.languages, 10, 80),
      onboardingCompleted: Boolean(profile.onboardingCompleted),
      visibility: ['public', 'invited', 'private'].includes(profile.visibility) ? profile.visibility : 'private', updatedAt: new Date().toISOString()
    };
    audit(user.id, 'profile.update', 'student_profile'); save();
    return json(res, 200, { profile: user.profile });
  }
  if (req.method === 'DELETE' && url.pathname === '/api/account') {
    const body = await readBody(req);
    if (body.confirm !== true) return json(res, 400, { error: 'Cần xác nhận xóa tài khoản.' });
    user.deletedAt = new Date().toISOString(); user.email = `deleted-${user.id}@invalid.local`; user.name = 'Tài khoản đã xóa'; user.profile = {};
    db.sessions = db.sessions.filter(s => s.userId !== user.id); audit(user.id, 'account.delete'); save();
    return json(res, 200, { message: 'Tài khoản đã được xóa mềm.' }, { 'Set-Cookie': clearCookie() });
  }
  return json(res, 404, { error: 'Không tìm thấy API.' });
}

const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const requestId = crypto.randomUUID();
  const startedAt = process.hrtime.bigint();
  res.setHeader('X-Request-Id', requestId);
  res.on('finish', () => console.log(JSON.stringify({ event: 'http.request', requestId, method: req.method, path: url.pathname, status: res.statusCode, durationMs: Number(process.hrtime.bigint() - startedAt) / 1e6 })));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed.' });
    const isSprintAsset = url.pathname === '/sprint1/app.js';
    const assetRoot = isSprintAsset ? __dirname : PUBLIC;
    const requested = isSprintAsset ? 'app.js' : url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    const target = path.resolve(assetRoot, requested);
    if (!target.startsWith(`${assetRoot}${path.sep}`) && target !== path.join(PUBLIC, 'index.html')) return json(res, 403, { error: 'Forbidden.' });
    fs.readFile(target, (err, content) => {
      if (err) return json(res, 404, { error: 'Không tìm thấy trang.' });
      res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream' });
      res.end(req.method === 'HEAD' ? undefined : content);
    });
  } catch (error) {
    console.error(JSON.stringify({ event: 'request.failed', requestId, method: req.method, path: url.pathname, error: error.message }));
    json(res, 500, { error: 'Lỗi máy chủ. Vui lòng thử lại sau.' });
  }
});
server.listen(PORT, () => console.log(`Ứng dụng đang chạy tại http://localhost:${PORT}`));
