import { chromium } from 'playwright';
import { createSink, setDefaultSink, removeSink } from './src/lib/pulseManager';
import { startRecording, stopRecording } from './src/lib/linuxAudioRecorder';
import { waitUntilInsideMeeting, watchMeetingExit } from './src/util/meetingState';
import { getGoogleMeetId } from './src/util/meetingId';

/* ===============================
   CONFIG
   =============================== */

const MEET_URL = 'https://meet.google.com/qnh-vezo-vkq';
const BOT_NAME = 'quantumhash';

/* ===============================
   HELPERS
   =============================== */

async function dismissMicCameraPrompt(page: any) {
  try {
    const btn = page.locator(
      'button:has-text("Continue without microphone and camera")'
    );

    if (await btn.isVisible({ timeout: 5000 })) {
      console.log('🎛️ Clicking "Continue without microphone and camera"');
      await btn.click();
      await page.waitForTimeout(2000);
    }
  } catch {
    console.log('ℹ️ Mic/Camera prompt not present');
  }
}

/* ===============================
   MAIN
   =============================== */

(async () => {
  console.log('🚀 Linux Google Meet Bot Test');

  /* ===== MEETING ID (SINGLE SOURCE OF TRUTH) ===== */
  const meetingId = getGoogleMeetId(MEET_URL);
  console.log('🆔 Meeting ID:', meetingId);

  /* ===== LAUNCH BROWSER ===== */
  const browser = await chromium.launch({
    headless: false, // dev: false | prod: true + xvfb
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });

  const context = await browser.newContext({
    permissions: [], // ❌ hard deny mic / cam
  });

  const page = await context.newPage();

  /* ===== OPEN MEETING ===== */
  console.log('🌐 Opening Google Meet...');
  await page.goto(MEET_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(6000);

  /* ===== SET NAME ===== */
  try {
    await page.fill('input[aria-label="Your name"]', BOT_NAME);
  } catch { }

  /* ===== DISMISS MIC/CAM PROMPT (CRITICAL) ===== */
  await dismissMicCameraPrompt(page);

  /* ===== ASK TO JOIN ===== */
  try {
    await page.click(
      'button:has-text("Ask to join"), button:has-text("Join now")'
    );
    console.log('✅ Ask to join clicked');
  } catch {
    console.log('⚠️ Ask to join button not found');
  }

  /* ===== WAIT UNTIL INSIDE MEETING ===== */
  await waitUntilInsideMeeting(page);

  /* ===== AUDIO PIPELINE (AFTER JOIN ONLY) ===== */
  const sink = createSink(meetingId);
  setDefaultSink(sink);
  startRecording(meetingId, sink);

  /* ===== CLEAN SHUTDOWN (ONCE) ===== */
  let shuttingDown = false;

  const shutdown = async (reason: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`🛑 Shutdown: ${reason}`);

    try {
      await stopRecording(meetingId);
    } catch { }

    try {
      removeSink(sink);
    } catch { }

    try {
      await browser.close();
    } catch { }

    process.exit(0);
  };

  /* ===== WATCH MEETING EXIT ===== */
  watchMeetingExit(page, async () => {
    await shutdown('Meeting ended');
  });

  /* ===== SIGNAL HANDLING ===== */
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
})();