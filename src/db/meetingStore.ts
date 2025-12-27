import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'meetings.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

/* =========================
   BOOTSTRAP SCHEMA
   ========================= */

db.exec(`
CREATE TABLE IF NOT EXISTS meetings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_url TEXT NOT NULL,
  join_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled'
);
`);

/* =========================
   SCHEMA MIGRATIONS (SAFE)
   ========================= */

function columnExists(col: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(meetings)`).all();
  return rows.some((r: any) => r.name === col);
}

if (!columnExists('attempts')) {
  db.exec(`ALTER TABLE meetings ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0`);
}

if (!columnExists('created_at')) {
  db.exec(`ALTER TABLE meetings ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0`);
}

if (!columnExists('updated_at')) {
  db.exec(`ALTER TABLE meetings ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0`);
}

/* =========================
   CONSTRAINTS
   ========================= */

db.exec(`
CREATE UNIQUE INDEX IF NOT EXISTS idx_meetings_meeting_url
ON meetings(meeting_url);
`);

/* =========================
   CRUD OPERATIONS
   ========================= */

export function insertMeeting(meetingUrl: string, joinAt: number) {
  const now = Date.now();

  try {
    db.prepare(`
      INSERT INTO meetings (
        meeting_url,
        join_at,
        status,
        attempts,
        created_at,
        updated_at
      )
      VALUES (?, ?, 'scheduled', 0, ?, ?)
    `).run(meetingUrl, joinAt, now, now);
  } catch (err: any) {
    if (
      err.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
      err.code === 'SQLITE_CONSTRAINT'
    ) {
      throw new Error('DUPLICATE_MEETING_URL');
    }
    throw err;
  }
}

/* =========================
   🔥 NEW: BATCH FETCH
   ========================= */

export function getNextMeetings(now: number, limit = 5) {
  return db.prepare(`
    SELECT *
    FROM meetings
    WHERE status = 'scheduled'
      AND join_at <= ?
    ORDER BY join_at ASC
    LIMIT ?
  `).all(now, limit);
}

/* =========================
   STATE TRANSITIONS (SAFE)
   ========================= */

export function markRunning(id: number) {
  const res = db.prepare(`
    UPDATE meetings
    SET status='running',
        attempts = attempts + 1,
        updated_at=?
    WHERE id=? AND status='scheduled'
  `).run(Date.now(), id);

  // extra safety: if row not updated, someone else took it
  if (res.changes === 0) {
    throw new Error(`MEETING_${id}_NOT_SCHEDULED`);
  }
}

export function markCompleted(id: number) {
  db.prepare(`
    UPDATE meetings
    SET status='completed',
        updated_at=?
    WHERE id=?
  `).run(Date.now(), id);
}

export function markFailed(id: number) {
  db.prepare(`
    UPDATE meetings
    SET status='failed',
        updated_at=?
    WHERE id=?
  `).run(Date.now(), id);
}