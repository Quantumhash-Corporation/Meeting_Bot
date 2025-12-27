import { createSink, setDefaultSink, removeSink } from './src/lib/pulseManager';
import { startRecording, stopRecording } from './src/lib/linuxAudioRecorder';

const meetingId = `test_${Date.now()}`;

const sink = createSink(meetingId);
setDefaultSink(sink);

startRecording(meetingId, sink);

setTimeout(async () => {
  await stopRecording(meetingId);
  removeSink(sink);
  console.log('DONE');
}, 120000);