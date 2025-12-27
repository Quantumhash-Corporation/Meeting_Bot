import { spawn } from 'child_process';
import path from 'path';
import {
  getNextMeetings,
  markRunning,
  markFailed,
} from './src/db/meetingStore';

console.log('🧠 Scheduler started');

/* ===============================
   CONFIG
   =============================== */
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
    const meetings = getNextMeetings(now, 1);
    const meeting = meetings[0];

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