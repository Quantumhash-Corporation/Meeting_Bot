import { insertMeeting } from './src/db/meetingStore';

/*
Usage:
npx ts-node add-meeting.ts <MEETING_URL> <DELAY_MINUTES>

Example:
npx ts-node add-meeting.ts https://meet.google.com/abc-defg-hij 2
*/

const meetingUrl = process.argv[2];
const delayMinutes = Number(process.argv[3] || 1);

/* =========================
   VALIDATION
   ========================= */

if (!meetingUrl || !/^https:\/\/meet\.google\.com\/[a-z0-9\-]+$/i.test(meetingUrl)) {
  console.error('❌ Invalid Google Meet URL');
  console.error('Usage: npx ts-node add-meeting.ts <MEETING_URL> <DELAY_MINUTES>');
  process.exit(1);
}

if (!Number.isInteger(delayMinutes) || delayMinutes <= 0) {
  console.error('❌ Delay minutes must be a positive integer');
  process.exit(1);
}

/* =========================
   INSERT
   ========================= */

const joinAt = Date.now() + delayMinutes * 60_000;

try {
  insertMeeting(meetingUrl, joinAt);

  console.log('✅ Meeting scheduled');
  console.log('🔗 URL:', meetingUrl);
  console.log('⏰ Join in:', delayMinutes, 'minute(s)');
  console.log('🕒 Join at:', new Date(joinAt).toLocaleString());
} catch (err: any) {
  if (err.message === 'DUPLICATE_MEETING_URL') {
    console.warn('⚠️ Meeting already scheduled (duplicate URL)');
    process.exit(0); // graceful exit
  }

  console.error('❌ Failed to schedule meeting');
  console.error(err);
  process.exit(1);
}