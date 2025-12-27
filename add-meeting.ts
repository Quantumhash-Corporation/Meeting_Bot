import { insertMeeting } from './src/db/meetingStore';

/*
Usage:
npx ts-node add-meeting.ts <MEETING_URL> <DELAY_MINUTES>
*/

const meetingUrl = process.argv[2];
const delayMinutes = Number(process.argv[3] || 1);

if (!meetingUrl || !meetingUrl.includes('meet.google.com')) {
  console.error('❌ Invalid Google Meet URL');
  process.exit(1);
}

if (Number.isNaN(delayMinutes) || delayMinutes <= 0) {
  console.error('❌ Delay must be a positive number');
  process.exit(1);
}

const joinAt = Date.now() + delayMinutes * 60_000;

try {
  insertMeeting(meetingUrl, joinAt);

  console.log('✅ Meeting scheduled');
  console.log('🔗 URL:', meetingUrl);
  console.log('⏰ Join in:', delayMinutes, 'minute(s)');
  console.log('🕒 Join at:', new Date(joinAt).toLocaleString());
} catch (err: any) {
  if (err.message === 'DUPLICATE_MEETING_URL') {
    console.error('❌ You can’t add duplicate meeting links.');
    console.error('This meeting already exists in the system.');
    process.exit(0);
  }

  console.error('❌ Failed to schedule meeting');
  console.error(err);
  process.exit(1);
}