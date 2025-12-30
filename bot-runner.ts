import { chromium } from 'playwright';
import { createSink, removeSink } from './src/lib/pulseManager';
import { startRecording, stopRecording } from './src/lib/linuxAudioRecorder';
import { waitUntilInsideMeeting, watchMeetingExit } from './src/util/meetingState';
import { markCompleted, markFailed, updateHeartbeat } from './src/db/meetingStore';

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

/**
 * 🔥 Runtime-safe detection
 * - VPS / CI / no DISPLAY  → headless
 * - Local dev with DISPLAY → headed
 */
const IS_HEADLESS =
  process.env.HEADLESS === '1' ||
  process.env.CI === 'true' ||
  !process.env.DISPLAY;

(async () => {
  const meetId = extractMeetId(meetingUrl);
  const sinkName = `g_meet_${meetId}`;

  console.log(`🤖 Bot started`);
  console.log(`🔊 Using isolated sink: ${sinkName}`);
  console.log(`🖥️ Headless mode: ${IS_HEADLESS}`);

  try {
    /* ===============================
       CREATE ISOLATED SINK
       =============================== */
    createSink(meetId);

    /* ===============================
       LAUNCH CHROME (PORTABLE)
       =============================== */
    const browser = await chromium.launch({
      headless: IS_HEADLESS,
      env: {
        ...process.env,
        PULSE_SINK: sinkName, // 🔥 audio isolation
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

    // Name
    try {
      await page.fill('input[aria-label="Your name"]', 'quantumhash');
    } catch { }

    // Continue without mic/cam
    try {
      const btn = page.locator(
        'button:has-text("Continue without microphone and camera")'
      );
      if (await btn.isVisible({ timeout: 5000 })) {
        await btn.click();
        await page.waitForTimeout(2000);
      }
    } catch { }

    // Ask to join
    await page.click(
      'button:has-text("Ask to join"), button:has-text("Join now")'
    );

    await waitUntilInsideMeeting(page);

    let heartbeatInterval: NodeJS.Timeout | null = null;

    // ❤️ HEARTBEAT — bot alive signal
    heartbeatInterval = setInterval(() => {
      updateHeartbeat(Number(meetingDbId));
    }, 30_000);

    /* ===============================
       START RECORDING
       =============================== */
    startRecording(sinkName, sinkName);

    const shutdown = async (reason: string) => {
      console.log(`🛑 Bot shutdown: ${reason}`);

      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }

      await stopRecording(sinkName);
      removeSink(sinkName);
      await browser.close();
      markCompleted(Number(meetingDbId));
      process.exit(0);
    };

    watchMeetingExit(page, async (reason) => {
      await shutdown(reason);
    });

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (err) {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }

    console.error('❌ Bot failed', err);
    markFailed(Number(meetingDbId));
    removeSink(sinkName);
    process.exit(1);
  }
})();