'use strict';

const crypto = require('node:crypto');

const send = (res, status, payload, headers = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(payload));
};
const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const safeFields = (item, fields) => Object.fromEntries(fields.filter(key => item?.[key] !== undefined).map(key => [key, item[key]]));
const ACTIVE_JOB_STATES = new Set(['pending_review', 'published', 'needs_changes']);
const duplicateKey = job => `${job.companyId || ''}\u0000${normalize(job.title)}`;

function assessJob(db, job, duplicateCounts = null) {
  const content = normalize([job.title, job.description, job.requirements, job.benefits, job.recruitmentProcess].join(' '));
  const sourceHash = crypto.createHash('sha256').update(content).digest('hex');
  const reasons = [];
  let score = 0;
  if (/\b(dong phi|phi ho so|phi tuyen dung|nap tien|chuyen khoan truoc|dat coc|mua khoa hoc bat buoc)\b/.test(content)) {
    score = Math.max(score, 90); reasons.push('Tin có nội dung yêu cầu phí, nạp tiền hoặc chuyển khoản trước.');
  }
  if (/\b(ma otp|mat khau ngan hang|ma pin the|gui thong tin the)\b/.test(content)) {
    score = Math.max(score, 100); reasons.push('Tin yêu cầu thông tin xác thực hoặc tài chính nhạy cảm.');
  }
  if (/\b(viec nhe luong cao|cam ket thu nhap|thu nhap khong gioi han)\b/.test(content)) {
    score = Math.max(score, 50); reasons.push('Cụm từ thu nhập cam kết cần được kiểm tra thủ công.');
  }
  const duplicate = duplicateCounts ? (duplicateCounts.get(duplicateKey(job)) || 0) - (ACTIVE_JOB_STATES.has(job.status) ? 1 : 0) > 0 : (db.jobs || []).some(other => other.id !== job.id && other.companyId === job.companyId && normalize(other.title) === normalize(job.title) && ACTIVE_JOB_STATES.has(other.status));
  if (duplicate) { score = Math.max(score, 55); reasons.push('Doanh nghiệp có tin trùng tiêu đề đang hoạt động.'); }

  const level = score >= 70 ? 'high' : score >= 40 ? 'review' : 'low';
  const prior = job.moderationAssessment;
  const changed = !prior || prior.sourceHash !== sourceHash || prior.score !== score || prior.level !== level || JSON.stringify(prior.reasons) !== JSON.stringify(reasons);
  if (changed) job.moderationAssessment = { score, level, reasons, engine: 'rules-v1', sourceHash, assessedAt: new Date().toISOString(), humanReviewRequired: score >= 40 };
  return changed;
}

function assessJobs(db, jobs = db.jobs || []) {
  const duplicateCounts = new Map();
  for (const job of db.jobs || []) if (ACTIVE_JOB_STATES.has(job.status)) {
    const key = duplicateKey(job);
    duplicateCounts.set(key, (duplicateCounts.get(key) || 0) + 1);
  }
  let changed = false;
  for (const job of jobs) changed = assessJob(db, job, duplicateCounts) || changed;
  return changed;
}

function buildExport(db, user) {
  const company = (db.companies || []).find(item => item.ownerId === user.id);
  const companyJobs = (db.jobs || []).filter(item => item.companyId === company?.id);
  const ownedApplications = (db.applications || []).filter(item => item.studentId === user.id);
  const employerApplications = company ? (db.applications || []).filter(item => item.companyId === company.id) : [];
  const applicationIds = new Set([...ownedApplications, ...employerApplications].map(item => item.id));
  const conversations = (db.sprint6Conversations || []).filter(item => (item.participantIds || []).includes(user.id));
  const conversationIds = new Set(conversations.map(item => item.id));
  const resumes = (db.resumes || []).filter(item => item.userId === user.id).map(({ storageName, ...item }) => item);
  return {
    schemaVersion: '1.0', exportedAt: new Date().toISOString(),
    account: safeFields(user, ['id', 'email', 'name', 'role', 'verified', 'createdAt', 'profile']),
    consents: (db.consents || []).filter(item => item.userId === user.id),
    notifications: (db.notifications || []).filter(item => item.userId === user.id),
    auditEvents: (db.audit || []).filter(item => item.userId === user.id),
    resumes,
    applications: ownedApplications,
    recruitmentApplications: employerApplications.map(item => safeFields(item, ['id', 'jobId', 'companyId', 'status', 'createdAt', 'updatedAt'])),
    savedJobs: (db.savedJobs || []).filter(item => item.userId === user.id),
    jobViews: (db.jobViews || []).filter(item => item.userId === user.id),
    company: company ? safeFields(company, ['id', 'name', 'slug', 'website', 'description', 'industry', 'location', 'verificationStatus', 'createdAt', 'updatedAt']) : null,
    jobs: companyJobs.map(item => safeFields(item, ['id', 'title', 'description', 'requirements', 'benefits', 'status', 'createdAt', 'updatedAt'])),
    interviews: (db.sprint7Interviews || []).filter(item => applicationIds.has(item.applicationId)),
    offers: (db.sprint7Offers || []).filter(item => applicationIds.has(item.applicationId)),
    careerRoadmaps: (db.sprint8Roadmaps || []).filter(item => item.userId === user.id),
    interviewPractice: (db.sprint8PracticeSessions || []).filter(item => item.userId === user.id),
    conversations: conversations.map(item => safeFields(item, ['id', 'createdAt', 'updatedAt', 'lastMessageAt'])),
    messages: (db.sprint6Messages || []).filter(item => conversationIds.has(item.conversationId))
  };
}

module.exports = {
  assessJob,
  assessJobs,
  handleRequest(req, res, url, user, { db, save, audit }) {
    if (!url.pathname.startsWith('/api/sprint9/')) return null;
    if (!user) return send(res, 401, { error: 'Vui lòng đăng nhập để tiếp tục.' });

    if (req.method === 'GET' && url.pathname === '/api/sprint9/privacy/consents') {
      const consents = (db.consents || []).filter(item => item.userId === user.id).sort((a, b) => Date.parse(b.at || b.recordedAt) - Date.parse(a.at || a.recordedAt));
      const aiConsent = [...consents].find(item => item.purpose === 'ai_assistant_external' && item.version === 'sprint5-1.0');
      return send(res, 200, { consents, externalAiGranted: aiConsent?.granted === true });
    }

    if (req.method === 'GET' && url.pathname === '/api/sprint9/privacy/export') {
      const payload = buildExport(db, user);
      audit?.(user.id, 'privacy.data_export', 'account'); save();
      const filename = `ketnoi-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      return send(res, 200, payload, { 'Content-Disposition': `attachment; filename="${filename}"` });
    }

    if (req.method === 'GET' && url.pathname === '/api/sprint9/admin/overview') {
      if (user.role !== 'admin') return send(res, 403, { error: 'Chỉ admin mới được xem trung tâm an toàn.' });
      const changed = assessJobs(db);
      if (changed) { audit?.(user.id, 'sprint9.moderation.assessment_refresh', 'jobs'); save(); }
      const allFlaggedJobs = (db.jobs || []).filter(job => job.moderationAssessment?.humanReviewRequired).sort((a, b) => b.moderationAssessment.score - a.moderationAssessment.score);
      const flaggedJobs = allFlaggedJobs.slice(0, 50).map(job => ({
        id: job.id, title: job.title, company: (db.companies || []).find(item => item.id === job.companyId)?.name || 'Doanh nghiệp',
        status: job.status, score: job.moderationAssessment.score, level: job.moderationAssessment.level, reasons: job.moderationAssessment.reasons,
        analyzedAt: job.moderationAssessment.assessedAt
      }));
      const day = Date.now() - 24 * 60 * 60_000;
      const consentEvents = (db.consents || []).filter(item => item.purpose === 'ai_assistant_external');
      const latestConsentByUser = new Map();
      for (const item of [...consentEvents].reverse()) if (!latestConsentByUser.has(item.userId)) latestConsentByUser.set(item.userId, item);
      const recentAudit = (db.audit || []).slice(-150).reverse().slice(0, 80).map(event => ({
        ...event, actor: (db.users || []).find(item => item.id === event.userId)?.email || (event.userId ? 'Tài khoản đã xóa' : 'Hệ thống')
      }));
      return send(res, 200, {
        metrics: {
          highRiskJobs: allFlaggedJobs.filter(item => item.moderationAssessment.level === 'high').length,
          reviewJobs: allFlaggedJobs.length,
          newAuditEvents24h: (db.audit || []).filter(item => Date.parse(item.at) >= day).length,
          aiConsentGranted: [...latestConsentByUser.values()].filter(item => item.granted).length,
          aiConsentRevoked: [...latestConsentByUser.values()].filter(item => !item.granted).length
        }, flaggedJobs, recentAudit
      });
    }

    if (url.pathname.startsWith('/api/sprint9/admin/')) return send(res, 404, { error: 'Không tìm thấy API Sprint 9.' });
    return send(res, 404, { error: 'Không tìm thấy API Sprint 9.' });
  }
};
