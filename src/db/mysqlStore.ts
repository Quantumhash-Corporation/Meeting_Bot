import 'dotenv/config';
import mysql from 'mysql2/promise';

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
});

/* =========================
   TYPES
========================= */
export interface BotMeeting {
  id: number;
  meeting_link: string;
  scheduled_time: Date;
  status: string;
  bot_name: string;
  last_heartbeat: Date | null;
}

/* =========================
   FETCH NEXT MEETING
========================= */
export async function getNextMeeting(): Promise<BotMeeting | null> {
  const [rows] = await pool.query<any[]>(
    `
    SELECT *
    FROM bot_meetings
    WHERE status = 'scheduled'
      AND scheduled_time <= NOW()
    ORDER BY scheduled_time ASC
    LIMIT 1
    `
  );

  return rows.length ? rows[0] : null;
}

/* =========================
   STATE UPDATES
========================= */
export async function markJoining(id: number) {
  await pool.query(
    `
    UPDATE bot_meetings
    SET status='joining',
        started_at=NOW(),
        last_heartbeat=NOW()
    WHERE id=? AND status='scheduled'
    `,
    [id]
  );
}

export async function markCompleted(id: number) {
  await pool.query(
    `
    UPDATE bot_meetings
    SET status='completed',
        ended_at=NOW()
    WHERE id=?
    `,
    [id]
  );
}

export async function markFailed(id: number) {
  await pool.query(
    `
    UPDATE bot_meetings
    SET status='failed',
        ended_at=NOW()
    WHERE id=?
    `,
    [id]
  );
}

export async function updateHeartbeat(id: number) {
  try {
    await pool.query(
      `
      UPDATE bot_meetings
      SET last_heartbeat = NOW(),
          updated_at = NOW()
      WHERE id = ?
      `,
      [id]
    );
  } catch (err) {
    // NEVER crash bot for heartbeat
    console.warn('⚠️ Heartbeat DB error ignored');
  }
}

/* =========================
   CRASH RECOVERY
========================= */
export async function getStaleRunningMeetings(staleMs: number) {
  const [rows] = await pool.query<any[]>(
    `
    SELECT *
    FROM bot_meetings
    WHERE status='running'
      AND last_heartbeat IS NOT NULL
      AND last_heartbeat < (NOW() - INTERVAL ? SECOND)
    `,
    [Math.floor(staleMs / 1000)]
  );

  return rows;
}

export async function reviveMeeting(id: number) {
  await pool.query(
    `
    UPDATE bot_meetings
    SET status='scheduled'
    WHERE id=?
    `,
    [id]
  );
}

export async function updateRecordingPath(
  meetingId: number,
  recordingUrl: string
) {
  await pool.query(
    `
    UPDATE bot_meetings
    SET recording_path = ?,
        updated_at = NOW()
    WHERE id = ?
    `,
    [recordingUrl, meetingId]
  );
}