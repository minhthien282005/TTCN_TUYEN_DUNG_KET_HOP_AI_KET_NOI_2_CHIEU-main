'use strict';

const TERMINAL_APPLICATION_STATES = new Set(['rejected', 'withdrawn']);

function activeApplicationCounts(db) {
  const counts = new Map();
  for (const application of db.applications || []) {
    if (TERMINAL_APPLICATION_STATES.has(application.status)) continue;
    counts.set(application.jobId, (counts.get(application.jobId) || 0) + 1);
  }
  return counts;
}

function activeApplicationCount(db, jobId, counts = activeApplicationCounts(db)) {
  return counts.get(jobId) || 0;
}

function hasOpenPositions(db, job, counts = activeApplicationCounts(db)) {
  if (!job) return false;
  const headcount = Math.max(1, Number(job.headcount) || 1);
  return activeApplicationCount(db, job.id, counts) < headcount;
}

module.exports = { activeApplicationCount, activeApplicationCounts, hasOpenPositions };
