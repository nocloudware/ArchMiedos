const APPROVED_FIELDS = 'id, content, topic, topic_letter, apoyos, fuerzas, created_at';

export async function listApprovedByLetter(env, fromLetter, toLetter, limit, offset) {
  if (fromLetter === toLetter) {
    return env.DB.prepare(
      `SELECT ${APPROVED_FIELDS} FROM fears WHERE is_approved = 1 AND topic_letter = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
      .bind(fromLetter, limit, offset)
      .all();
  }
  return env.DB.prepare(
    `SELECT ${APPROVED_FIELDS} FROM fears WHERE is_approved = 1 AND topic_letter BETWEEN ? AND ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
  )
    .bind(fromLetter, toLetter, limit, offset)
    .all();
}

export async function countApprovedByLetter(env, fromLetter, toLetter) {
  if (fromLetter === toLetter) {
    return env.DB.prepare('SELECT COUNT(*) as total FROM fears WHERE is_approved = 1 AND topic_letter = ?')
      .bind(fromLetter)
      .first();
  }
  return env.DB.prepare(
    'SELECT COUNT(*) as total FROM fears WHERE is_approved = 1 AND topic_letter BETWEEN ? AND ?'
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

export async function getApprovedFearById(env, id) {
  return env.DB.prepare(`SELECT ${APPROVED_FIELDS} FROM fears WHERE id = ? AND is_approved = 1`).bind(id).first();
}

export async function getLatestApproved(env) {
  return env.DB.prepare(`SELECT ${APPROVED_FIELDS} FROM fears WHERE is_approved = 1 ORDER BY created_at DESC, id DESC LIMIT 1`).first();
}

export async function getShareByFear(env, fearId) {
  return env.DB.prepare('SELECT * FROM shares WHERE fear_id = ?').bind(fearId).first();
}

export async function insertShare(env, { fearId, ipHash, rkey, postUri }) {
  return env.DB.prepare('INSERT INTO shares (fear_id, ip_hash, rkey, post_uri) VALUES (?, ?, ?, ?)')
    .bind(fearId, ipHash, rkey, postUri)
    .run();
}

export async function updateShare(env, fearId, rkey, postUri) {
  return env.DB.prepare('UPDATE shares SET rkey = ?, post_uri = ?, created_at = CURRENT_TIMESTAMP WHERE fear_id = ?')
    .bind(rkey, postUri, fearId)
    .run();
}

export async function countSharesByIpToday(env, ipHash) {
  return env.DB.prepare(
    "SELECT COUNT(*) as total FROM shares WHERE ip_hash = ? AND created_at >= datetime('now', '-1 day')"
  )
    .bind(ipHash)
    .first();
}

export async function insertFear(env, { content, ipHash, approved, comment, topic, topicLetter }) {
  return env.DB.prepare(
    'INSERT INTO fears (content, ip_hash, is_approved, status, moderation_comment, topic, topic_letter) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(content, ipHash, approved ? 1 : 0, approved ? 'approved' : 'pending', comment, topic || null, topicLetter || null)
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

export async function addReaction(env, fearId, cookieId, type) {
  return env.DB.prepare('INSERT INTO reactions (fear_id, cookie_id, type) VALUES (?, ?, ?)')
    .bind(fearId, cookieId, type)
    .run();
}

export async function incrementReaction(env, fearId, type) {
  const column = type === 'fuerza' ? 'fuerzas' : 'apoyos';
  return env.DB.prepare(`UPDATE fears SET ${column} = ${column} + 1 WHERE id = ?`).bind(fearId).run();
}

export async function getReactions(env, fearId) {
  return env.DB.prepare('SELECT apoyos, fuerzas FROM fears WHERE id = ?').bind(fearId).first();
}

export async function listAdminFears(env, status, limit, offset) {
  const where = buildAdminWhere(status);
  return env.DB.prepare(
     `SELECT f.id, f.content, f.first_letter, f.apoyos, f.fuerzas, f.created_at, f.status, f.is_reported,
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

export async function updateFearClassification(env, id, topic, letter) {
  return env.DB.prepare('UPDATE fears SET topic = ?, topic_letter = ? WHERE id = ?')
    .bind(topic || null, letter || null, id)
    .run();
}

export async function getAllFearsForClassification(env) {
  return env.DB.prepare('SELECT id, content FROM fears ORDER BY id ASC').all();
}

export async function logAdminAccess(env, { ip, asn, country, region, city, timezone, user_agent, cf_ray, username, method, path, success }) {
  return env.DB.prepare(
    `INSERT INTO admin_logs (ip, asn, country, region, city, timezone, user_agent, cf_ray, username, method, path, success)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(ip, asn, country, region, city, timezone, user_agent, cf_ray, username, method, path, success)
    .run();
}

export async function listAdminLogs(env, limit) {
  return env.DB.prepare(
    'SELECT * FROM admin_logs ORDER BY created_at DESC, id DESC LIMIT ?'
  )
    .bind(limit)
    .all();
}

export async function getPublicStats(env) {
  return env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM fears WHERE is_approved = 1) as fears,
       (SELECT COALESCE(SUM(apoyos), 0) FROM fears WHERE is_approved = 1) as apoyos,
       (SELECT COALESCE(SUM(fuerzas), 0) FROM fears WHERE is_approved = 1) as fuerzas`
  ).first();
}

export async function getStats(env) {
  const [total, pending, approved, rejected, reported, apoyos, fuerzas] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) as n FROM fears').first(),
    env.DB.prepare("SELECT COUNT(*) as n FROM fears WHERE status = 'pending'").first(),
    env.DB.prepare("SELECT COUNT(*) as n FROM fears WHERE status = 'approved'").first(),
    env.DB.prepare("SELECT COUNT(*) as n FROM fears WHERE status = 'rejected'").first(),
    env.DB.prepare('SELECT COUNT(*) as n FROM fears WHERE is_reported = 1').first(),
    env.DB.prepare('SELECT COALESCE(SUM(apoyos), 0) as n FROM fears').first(),
    env.DB.prepare('SELECT COALESCE(SUM(fuerzas), 0) as n FROM fears').first(),
  ]);
  return {
    total: total.n,
    pending: pending.n,
    approved: approved.n,
    rejected: rejected.n,
    reported: reported.n,
    apoyos: apoyos.n,
    fuerzas: fuerzas.n,
  };
}

export async function getTopLiked(env, limit = 5) {
  return env.DB.prepare(
    `SELECT id, content, apoyos, fuerzas, created_at FROM fears WHERE is_approved = 1 ORDER BY (apoyos + fuerzas) DESC LIMIT ?`
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
