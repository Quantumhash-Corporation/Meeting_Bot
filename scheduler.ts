import { spawn } from 'child_process';
import path from 'path';
import {
  getNextMeeting,
  markRunning,
  markFailed,
  getStaleRunningMeetings,
  reviveMeeting,
} from './src/db/meetingStore';

console.log('🧠 Scheduler started');

// 🔁 CRASH AUTO-REJOIN SCANNER
setInterval(() => {
  try {
    const STALE_AFTER = 90_000; // 90 sec heartbeat gap

    const staleMeetings = getStaleRunningMeetings(STALE_AFTER);

    for (const m of staleMeetings) {
      console.log(`♻️ Reviving crashed meeting ${m.id}`);
      reviveMeeting(m.id);
    }
  } catch (err) {
    console.error('❌ Crash recovery error', err);
  }
}, 30_000); // scan every 30 sec

/* ===============================
   CONFIG
   =============================== */
const MAX_PARALLEL_BOTS = Number(process.env.MAX_PARALLEL_BOTS || 10);
const CHECK_INTERVAL = 5000;
const BOT_RUNNER = path.join(process.cwd(), 'bot-runner.ts');

/* ===============================
   IN-MEMORY SAFETY LOCK
   =============================== */
const runningBots = new Set<number>();

let idleLogged = false;



/* ===============================
   SCHEDULER LOOP
   =============================== */
setInterval(() => {
  try {
    const now = Date.now();

    // 🔥 FIX: correct function + pick first meeting
    const meeting = getNextMeeting(now);

    if (!meeting) {
      if (!idleLogged) {
        console.log('⏳ No meeting yet');
        idleLogged = true;
      }
      return;
    }

    // reset idle state once meeting appears
    idleLogged = false;

    if (runningBots.has(meeting.id)) {
      return;
    }

    console.log('📅 Meeting found', meeting);

    runningBots.add(meeting.id);
    markRunning(meeting.id);

    console.log(`🤖 Launching bot for meeting ${meeting.id}`);

    const child = spawn(
      'npx',
      ['ts-node', BOT_RUNNER, String(meeting.id), meeting.meeting_url],
      { stdio: 'inherit', shell: true }
    );

    child.on('exit', (code) => {
      runningBots.delete(meeting.id);
      console.log(`🤖 Bot exited for meeting ${meeting.id} (code=${code})`);

      if (code !== 0) {
        markFailed(meeting.id);
      }
    });

  } catch (err) {
    console.error('❌ Scheduler loop error', err);
  }
}, CHECK_INTERVAL);