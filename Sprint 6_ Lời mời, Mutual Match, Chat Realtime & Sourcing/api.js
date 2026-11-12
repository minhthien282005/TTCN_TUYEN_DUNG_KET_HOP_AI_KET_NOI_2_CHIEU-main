'use strict';

const crypto = require('node:crypto');

const text = (value, max = 500) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const norm = value => text(value, 2000).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();
const respond = (res, status, body) => { if (res.writableEnded) return; res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
const companyFor = (db, user) => (db.companies || []).find(item => item.ownerId === user.id);
const userName = user => text(user?.profile?.fullName || user?.name || user?.email?.split('@')[0] || 'Thành viên', 100);
const publicCompany = company => ({ id: company.id, name: company.name, logo: company.logo || '', website: company.website || '' });
const liveJob = (db, id) => {
  const job = (db.jobs || []).find(item => item.id === id && item.status === 'published' && (!item.expiresAt || Date.parse(item.expiresAt) > Date.now()));
  const company = job && (db.companies || []).find(item => item.id === job.companyId && item.verificationStatus === 'verified');
  return job && company ? { job, company } : null;
};
const blocked = (db, left, right) => (db.sprint6Blocks || []).some(item => (item.blockerId === left && item.blockedId === right) || (item.blockerId === right && item.blockedId === left));
const person = (db, id) => (db.users || []).find(item => item.id === id && !item.deletedAt && !item.lockedAt);

function notify(db, userId, title, message, href) {
  db.notifications ||= [];
  db.notifications.push({ id: crypto.randomUUID(), userId, type: 'sprint6.connection', title: text(title, 140), message: text(message, 500), href, readAt: null, createdAt: new Date().toISOString() });
  if (db.notifications.length > 20_000) db.notifications = db.notifications.slice(-20_000);
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0; let settled = false;
    req.on('data', chunk => { size += chunk.length; if (size > 20_000 && !settled) { settled = true; reject(Object.assign(new Error('Dữ liệu gửi lên vượt giới hạn.'), { status: 413 })); } else if (!settled) chunks.push(chunk); });
    req.on('end', () => { if (settled) return; try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { reject(Object.assign(new Error('Dữ liệu JSON không hợp lệ.'), { status: 400 })); } });
    req.on('error', error => { if (!settled) reject(error); });
  });
}

function makeConversation(db, match) {
  let conversation = db.sprint6Conversations.find(item => item.matchId === match.id);
  if (!conversation) {
    conversation = { id: crypto.randomUUID(), matchId: match.id, participantIds: [match.studentId, match.employerId], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), lastMessageAt: null, readAt: {} };
    db.sprint6Conversations.push(conversation);
  }
  return conversation;
}

function makeMatch(db, { studentId, employerId, jobId, invitationId = null, interestId = null }) {
  let match = db.sprint6Matches.find(item => item.studentId === studentId && item.employerId === employerId && item.jobId === jobId && item.status === 'active');
  if (!match) {
    const job = (db.jobs || []).find(item => item.id === jobId);
    match = { id: crypto.randomUUID(), studentId, employerId, companyId: job?.companyId || null, jobId, invitationId, interestId, status: 'active', createdAt: new Date().toISOString() };
    db.sprint6Matches.push(match);
    const conversation = makeConversation(db, match);
    notify(db, studentId, 'Đã kết nối với nhà tuyển dụng', 'Hai bên đã đồng ý kết nối. Bạn có thể bắt đầu trò chuyện.', `/network.html?conversation=${conversation.id}`);
    notify(db, employerId, 'Đã kết nối với ứng viên', 'Ứng viên đã đồng ý kết nối. Bạn có thể bắt đầu trò chuyện.', `/network.html?conversation=${conversation.id}`);
  }
  return match;
}

function publicProfile(user) {
  const p = user.profile || {};
  return { id: user.id, name: userName(user), major: text(p.major, 120), school: text(p.school, 160), location: text(p.location, 100), bio: text(p.bio, 500), desiredRoles: (p.desiredRoles || []).slice(0, 8), skills: (p.skills || []).slice(0, 16) };
}

const streamClients = new Map();
function closeUserStreams(userId) {
  const clients = streamClients.get(userId);
  if (!clients) return;
  for (const client of clients) { try { client.end(); } catch { /* closed connection */ } }
  streamClients.delete(userId);
}
function publish(userIds, event, data) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const userId of userIds) for (const client of streamClients.get(userId) || []) {
    try { client.write(message); } catch { /* closed connection */ }
  }
}

module.exports = {
  closeUserStreams,
  handleRequest(req, res, url, user, { db, save, audit }) {
    if (!url.pathname.startsWith('/api/sprint6/')) return null;
    for (const key of ['sprint6Invitations', 'sprint6Interests', 'sprint6Matches', 'sprint6Conversations', 'sprint6Messages', 'sprint6Blocks', 'notifications']) db[key] ||= [];
    let expiredChanged = false;
    for (const item of [...db.sprint6Invitations, ...db.sprint6Interests]) if (item.status === 'pending' && Date.parse(item.expiresAt) <= Date.now()) { item.status = 'expired'; item.respondedAt = new Date().toISOString(); expiredChanged = true; }
    if (expiredChanged) save();
    if (!user || !['student', 'employer'].includes(user.role)) return respond(res, user ? 403 : 401, { error: 'Đăng nhập bằng tài khoản sinh viên hoặc nhà tuyển dụng để tiếp tục.' });
    const isStudent = user.role === 'student';
    const path = url.pathname;
    const read = () => readBody(req).catch(error => { respond(res, error.status || 400, { error: error.message }); return null; });

    if (req.method === 'GET' && path === '/api/sprint6/jobs') {
      if (!isStudent) return respond(res, 403, { error: 'Danh sách quan tâm này dành cho sinh viên.' });
      const jobs = (db.jobs || []).filter(job => liveJob(db, job.id)).slice(0, 60).map(job => {
        const company = (db.companies || []).find(item => item.id === job.companyId);
        const state = db.sprint6Interests.find(item => item.studentId === user.id && item.jobId === job.id && ['pending', 'accepted'].includes(item.status));
        return { id: job.id, title: job.title, company: company?.name || 'Doanh nghiệp', location: job.location || '', alreadyInterested: Boolean(state) };
      });
      return respond(res, 200, { jobs });
    }

    if (req.method === 'GET' && path === '/api/sprint6/sourcing') {
      if (isStudent) return respond(res, 403, { error: 'Tìm ứng viên dành cho nhà tuyển dụng.' });
      const company = companyFor(db, user);
      if (!company || company.verificationStatus !== 'verified') return respond(res, 403, { error: 'Cần hồ sơ doanh nghiệp đã xác minh để tìm ứng viên.' });
      const q = norm(url.searchParams.get('q')); const location = norm(url.searchParams.get('location')); const skill = norm(url.searchParams.get('skill'));
      const alreadyApplied = new Set((db.applications || []).filter(item => (db.jobs || []).some(job => job.companyId === company.id && job.id === item.jobId)).map(item => item.studentId));
      const candidates = (db.users || []).filter(candidate => candidate.role === 'student' && !candidate.deletedAt && !candidate.lockedAt && candidate.profile?.visibility === 'public' && !alreadyApplied.has(candidate.id) && !blocked(db, user.id, candidate.id))
        .map(candidate => ({ candidate, profile: publicProfile(candidate) }))
        .filter(({ profile }) => (!q || norm(`${profile.name} ${profile.major} ${profile.school} ${profile.desiredRoles.join(' ')} ${profile.skills.join(' ')}`).includes(q)) && (!location || norm(profile.location).includes(location)) && (!skill || profile.skills.some(value => norm(value).includes(skill))))
        .slice(0, 100).map(({ candidate, profile }) => ({ ...profile, invitationSent: db.sprint6Invitations.some(item => item.employerId === user.id && item.studentId === candidate.id && item.status === 'pending') }));
      return respond(res, 200, { candidates, jobs: (db.jobs || []).filter(job => job.status === 'published' && job.companyId === company.id).map(job => ({ id: job.id, title: job.title })) });
    }

    if (req.method === 'POST' && path === '/api/sprint6/invitations') return read().then(body => {
      if (!body) return;
      if (isStudent) return respond(res, 403, { error: 'Sinh viên gửi quan tâm qua mục kết nối.' });
      const company = companyFor(db, user); const job = liveJob(db, text(body.jobId, 80)); const candidate = person(db, text(body.studentId, 80));
      if (!company || company.verificationStatus !== 'verified') return respond(res, 403, { error: 'Doanh nghiệp cần được xác minh.' });
      if (!job || job.job.companyId !== company.id) return respond(res, 400, { error: 'Chọn tin đang tuyển của doanh nghiệp bạn.' });
      if (!candidate || candidate.role !== 'student' || candidate.profile?.visibility !== 'public' || blocked(db, user.id, candidate.id)) return respond(res, 404, { error: 'Không tìm thấy hồ sơ công khai phù hợp.' });
      const recent = db.sprint6Invitations.filter(item => item.employerId === user.id && Date.parse(item.createdAt) > Date.now() - 86_400_000).length;
      if (recent >= 30) return respond(res, 429, { error: 'Bạn đã đạt giới hạn 30 lời mời mỗi ngày.' });
      if (db.sprint6Invitations.some(item => item.jobId === job.job.id && item.studentId === candidate.id && ['pending', 'accepted'].includes(item.status)) || db.sprint6Matches.some(item => item.jobId === job.job.id && item.studentId === candidate.id && item.status === 'active')) return respond(res, 409, { error: 'Đã có lời mời hoặc kết nối cho tin này.' });
      const invitation = { id: crypto.randomUUID(), studentId: candidate.id, employerId: user.id, companyId: company.id, jobId: job.job.id, message: text(body.message, 500), status: 'pending', createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 14 * 86_400_000).toISOString() };
      db.sprint6Invitations.push(invitation); notify(db, candidate.id, 'Lời mời trao đổi công việc', `${company.name} mời bạn trao đổi về vị trí ${job.job.title}.`, '/network.html'); audit?.(user.id, 'sprint6.invitation.created', 'sprint6'); save();
      return respond(res, 201, { invitation });
    });

    if (req.method === 'GET' && path === '/api/sprint6/invitations') {
      const items = db.sprint6Invitations.filter(item => isStudent ? item.studentId === user.id : item.employerId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(item => {
        const job = (db.jobs || []).find(value => value.id === item.jobId); const company = (db.companies || []).find(value => value.id === item.companyId); const other = person(db, isStudent ? item.employerId : item.studentId);
        return { ...item, jobTitle: job?.title || 'Vị trí tuyển dụng', company: company ? publicCompany(company) : null, candidate: !isStudent && other ? publicProfile(other) : undefined };
      });
      const interests = db.sprint6Interests.filter(item => isStudent ? item.studentId === user.id : item.employerId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(item => {
        const job = (db.jobs || []).find(value => value.id === item.jobId); const company = (db.companies || []).find(value => value.id === item.companyId); const candidate = person(db, item.studentId);
        return { ...item, jobTitle: job?.title || 'Vị trí tuyển dụng', company: company ? publicCompany(company) : null, candidate: !isStudent && candidate ? publicProfile(candidate) : undefined };
      });
      return respond(res, 200, { invitations: items, interests });
    }

    const invitationRespond = path.match(/^\/api\/sprint6\/invitations\/([\w-]+)\/respond$/);
    if (req.method === 'POST' && invitationRespond) return read().then(body => {
      if (!body) return;
      const item = db.sprint6Invitations.find(value => value.id === invitationRespond[1] && value.studentId === user.id);
      if (!isStudent) return respond(res, 403, { error: 'Chỉ sinh viên được phản hồi lời mời.' });
      if (!item || item.status !== 'pending' || Date.parse(item.expiresAt) <= Date.now()) return respond(res, 404, { error: 'Lời mời không còn hiệu lực.' });
      if (!['accept', 'decline'].includes(body.action)) return respond(res, 400, { error: 'Chọn đồng ý hoặc từ chối.' });
      item.status = body.action === 'accept' ? 'accepted' : 'declined'; item.respondedAt = new Date().toISOString();
      let match = null;
      if (body.action === 'accept') match = makeMatch(db, { studentId: item.studentId, employerId: item.employerId, jobId: item.jobId, invitationId: item.id });
      else notify(db, item.employerId, 'Ứng viên đã phản hồi', `${userName(user)} đã từ chối lời mời trao đổi.`, '/network.html');
      audit?.(user.id, `sprint6.invitation.${item.status}`, 'sprint6'); save();
      return respond(res, 200, { invitation: item, match });
    });

    if (req.method === 'POST' && path === '/api/sprint6/interests') return read().then(body => {
      if (!body) return;
      if (!isStudent) return respond(res, 403, { error: 'Chỉ sinh viên gửi quan tâm tới công việc.' });
      const found = liveJob(db, text(body.jobId, 80));
      if (!found || blocked(db, user.id, found.company.ownerId)) return respond(res, 404, { error: 'Không tìm thấy công việc đang tuyển.' });
      if (db.sprint6Interests.some(item => item.studentId === user.id && item.jobId === found.job.id && item.status === 'pending') || db.sprint6Matches.some(item => item.studentId === user.id && item.jobId === found.job.id && item.status === 'active')) return respond(res, 409, { error: 'Bạn đã gửi quan tâm hoặc đã kết nối với công việc này.' });
      const interest = { id: crypto.randomUUID(), studentId: user.id, employerId: found.company.ownerId, companyId: found.company.id, jobId: found.job.id, message: text(body.message, 500), status: 'pending', createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 14 * 86_400_000).toISOString() };
      db.sprint6Interests.push(interest); notify(db, found.company.ownerId, 'Ứng viên quan tâm đến công việc', `${userName(user)} muốn trao đổi về vị trí ${found.job.title}.`, '/network.html'); audit?.(user.id, 'sprint6.interest.created', 'sprint6'); save();
      return respond(res, 201, { interest });
    });

    const interestRespond = path.match(/^\/api\/sprint6\/interests\/([\w-]+)\/respond$/);
    if (req.method === 'POST' && interestRespond) return read().then(body => {
      if (!body) return;
      const item = db.sprint6Interests.find(value => value.id === interestRespond[1] && value.employerId === user.id);
      if (isStudent) return respond(res, 403, { error: 'Chỉ nhà tuyển dụng được phản hồi quan tâm.' });
      if (!item || item.status !== 'pending' || Date.parse(item.expiresAt) <= Date.now()) return respond(res, 404, { error: 'Lời quan tâm không còn hiệu lực.' });
      if (!['accept', 'decline'].includes(body.action)) return respond(res, 400, { error: 'Chọn đồng ý hoặc từ chối.' });
      item.status = body.action === 'accept' ? 'accepted' : 'declined'; item.respondedAt = new Date().toISOString();
      let match = null;
      if (body.action === 'accept') match = makeMatch(db, { studentId: item.studentId, employerId: item.employerId, jobId: item.jobId, interestId: item.id });
      else notify(db, item.studentId, 'Nhà tuyển dụng đã phản hồi', 'Nhà tuyển dụng đã phản hồi lời quan tâm của bạn.', '/network.html');
      audit?.(user.id, `sprint6.interest.${item.status}`, 'sprint6'); save();
      return respond(res, 200, { interest: item, match });
    });

    if (req.method === 'GET' && path === '/api/sprint6/matches') {
      const matches = db.sprint6Matches.filter(item => item.status === 'active' && (isStudent ? item.studentId === user.id : item.employerId === user.id)).map(item => {
        const candidate = person(db, item.studentId); const job = (db.jobs || []).find(value => value.id === item.jobId); const company = (db.companies || []).find(value => value.id === item.companyId); const conversation = db.sprint6Conversations.find(value => value.matchId === item.id);
        return { id: item.id, jobId: item.jobId, jobTitle: job?.title || 'Vị trí tuyển dụng', candidate: isStudent ? undefined : candidate ? publicProfile(candidate) : null, company: isStudent && company ? publicCompany(company) : undefined, conversationId: conversation?.id || null, createdAt: item.createdAt };
      });
      return respond(res, 200, { matches });
    }

    if (req.method === 'GET' && path === '/api/sprint6/conversations') {
      const conversations = db.sprint6Conversations.filter(item => item.participantIds.includes(user.id)).sort((a, b) => (b.lastMessageAt || b.createdAt).localeCompare(a.lastMessageAt || a.createdAt)).map(item => {
        const match = db.sprint6Matches.find(value => value.id === item.matchId); const other = person(db, isStudent ? match?.employerId : match?.studentId); const job = (db.jobs || []).find(value => value.id === match?.jobId); const messages = db.sprint6Messages.filter(value => value.conversationId === item.id);
        const last = messages[messages.length - 1];
        return { id: item.id, jobTitle: job?.title || 'Vị trí tuyển dụng', otherName: isStudent ? (db.companies || []).find(value => value.ownerId === other?.id)?.name || userName(other) : userName(other), lastMessage: last?.body || '', lastMessageAt: item.lastMessageAt, unread: messages.filter(value => value.senderId !== user.id && Date.parse(value.createdAt) > Date.parse(item.readAt?.[user.id] || '')).length };
      });
      return respond(res, 200, { conversations });
    }

    const conversationId = path.match(/^\/api\/sprint6\/conversations\/([\w-]+)$/);
    if (req.method === 'GET' && conversationId) {
      const conversation = db.sprint6Conversations.find(item => item.id === conversationId[1] && item.participantIds.includes(user.id));
      if (!conversation) return respond(res, 404, { error: 'Không tìm thấy cuộc trò chuyện.' });
      const after = Number(url.searchParams.get('after')) || 0;
      const messages = db.sprint6Messages.filter(item => item.conversationId === conversation.id && Date.parse(item.createdAt) > after).slice(-200).map(item => ({ id: item.id, senderId: item.senderId, senderName: userName(person(db, item.senderId)), body: item.body, createdAt: item.createdAt }));
      conversation.readAt ||= {};
      if (!conversation.readAt[user.id] || Date.now() - Date.parse(conversation.readAt[user.id]) > 10_000) { conversation.readAt[user.id] = new Date().toISOString(); save(); }
      return respond(res, 200, { messages, conversationId: conversation.id });
    }

    const messagePath = path.match(/^\/api\/sprint6\/conversations\/([\w-]+)\/messages$/);
    if (req.method === 'POST' && messagePath) return read().then(body => {
      if (!body) return;
      const conversation = db.sprint6Conversations.find(item => item.id === messagePath[1] && item.participantIds.includes(user.id));
      if (!conversation) return respond(res, 404, { error: 'Không tìm thấy cuộc trò chuyện.' });
      const messageBody = text(body.message, 2000);
      if (!messageBody) return respond(res, 400, { error: 'Tin nhắn không được để trống.' });
      const recent = db.sprint6Messages.filter(item => item.senderId === user.id && Date.now() - Date.parse(item.createdAt) < 60_000).length;
      if (recent >= 30) return respond(res, 429, { error: 'Bạn gửi tin nhắn quá nhanh. Hãy thử lại sau.' });
      const message = { id: crypto.randomUUID(), conversationId: conversation.id, senderId: user.id, body: messageBody, createdAt: new Date().toISOString() };
      db.sprint6Messages.push(message); if (db.sprint6Messages.length > 100_000) db.sprint6Messages = db.sprint6Messages.slice(-100_000);
      conversation.lastMessageAt = message.createdAt; conversation.readAt ||= {}; conversation.readAt[user.id] = message.createdAt;
      const recipient = conversation.participantIds.find(id => id !== user.id); notify(db, recipient, 'Tin nhắn mới', `${userName(user)} đã gửi tin nhắn cho bạn.`, `/network.html?conversation=${conversation.id}`);
      save(); audit?.(user.id, 'sprint6.message.sent', 'sprint6');
      publish(conversation.participantIds, 'message', { conversationId: conversation.id, message: { id: message.id, senderId: message.senderId, senderName: userName(user), body: message.body, createdAt: message.createdAt } });
      return respond(res, 201, { message: { id: message.id, senderId: user.id, senderName: userName(user), body: message.body, createdAt: message.createdAt } });
    });

    if (req.method === 'GET' && path === '/api/sprint6/events') {
      const clients = streamClients.get(user.id) || new Set();
      if (clients.size >= 3) return respond(res, 429, { error: 'Bạn đang mở quá nhiều kết nối realtime.' });
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write(`event: ready\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);
      clients.add(res); streamClients.set(user.id, clients);
      const heartbeat = setInterval(() => { if (!res.writableEnded) res.write(': keep-alive\n\n'); }, 25_000); heartbeat.unref();
      const close = () => { clearInterval(heartbeat); clients.delete(res); if (!clients.size) streamClients.delete(user.id); };
      res.on('close', close);
      return;
    }

    return respond(res, 404, { error: 'Không tìm thấy endpoint Sprint 6.' });
  },
  deleteUserData(db, user) {
    closeUserStreams(user.id);
    for (const key of ['sprint6Invitations', 'sprint6Interests']) db[key] = (db[key] || []).filter(item => item.studentId !== user.id && item.employerId !== user.id);
    db.sprint6Matches = (db.sprint6Matches || []).filter(item => item.studentId !== user.id && item.employerId !== user.id);
    const removed = new Set((db.sprint6Conversations || []).filter(item => item.participantIds.includes(user.id)).map(item => item.id));
    db.sprint6Conversations = (db.sprint6Conversations || []).filter(item => !removed.has(item.id));
    db.sprint6Messages = (db.sprint6Messages || []).filter(item => !removed.has(item.conversationId));
    db.sprint6Blocks = (db.sprint6Blocks || []).filter(item => item.blockerId !== user.id && item.blockedId !== user.id);
  }
};
