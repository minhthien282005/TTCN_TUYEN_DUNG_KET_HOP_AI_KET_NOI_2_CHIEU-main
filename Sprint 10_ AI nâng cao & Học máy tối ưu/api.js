'use strict';

const crypto = require('node:crypto');
const matching = require('../Sprint 5_ Matching hai chiều, Giải thích & Hoàn thiện/api');

const send = (res, status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().replace(/[^a-z0-9+#.]+/g, ' ').trim();
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const clean = (value, limit = 200) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, limit);
const fieldsFor = (role, item) => role === 'student'
  ? { skills: item.skills || [], roles: [item.title, item.industry].filter(Boolean), locations: [item.location, item.workMode].filter(Boolean), types: [item.type].filter(Boolean) }
  : { skills: item.candidate?.skills || [], roles: [...(item.candidate?.desiredRoles || []), item.candidate?.major].filter(Boolean), locations: [item.candidate?.location].filter(Boolean), types: [item.job?.title].filter(Boolean) };
function overlap(left = [], right = []) {
  const a = new Set(left.map(normalize).filter(Boolean)); const b = new Set(right.map(normalize).filter(Boolean));
  if (!a.size && !b.size) return 0;
  let common = 0; for (const value of a) if (b.has(value)) common++;
  return common / new Set([...a, ...b]).size;
}
function featureSimilarity(a = {}, b = {}) {
  return overlap(a.skills, b.skills) * 0.55 + overlap(a.roles, b.roles) * 0.30 + overlap(a.locations, b.locations) * 0.10 + overlap(a.types, b.types) * 0.05;
}
function semanticFit(db, profileId, jobId) {
  const profile = (db.embeddings || []).find(item => item.kind === 'profile' && item.entityId === profileId);
  const job = (db.embeddings || []).find(item => item.kind === 'job' && item.entityId === jobId);
  if (!profile || !job || !String(profile.model).startsWith('ollama:') || profile.model !== job.model || !Array.isArray(profile.vector) || !Array.isArray(job.vector) || profile.vector.length !== job.vector.length || !profile.vector.length) return null;
  let dot = 0; let leftNorm = 0; let rightNorm = 0;
  for (let i = 0; i < profile.vector.length; i++) { const left = Number(profile.vector[i]); const right = Number(job.vector[i]); if (!Number.isFinite(left) || !Number.isFinite(right)) return null; dot += left * right; leftNorm += left * left; rightNorm += right * right; }
  if (!leftNorm || !rightNorm) return null;
  return Math.round(clamp(((dot / Math.sqrt(leftNorm * rightNorm)) + 1) * 50));
}
function feedbackKey(role, item) { return role === 'student' ? `job:${item.id}` : `candidate:${item.candidate.id}:job:${item.job.id}`; }
function rank(db, user, role, items, feedback) {
  const ranked = items.map(item => {
    const key = feedbackKey(role, item); const ownFeedback = feedback.find(entry => entry.key === key);
    const features = fieldsFor(role, item); const profileId = role === 'student' ? user.id : item.candidate.id; const jobId = role === 'student' ? item.id : item.job.id;
    const semanticScore = semanticFit(db, profileId, jobId);
    const matchScore = semanticScore === null ? Number(item.score) : Number(item.score) * 0.82 + semanticScore * 0.18;
    let positive = 0; let negative = 0;
    for (const entry of feedback) {
      if (entry.key === key || !entry.features || !['relevant', 'not_relevant'].includes(entry.value)) continue;
      const ageDays = Math.max(0, (Date.now() - Date.parse(entry.updatedAt)) / 86_400_000);
      const decay = Math.exp(-ageDays / 120); const similarity = featureSimilarity(features, entry.features);
      if (entry.value === 'relevant') positive += similarity * decay; else negative += similarity * decay;
    }
    const adjustment = Math.min(12, positive * 12) - Math.min(18, negative * 18) + (ownFeedback?.value === 'relevant' ? 8 : ownFeedback?.value === 'not_relevant' ? -20 : 0);
    return { ...item, score: Math.round(clamp(matchScore)), rankScore: Math.round(clamp(matchScore + adjustment)), semanticScore, feedback: ownFeedback?.value || null, personalization: Math.round(clamp(adjustment, -25, 20)) };
  });
  return ranked.sort((a, b) => b.rankScore - a.rankScore || b.score - a.score).slice(0, role === 'student' ? 30 : 60);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''; let oversized = false;
    req.on('data', chunk => { if (oversized) return; raw += chunk; if (raw.length > 8_000) { oversized = true; reject(Object.assign(new Error('Nội dung gửi lên quá lớn.'), { status: 413 })); } });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { reject(Object.assign(new Error('Dữ liệu JSON không hợp lệ.'), { status: 400 })); } }); req.on('error', reject);
  });
}

module.exports = {
  handleRequest: async (req, res, url, user, { db, save, audit }) => {
    if (!url.pathname.startsWith('/api/sprint10/')) return null;
    if (!user) return send(res, 401, { error: 'Vui lòng đăng nhập để xem gợi ý cá nhân hóa.' });
    if (!['student', 'employer', 'admin'].includes(user.role)) return send(res, 403, { error: 'Vai trò tài khoản không hợp lệ.' });
    db.sprint10Feedback ||= []; db.jobs ||= []; db.users ||= []; db.companies ||= [];

    if (req.method === 'GET' && url.pathname === '/api/sprint10/recommendations') {
      if (user.role === 'admin') return send(res, 403, { error: 'Tài khoản admin không có gợi ý tuyển dụng.' });
      const base = user.role === 'student' ? matching.studentMatches(db, user) : matching.employerMatches(db, user);
      const feedback = db.sprint10Feedback.filter(item => item.actorId === user.id && item.role === user.role).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 200);
      const items = rank(db, user, user.role, base, feedback);
      const semanticPairs = items.filter(item => item.semanticScore !== null).length;
      return send(res, 200, { role: user.role, items, model: { name: 'adaptive-hybrid-v1', semanticReranking: semanticPairs > 0, semanticPairs, feedbackSignals: feedback.length, trainedModel: false } });
    }

    if (req.method === 'POST' && url.pathname === '/api/sprint10/feedback') {
      if (!['student', 'employer'].includes(user.role)) return send(res, 403, { error: 'Chỉ sinh viên và nhà tuyển dụng có thể gửi phản hồi gợi ý.' });
      let body; try { body = await readBody(req); } catch (error) { return send(res, error.status || 400, { error: error.message }); }
      const value = clean(body.value, 20); if (!['relevant', 'not_relevant', 'clear'].includes(value)) return send(res, 400, { error: 'Phản hồi phải là relevant, not_relevant hoặc clear.' });
      const base = user.role === 'student' ? matching.studentMatches(db, user) : matching.employerMatches(db, user);
      const item = user.role === 'student' ? base.find(entry => entry.id === body.jobId) : base.find(entry => entry.job.id === body.jobId && entry.candidate.id === body.candidateId);
      if (!item) return send(res, 404, { error: 'Gợi ý không còn khả dụng hoặc không thuộc phạm vi của bạn.' });
      const key = feedbackKey(user.role, item); const existing = db.sprint10Feedback.find(entry => entry.actorId === user.id && entry.role === user.role && entry.key === key);
      if (value === 'clear') {
        if (existing) db.sprint10Feedback = db.sprint10Feedback.filter(entry => entry !== existing);
        audit?.(user.id, 'sprint10.feedback.clear', key); save(); return send(res, 200, { cleared: true });
      }
      const now = new Date().toISOString(); const features = fieldsFor(user.role, item);
      if (existing) Object.assign(existing, { value, features, updatedAt: now });
      else {
        db.sprint10Feedback.push({ id: crypto.randomUUID(), actorId: user.id, role: user.role, key, jobId: body.jobId, candidateId: user.role === 'employer' ? body.candidateId : null, value, features, createdAt: now, updatedAt: now });
        const actorEntries = db.sprint10Feedback.filter(entry => entry.actorId === user.id).sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt));
        if (actorEntries.length > 500) { const expired = new Set(actorEntries.slice(0, actorEntries.length - 500)); db.sprint10Feedback = db.sprint10Feedback.filter(entry => !expired.has(entry)); }
      }
      audit?.(user.id, `sprint10.feedback.${value}`, key); save(); return send(res, 200, { value, message: 'Đã lưu phản hồi để điều chỉnh thứ tự gợi ý.' });
    }

    if (req.method === 'GET' && url.pathname === '/api/sprint10/admin/quality') {
      if (user.role !== 'admin') return send(res, 403, { error: 'Chỉ admin mới được xem chất lượng bộ xếp hạng.' });
      const feedback = db.sprint10Feedback; const weekAgo = Date.now() - 7 * 86_400_000;
      const semanticModels = [...new Set((db.embeddings || []).filter(item => String(item.model).startsWith('ollama:')).map(item => item.model))];
      return send(res, 200, { model: 'adaptive-hybrid-v1', trainedModel: false, feedback: { total: feedback.length, relevant: feedback.filter(item => item.value === 'relevant').length, notRelevant: feedback.filter(item => item.value === 'not_relevant').length, last7Days: feedback.filter(item => Date.parse(item.updatedAt) >= weekAgo).length }, semanticModels, updatedAt: new Date().toISOString() });
    }

    return send(res, 404, { error: 'Không tìm thấy API Sprint 10.' });
  },
  deleteUserData(db, user) { db.sprint10Feedback = (db.sprint10Feedback || []).filter(item => item.actorId !== user.id && item.candidateId !== user.id); }
};
