import { spawn } from 'child_process';
import path from 'path';
import {
  getNextMeeting,
  markJoining,
  markFailed,
  getStaleRunningMeetings,
  reviveMeeting,
} from './src/db/mysqlStore';

console.log('🧠 Scheduler started');

const BOT_RUNNER = path.join(process.cwd(), 'bot-runner.ts');
const CHECK_INTERVAL = 5000;
const MAX_PARALLEL_BOTS = 10;

const runningBots = new Set<number>();

/* ===============================
   CRASH RECOVERY LOOP
=============================== */
setInterval(async () => {
  try {
    const stale = await getStaleRunningMeetings(90_000);

    for (const m of stale) {
      console.log(`♻️ Reviving crashed meeting ${m.id}`);
      await reviveMeeting(m.id);
    }
  } catch (err) {
    console.error('❌ Crash recovery error', err);
  }
}, 30_000);

/* ===============================
   MAIN SCHEDULER LOOP
=============================== */
setInterval(async () => {
  try {
    if (runningBots.size >= MAX_PARALLEL_BOTS) return;

    const meeting = await getNextMeeting();
    if (!meeting) return;

    if (runningBots.has(meeting.id)) return;

    console.log('📅 Meeting found', meeting);

    runningBots.add(meeting.id);
    await markJoining(meeting.id);

    const child = spawn(
      'npx',
      ['ts-node', BOT_RUNNER, String(meeting.id), meeting.meeting_link],
      { stdio: 'inherit', shell: true }
    );

    child.on('exit', async (code) => {
      runningBots.delete(meeting.id);
      console.log(`🤖 Bot exited for meeting ${meeting.id} (code=${code})`);

      if (code !== 0) {
        await markFailed(meeting.id);
      }
    });

  } catch (err) {
    console.error('❌ Scheduler loop error', err);
  }
}, CHECK_INTERVAL);