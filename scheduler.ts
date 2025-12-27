import { spawn } from 'child_process';
import path from 'path';
import { getNextMeeting, markRunning, markFailed } from './src/db/meetingStore';

console.log('🧠 Scheduler started');

/* ===============================
   CONFIG
   =============================== */
const CHECK_INTERVAL = 5000;
const BOT_RUNNER = path.join(process.cwd(), 'bot-runner.ts');

/* ===============================
   IN-MEMORY LOCK
   =============================== */
const runningBots = new Set<number>();

/* ===============================
   SCHEDULER LOOP
   =============================== */
setInterval(() => {
  try {
    const now = Date.now();
    const meeting = getNextMeeting(now);

    if (!meeting) {
      console.log('⏳ No meeting yet');
      return;
    }

    // 🚫 already running (extra safety)
    if (runningBots.has(meeting.id)) {
      console.log(`⚠️ Meeting ${meeting.id} already running`);
      return;
    }

    console.log('📅 Meeting found', meeting);

    // 🔒 LOCK
    runningBots.add(meeting.id);
    markRunning(meeting.id);

    console.log(`🤖 Launching bot for meeting ${meeting.id}`);

    const child = spawn(
      'npx',
      [
        'ts-node',
        BOT_RUNNER,
        String(meeting.id),
        meeting.meeting_url,
      ],
      {
        stdio: 'inherit',
        shell: true,
      }
    );

    child.on('exit', (code) => {
      console.log(`🤖 Bot exited for meeting ${meeting.id} (code=${code})`);

      // 🔓 UNLOCK
      runningBots.delete(meeting.id);

      // bot-runner already marks completed
      if (code !== 0) {
        console.log(`❌ Bot crashed for meeting ${meeting.id}`);
        markFailed(meeting.id);
      }
    });

    child.on('error', (err) => {
      console.error(`❌ Failed to spawn bot for meeting ${meeting.id}`, err);
      runningBots.delete(meeting.id);
      markFailed(meeting.id);
    });

  } catch (err) {
    console.error('❌ Scheduler loop error', err);
  }
}, CHECK_INTERVAL);