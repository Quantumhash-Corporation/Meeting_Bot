import { spawn } from 'child_process';
import fs from 'fs';

export class FFmpegRecorder {
  private proc: any;

  start(meetingId: string) {
    const outDir = `/Users/sbapan/Data/audio/${meetingId}`;
    fs.mkdirSync(outDir, { recursive: true });

    this.proc = spawn(
      'ffmpeg',
      [
        '-f', 'avfoundation',
        '-i', ':BlackHole 2ch',
        '-ac', '2',
        '-ar', '44100',
        '-c:a', 'pcm_s16le',

        '-f', 'segment',
        '-segment_time', '10',
        '-reset_timestamps', '1',
        `${outDir}/chunk_%03d.wav`
      ],
      { stdio: 'inherit' }
    );

    console.log('🎙️ BlackHole recording STARTED');
  }

  stop() {
    if (this.proc) {
      this.proc.kill('SIGINT');
      console.log('🛑 BlackHole recording STOPPED');
    }
  }
}
