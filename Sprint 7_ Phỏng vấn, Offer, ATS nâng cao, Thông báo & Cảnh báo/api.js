'use strict';
const crypto = require('node:crypto');
const text = (value, max = 500) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const reply = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
const readBody = req => new Promise((resolve, reject) => {
  let raw = ''; req.on('data', chunk => { raw += chunk; if (raw.length > 30_000) reject(new Error('Dữ liệu gửi lên quá lớn.')); });
  req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { reject(new Error('Dữ liệu JSON không hợp lệ.')); } }); req.on('error', reject);
});

function notify(db, userId, type, title, message, href) {
  db.notifications.push({ id: crypto.randomUUID(), userId, type, title, message, href, readAt: null, createdAt: new Date().toISOString() });
}
function timeline(db, app, actorId, type, detail = {}) {
  db.sprint7Timeline.push({ id: crypto.randomUUID(), applicationId: app.id, actorId, type, detail, createdAt: new Date().toISOString() });
}

module.exports = {
  handleRequest: async (req, res, url, user, { db, save, audit }) => {
    if (!url.pathname.startsWith('/api/sprint7/')) return null;
    if (!user) return reply(res, 401, { error: 'Vui lòng đăng nhập để tiếp tục.' });
    for (const key of ['applications', 'jobs', 'companies', 'notifications']) db[key] ||= [];
    for (const key of ['sprint7Interviews', 'sprint7Offers', 'sprint7Timeline']) db[key] ||= [];
    const employer = user.role === 'employer'; const student = user.role === 'student';
    const company = employer ? db.companies.find(item => item.ownerId === user.id) : null;
    const appFor = id => db.applications.find(item => item.id === id && (student ? item.studentId === user.id : employer && item.companyId === company?.id));
    const read = async () => { try { return await readBody(req); } catch (error) { reply(res, 400, { error: error.message }); return null; } };
    const path = url.pathname;

    if (req.method === 'GET' && path === '/api/sprint7/dashboard') {
      if (!student && !employer) return reply(res, 403, { error: 'Chức năng dành cho sinh viên và nhà tuyển dụng.' });
      const apps = db.applications.filter(item => student ? item.studentId === user.id : item.companyId === company?.id);
      const ids = new Set(apps.map(item => item.id)); const now = Date.now(); let changed = false;
      for (const offer of db.sprint7Offers) if (offer.status === 'pending' && Date.parse(offer.expiresAt) <= now) { offer.status = 'expired'; offer.updatedAt = new Date().toISOString(); changed = true; const application = db.applications.find(item => item.id === offer.applicationId); if (application) timeline(db, application, null, 'offer.expired', { offerId: offer.id }); }
      const interviews = db.sprint7Interviews.filter(item => ids.has(item.applicationId)).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
      for (const interview of interviews) {
        const start = Date.parse(interview.startsAt); const application = db.applications.find(item => item.id === interview.applicationId);
        if (interview.status === 'confirmed' && !interview.reminderSentAt && start > now && start <= now + 24 * 60 * 60_000) {
          const jobTitle = db.jobs.find(item => item.id === application?.jobId)?.title || 'cuộc phỏng vấn';
          notify(db, application?.studentId, 'interview.reminder', 'Nhắc lịch phỏng vấn', `Lịch ${jobTitle} sẽ diễn ra trong 24 giờ tới.`, '/sprint7/interviews.html');
          const ownerId = db.companies.find(item => item.id === application?.companyId)?.ownerId;
          if (ownerId) notify(db, ownerId, 'interview.reminder', 'Nhắc lịch phỏng vấn', `Lịch ${jobTitle} sẽ diễn ra trong 24 giờ tới.`, '/sprint7/interviews.html');
          interview.reminderSentAt = new Date().toISOString(); changed = true;
        }
      }
      const offers = db.sprint7Offers.filter(item => ids.has(item.applicationId)).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      const events = db.sprint7Timeline.filter(item => ids.has(item.applicationId)).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 100).map(event => ({ ...event, jobTitle: db.jobs.find(job => job.id === db.applications.find(app => app.id === event.applicationId)?.jobId)?.title || 'Vị trí tuyển dụng' }));
      const applicationCards = apps.map(app => {
        const job = db.jobs.find(item => item.id === app.jobId); const candidate = db.users.find(item => item.id === app.studentId);
        return { id: app.id, jobId: app.jobId, jobTitle: job?.title || 'Vị trí tuyển dụng', status: app.status, candidateName: candidate?.profile?.fullName || candidate?.name || candidate?.email || 'Ứng viên' };
      });
      const interviewCards = interviews.map(item => ({ ...item, application: applicationCards.find(app => app.id === item.applicationId) }));
      const offerCards = offers.map(item => ({ ...item, application: applicationCards.find(app => app.id === item.applicationId) }));
      const staleApplications = apps.filter(item => ['submitted', 'viewed', 'screening'].includes(item.status) && now - Date.parse(item.updatedAt || item.createdAt) > 7 * 86400_000).length;
      if (changed) save();
      return reply(res, 200, { applications: applicationCards, interviews: interviewCards, offers: offerCards, events, alerts: { upcomingInterviews: interviews.filter(item => item.status === 'confirmed' && Date.parse(item.startsAt) > now && Date.parse(item.startsAt) < now + 24 * 60 * 60_000).length, pendingConfirmations: interviews.filter(item => item.status === 'proposed').length, pendingOffers: offers.filter(item => item.status === 'pending').length, staleApplications } });
    }

    const interviewRoute = path.match(/^\/api\/sprint7\/applications\/([\w-]+)\/interviews$/);
    if (interviewRoute && req.method === 'POST') {
      if (!employer || !company) return reply(res, 403, { error: 'Chỉ nhà tuyển dụng mới có thể lên lịch phỏng vấn.' });
      const app = db.applications.find(item => item.id === interviewRoute[1] && item.companyId === company.id);
      if (!app || ['rejected', 'withdrawn', 'hired'].includes(app.status)) return reply(res, 404, { error: 'Không tìm thấy hồ sơ đang hoạt động.' });
      const body = await read(); if (!body) return;
      const startsAt = Date.parse(body.startsAt); const durationMinutes = Number(body.durationMinutes || 60);
      if (!Number.isFinite(startsAt) || startsAt < Date.now() + 5 * 60_000 || durationMinutes < 15 || durationMinutes > 240) return reply(res, 400, { error: 'Chọn thời gian trong tương lai và thời lượng từ 15 đến 240 phút.' });
      const mode = ['online', 'onsite', 'phone'].includes(body.mode) ? body.mode : null;
      const meetingUrl = text(body.meetingUrl, 500); let parsed;
      if (meetingUrl) { try { parsed = new URL(meetingUrl); } catch {} }
      if (!mode || (meetingUrl && (!parsed || !['http:', 'https:'].includes(parsed.protocol))) || (mode === 'online' && !meetingUrl && !text(body.location, 200))) return reply(res, 400, { error: 'Kiểm tra hình thức và địa điểm/liên kết cuộc hẹn.' });
      const item = { id: crypto.randomUUID(), applicationId: app.id, organizerId: user.id, startsAt: new Date(startsAt).toISOString(), durationMinutes, mode, location: text(body.location, 200), meetingUrl, notes: text(body.notes, 1000), status: 'proposed', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      db.sprint7Interviews.push(item); timeline(db, app, user.id, 'interview.proposed', { interviewId: item.id, startsAt: item.startsAt });
      notify(db, app.studentId, 'interview.proposed', 'Lời mời phỏng vấn mới', `Nhà tuyển dụng đề xuất phỏng vấn vào ${new Date(item.startsAt).toLocaleString('vi-VN')}.`, '/sprint7/interviews.html');
      audit?.(user.id, 'sprint7.interview.propose', item.id); save(); return reply(res, 201, { interview: item });
    }

    const interviewAction = path.match(/^\/api\/sprint7\/interviews\/([\w-]+)\/(confirm|decline|cancel|complete)$/);
    if (interviewAction && req.method === 'POST') {
      const interview = db.sprint7Interviews.find(item => item.id === interviewAction[1]); const app = interview && appFor(interview.applicationId);
      if (!interview || !app) return reply(res, 404, { error: 'Không tìm thấy lịch phỏng vấn.' });
      const action = interviewAction[2];
      if ((action === 'confirm' || action === 'decline') && !student) return reply(res, 403, { error: 'Ứng viên mới có thể phản hồi lời mời.' });
      if ((action === 'cancel' || action === 'complete') && !employer) return reply(res, 403, { error: 'Nhà tuyển dụng mới có thể cập nhật lịch này.' });
      if (interview.status !== 'proposed' && !(action === 'cancel' && interview.status === 'confirmed')) return reply(res, 409, { error: 'Lịch đã được xử lý hoặc không thể cập nhật.' });
      const actionBody = action === 'decline' || action === 'cancel' ? await read() : {};
      if (!actionBody) return;
      interview.status = ({ confirm: 'confirmed', decline: 'declined', cancel: 'cancelled', complete: 'completed' })[action]; interview.responseNote = text(actionBody.note, 500); interview.updatedAt = new Date().toISOString();
      timeline(db, app, user.id, `interview.${interview.status}`, { interviewId: interview.id, note: interview.responseNote });
      const receiver = student ? company?.ownerId : app.studentId;
      notify(db, receiver, `interview.${interview.status}`, 'Lịch phỏng vấn được cập nhật', `Lịch phỏng vấn ${interview.status === 'confirmed' ? 'đã được xác nhận' : interview.status === 'declined' ? 'đã bị từ chối' : interview.status === 'cancelled' ? 'đã bị hủy' : 'đã hoàn tất'}.`, '/sprint7/interviews.html');
      audit?.(user.id, `sprint7.interview.${action}`, interview.id); save(); return reply(res, 200, { interview });
    }

    const offerCreate = path.match(/^\/api\/sprint7\/applications\/([\w-]+)\/offers$/);
    if (offerCreate && req.method === 'POST') {
      if (!employer || !company) return reply(res, 403, { error: 'Chỉ nhà tuyển dụng mới có thể gửi offer.' });
      const app = db.applications.find(item => item.id === offerCreate[1] && item.companyId === company.id);
      if (!app || ['rejected', 'withdrawn', 'hired'].includes(app.status)) return reply(res, 404, { error: 'Không tìm thấy hồ sơ đang hoạt động.' });
      if (db.sprint7Offers.some(item => item.applicationId === app.id && item.status === 'pending')) return reply(res, 409, { error: 'Hồ sơ đã có offer đang chờ phản hồi.' });
      const body = await read(); if (!body) return;
      const salaryMin = Number(body.salaryMin); const salaryMax = Number(body.salaryMax);
      if (!Number.isFinite(salaryMin) || salaryMin < 0 || !Number.isFinite(salaryMax) || salaryMax < salaryMin || salaryMax > 1_000_000_000) return reply(res, 400, { error: 'Mức lương không hợp lệ.' });
      const expiresAt = body.expiresAt ? Date.parse(body.expiresAt) : Date.now() + 7 * 86400_000;
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() || expiresAt > Date.now() + 90 * 86400_000) return reply(res, 400, { error: 'Hạn phản hồi phải trong vòng 90 ngày.' });
      const offer = { id: crypto.randomUUID(), applicationId: app.id, senderId: user.id, salaryMin, salaryMax, currency: text(body.currency || 'VND', 3).toUpperCase(), employmentType: text(body.employmentType, 40), startDate: body.startDate && Date.parse(body.startDate) ? new Date(body.startDate).toISOString() : null, terms: text(body.terms, 3000), expiresAt: new Date(expiresAt).toISOString(), status: 'pending', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      db.sprint7Offers.push(offer); app.status = 'offered'; app.version = Number(app.version || 0) + 1; app.updatedAt = offer.createdAt;
      timeline(db, app, user.id, 'offer.sent', { offerId: offer.id, salaryMin, salaryMax, currency: offer.currency });
      notify(db, app.studentId, 'offer.received', 'Bạn nhận được thư mời làm việc', 'Nhà tuyển dụng đã gửi offer. Vui lòng xem và phản hồi trước hạn.', '/sprint7/interviews.html'); audit?.(user.id, 'sprint7.offer.send', offer.id); save(); return reply(res, 201, { offer });
    }

    const offerAction = path.match(/^\/api\/sprint7\/offers\/([\w-]+)\/(accept|decline)$/);
    if (offerAction && req.method === 'POST') {
      if (!student) return reply(res, 403, { error: 'Chỉ ứng viên mới có thể phản hồi offer.' });
      const offer = db.sprint7Offers.find(item => item.id === offerAction[1]); const app = offer && appFor(offer.applicationId);
      if (!offer || !app) return reply(res, 404, { error: 'Không tìm thấy offer.' });
      if (offer.status !== 'pending' || Date.parse(offer.expiresAt) <= Date.now()) return reply(res, 409, { error: 'Offer đã hết hạn hoặc đã được phản hồi.' });
      const body = await read(); if (!body) return;
      offer.status = offerAction[2] === 'accept' ? 'accepted' : 'declined'; offer.responseNote = text(body.note, 500); offer.respondedAt = new Date().toISOString(); offer.updatedAt = offer.respondedAt;
      if (offer.status === 'accepted') { app.status = 'hired'; app.version = Number(app.version || 0) + 1; app.updatedAt = offer.respondedAt; }
      timeline(db, app, user.id, `offer.${offer.status}`, { offerId: offer.id, note: offer.responseNote });
      const employerId = db.companies.find(item => item.id === app.companyId)?.ownerId;
      notify(db, employerId, `offer.${offer.status}`, 'Ứng viên đã phản hồi offer', `Ứng viên đã ${offer.status === 'accepted' ? 'chấp nhận' : 'từ chối'} offer của bạn.`, '/sprint7/interviews.html'); audit?.(user.id, `sprint7.offer.${offer.status}`, offer.id); save(); return reply(res, 200, { offer, application: app });
    }
    return reply(res, 404, { error: 'Không tìm thấy endpoint Sprint 7.' });
  },
  deleteUserData(db, user) {
    const employerCompanyIds = new Set((db.companies || []).filter(item => item.ownerId === user.id).map(item => item.id));
    const applicationIds = new Set((db.applications || []).filter(item => item.studentId === user.id || employerCompanyIds.has(item.companyId)).map(item => item.id));
    for (const key of ['sprint7Interviews', 'sprint7Offers']) db[key] = (db[key] || []).filter(item => !applicationIds.has(item.applicationId) && item.organizerId !== user.id && item.senderId !== user.id);
    db.sprint7Timeline = (db.sprint7Timeline || []).filter(item => !applicationIds.has(item.applicationId) && item.actorId !== user.id);
  }
};
