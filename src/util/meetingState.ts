import type { Page } from 'playwright';

/* ===============================
   WAIT UNTIL INSIDE MEETING
   =============================== */
export async function waitUntilInsideMeeting(page: Page) {
  console.log('⏳ Waiting to enter meeting...');

  const JOIN_TIMEOUT = 5 * 60 * 1000;
  const POLL_INTERVAL = 2000;
  const start = Date.now();

  while (Date.now() - start < JOIN_TIMEOUT) {
    try {
      const url = page.url();
      if (!url.includes('meet.google.com')) {
        await sleep(POLL_INTERVAL);
        continue;
      }

      const leaveBtn = await page.$('button[aria-label="Leave call"]');
      if (leaveBtn) {
        console.log('✅ Bot is inside meeting');
        return;
      }
    } catch { }

    await sleep(POLL_INTERVAL);
  }

  throw new Error('❌ Timed out waiting to join meeting');
}

/* ===============================
   WATCH MEETING EXIT + PEOPLE LOGIC
   =============================== */
export function watchMeetingExit(
  page: Page,
  onExit: () => Promise<void>
) {
  const CHECK_INTERVAL = 3000;
  const JOIN_GRACE_PERIOD = 30_000; // ⏳ 30 sec warm-up
  const joinedAt = Date.now();

  let exited = false;
  let lastParticipantCount: number | null = null;

  const interval = setInterval(async () => {
    if (exited) return;

    try {
      /* ---------- URL check ---------- */
      if (!page.url().includes('meet.google.com')) {
        exited = true;
        clearInterval(interval);
        console.log('🛑 URL left Google Meet');
        await onExit();
        return;
      }

      /* ---------- Forced removal / end ---------- */
      const meetEnded = await page.evaluate(() => {
        const t = document.body.innerText || '';
        return (
          t.includes('You were removed from the meeting') ||
          t.includes('Return to home') ||
          t.includes('No one responded')
        );
      });

      if (meetEnded) {
        exited = true;
        clearInterval(interval);
        console.log('🛑 Meeting ended / removed');
        await onExit();
        return;
      }

      /* ---------- Leave button missing ---------- */
      const leaveBtn = await page.$('button[aria-label="Leave call"]');
      if (!leaveBtn) {
        exited = true;
        clearInterval(interval);
        console.log('🛑 Leave button gone');
        await onExit();
        return;
      }

      /* ---------- ⏳ GRACE PERIOD ---------- */
      if (Date.now() - joinedAt < JOIN_GRACE_PERIOD) {
        return; // 🔕 ignore participant logic for first 30 sec
      }

      /* ---------- 👥 PARTICIPANT LOGIC ---------- */
      const participantCount = await getParticipantCount(page);

      if (participantCount !== null) {

        // log ONLY when count changes
        if (participantCount !== lastParticipantCount) {
          console.log(`👥 Participants detected: ${participantCount}`);
          lastParticipantCount = participantCount;
        }

        if (participantCount < 2) {
          exited = true;
          clearInterval(interval);
          console.log('🛑 Only bot left in meeting → auto exit');
          await onExit();
          return;
        }
      }

    } catch {
      if (!exited) {
        exited = true;
        clearInterval(interval);
        console.log('🛑 Browser/context closed');
        await onExit();
      }
    }
  }, CHECK_INTERVAL);
}

/* ===============================
   PARTICIPANT COUNT (ROBUST)
   =============================== */
async function getParticipantCount(page: Page): Promise<number | null> {
  try {
    return await page.evaluate(() => {

      /* 1️⃣ People button aria-label */
      const peopleBtn = document.querySelector(
        'button[aria-label^="People"]'
      ) as HTMLElement | null;

      if (peopleBtn) {
        const label = peopleBtn.getAttribute('aria-label') || '';
        const match = label.match(/(\d+)/);
        if (match) return Number(match[1]);
      }

      /* 2️⃣ Video tiles count (MOST STABLE) */
      const tiles = document.querySelectorAll(
        'div[data-self-name], div[data-participant-id]'
      );

      if (tiles && tiles.length > 0) {
        return tiles.length;
      }

      return null;
    });
  } catch {
    return null;
  }
}

/* ===============================
   UTILS
   =============================== */
function sleep(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}