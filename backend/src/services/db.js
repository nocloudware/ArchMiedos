const APPROVED_FIELDS = 'id, content, likes, created_at';

export async function listApprovedByLetter(env, fromLetter, toLetter, limit, offset) {
  if (fromLetter === toLetter) {
    return env.DB.prepare(
      `SELECT ${APPROVED_FIELDS} FROM fears WHERE is_approved = 1 AND first_letter = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
      .bind(fromLetter, limit, offset)
      .all();
  }
  return env.DB.prepare(
    `SELECT ${APPROVED_FIELDS} FROM fears WHERE is_approved = 1 AND first_letter BETWEEN ? AND ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
  )
    .bind(fromLetter, toLetter, limit, offset)
    .all();
}

export async function countApprovedByLetter(env, fromLetter, toLetter) {
  if (fromLetter === toLetter) {
    return env.DB.prepare('SELECT COUNT(*) as total FROM fears WHERE is_approved = 1 AND first_letter = ?')
      .bind(fromLetter)
      .first();
  }
  return env.DB.prepare(
    'SELECT COUNT(*) as total FROM fears WHERE is_approved = 1 AND first_letter BETWEEN ? AND ?'
  )
    .bind(fromLetter, toLetter)
    .first();
}

export async function searchApproved(env, query, limit) {
  const escaped = query.replace(/[\\%_]/g, (m) => '\\' + m);
  return env.DB.prepare(
    `SELECT ${APPROVED_FIELDS} FROM fears WHERE is_approved = 1 AND content LIKE ? ESCAPE '\\' ORDER BY created_at DESC LIMIT ?`
  )
    .bind('%' + escaped + '%', limit)
    .all();
}

export async function randomApproved(env) {
  return env.DB.prepare(`SELECT ${APPROVED_FIELDS} FROM fears WHERE is_approved = 1 ORDER BY RANDOM() LIMIT 1`).first();
}

export async function getFearById(env, id) {
  return env.DB.prepare('SELECT * FROM fears WHERE id = ?').bind(id).first();
}

export async function insertFear(env, { content, ipHash, approved, comment }) {
  return env.DB.prepare('INSERT INTO fears (content, ip_hash, is_approved, status, moderation_comment) VALUES (?, ?, ?, ?, ?)')
    .bind(content, ipHash, approved ? 1 : 0, approved ? 'approved' : 'pending', comment)
    .run();
}

export async function countSubmissionsByIp(env, ipHash) {
  return env.DB.prepare(
    "SELECT COUNT(*) as total FROM fears WHERE ip_hash = ? AND created_at >= datetime('now', '-1 day')"
  )
    .bind(ipHash)
    .first();
}

export async function insertReport(env, fearId, reason) {
  return env.DB.prepare('INSERT INTO reports (fear_id, reason) VALUES (?, ?)').bind(fearId, reason).run();
}

export async function addLike(env, fearId, cookieId) {
  return env.DB.prepare('INSERT INTO likes (fear_id, cookie_id) VALUES (?, ?)').bind(fearId, cookieId).run();
}

export async function incrementLikes(env, fearId) {
  return env.DB.prepare('UPDATE fears SET likes = likes + 1 WHERE id = ?').bind(fearId).run();
}

export async function getLikes(env, fearId) {
  return env.DB.prepare('SELECT likes FROM fears WHERE id = ?').bind(fearId).first();
}

export async function listAdminFears(env, status, limit, offset) {
  const where = buildAdminWhere(status);
  return env.DB.prepare(
    `SELECT f.id, f.content, f.first_letter, f.likes, f.created_at, f.status, f.is_reported,
            f.moderation_comment, f.ip_hash, COUNT(r.id) as report_count
     FROM fears f
     LEFT JOIN reports r ON r.fear_id = f.id
     ${where.sql}
     GROUP BY f.id
     ORDER BY f.created_at DESC
     LIMIT ? OFFSET ?`
  )
    .bind(...where.params, limit, offset)
    .all();
}

export async function updateFearStatus(env, id, status, comment) {
  if (status === 'approved') {
    return env.DB.prepare('UPDATE fears SET status = ?, is_approved = 1, moderation_comment = ? WHERE id = ?')
      .bind(status, comment || null, id)
      .run();
  }
  return env.DB.prepare('UPDATE fears SET status = ?, is_approved = 0, moderation_comment = ? WHERE id = ?')
    .bind(status, comment || null, id)
    .run();
}

export async function markReported(env, id) {
  return env.DB.prepare('UPDATE fears SET is_reported = 1 WHERE id = ?').bind(id).run();
}

export async function deleteFear(env, id) {
  return env.DB.prepare('DELETE FROM fears WHERE id = ?').bind(id).run();
}

export async function getStats(env) {
  const [total, pending, approved, rejected, reported, totalLikes] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) as n FROM fears').first(),
    env.DB.prepare("SELECT COUNT(*) as n FROM fears WHERE status = 'pending'").first(),
    env.DB.prepare("SELECT COUNT(*) as n FROM fears WHERE status = 'approved'").first(),
    env.DB.prepare("SELECT COUNT(*) as n FROM fears WHERE status = 'rejected'").first(),
    env.DB.prepare('SELECT COUNT(*) as n FROM fears WHERE is_reported = 1').first(),
    env.DB.prepare('SELECT COALESCE(SUM(likes), 0) as n FROM fears').first(),
  ]);
  return {
    total: total.n,
    pending: pending.n,
    approved: approved.n,
    rejected: rejected.n,
    reported: reported.n,
    totalLikes: totalLikes.n,
  };
}

export async function getTopLiked(env, limit = 5) {
  return env.DB.prepare(
    `SELECT id, content, likes, created_at FROM fears WHERE is_approved = 1 ORDER BY likes DESC LIMIT ?`
  )
    .bind(limit)
    .all();
}

export async function getRecentActivity(env, days = 7) {
  return env.DB.prepare(
    `SELECT date(created_at) as day, COUNT(*) as count
     FROM fears
     WHERE created_at >= date('now', ?)
     GROUP BY day
     ORDER BY day ASC`
  )
    .bind(`-${days - 1} days`)
    .all();
}

function buildAdminWhere(status) {
  switch (status) {
    case 'pending':
      return { sql: 'WHERE f.status = ?', params: ['pending'] };
    case 'approved':
      return { sql: 'WHERE f.status = ?', params: ['approved'] };
    case 'rejected':
      return { sql: 'WHERE f.status = ?', params: ['rejected'] };
    case 'reported':
      return { sql: 'WHERE f.is_reported = 1', params: [] };
    default:
      return { sql: 'WHERE 1 = 1', params: [] };
  }
}
