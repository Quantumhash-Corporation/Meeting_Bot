import { chromium } from 'playwright';
import { createSink, removeSink } from './src/lib/pulseManager';
import { startRecording, stopRecording } from './src/lib/linuxAudioRecorder';
import { waitUntilInsideMeeting, watchMeetingExit } from './src/util/meetingState';
import { markCompleted, markFailed } from './src/db/meetingStore';

const meetingDbId = process.argv[2];
const meetingUrl = process.argv[3];

if (!meetingDbId || !meetingUrl) {
  console.error('❌ Missing meetingId or meetingUrl');
  process.exit(1);
}

function extractMeetId(url: string) {
  const m = url.match(/meet\.google\.com\/([a-z0-9\-]+)/i);
  if (!m) return 'unknown';
  return m[1].replace(/-/g, '_');
}

(async () => {
  const meetId = extractMeetId(meetingUrl);
  const sinkName = `g_meet_${meetId}`;

  console.log(`🤖 Bot started`);
  console.log(`🔊 Using isolated sink: ${sinkName}`);

  try {
    /* ===============================
       CREATE ISOLATED SINK
       =============================== */
    createSink(meetId);

    /* ===============================
       LAUNCH CHROME WITH FIXED SINK
       =============================== */
    const browser = await chromium.launch({
      headless: false, // ❗ MUST BE FALSE
      env: {
        ...process.env,
        PULSE_SINK: sinkName,
        DISPLAY: ':99',
      },
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
        '--autoplay-policy=no-user-gesture-required',
      ],
    });

    const context = await browser.newContext({ permissions: [] });
    const page = await context.newPage();

    console.log('🌐 Opening meeting...');
    await page.goto(meetingUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);

    // name
    try {
      await page.fill('input[aria-label="Your name"]', 'quantumhash');
    } catch { }

    // continue without mic/cam
    try {
      const btn = page.locator(
        'button:has-text("Continue without microphone and camera")'
      );
      if (await btn.isVisible({ timeout: 5000 })) {
        await btn.click();
        await page.waitForTimeout(2000);
      }
    } catch { }

    // ask to join
    await page.click(
      'button:has-text("Ask to join"), button:has-text("Join now")'
    );

    await waitUntilInsideMeeting(page);

    /* ===============================
       START RECORDING (SINK MONITOR)
       =============================== */
    startRecording(sinkName, sinkName);

    const shutdown = async (reason: string) => {
      console.log(`🛑 Bot shutdown: ${reason}`);
      await stopRecording(sinkName);
      removeSink(sinkName);
      await browser.close();
      markCompleted(Number(meetingDbId));
      process.exit(0);
    };

    watchMeetingExit(page, async () => {
      await shutdown('Meeting ended');
    });

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (err) {
    console.error('❌ Bot failed', err);
    markFailed(Number(meetingDbId));
    removeSink(sinkName);
    process.exit(1);
  }
})();