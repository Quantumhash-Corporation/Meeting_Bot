import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const BASE_DIR = '/Users/sbapan/Data/audio/meet';
const CONCAT_FILE = path.join(BASE_DIR, 'concat.txt');
const FINAL_FILE = path.join(BASE_DIR, 'final.wav');

export function updateAndMergeAudio() {
  const chunks = fs
    .readdirSync(BASE_DIR)
    .filter(f => f.startsWith('chunk_') && f.endsWith('.wav'))
    .sort();

  if (chunks.length === 0) return;

  // Build concat.txt
  const concatContent = chunks
    .map(f => `file '${path.join(BASE_DIR, f)}'`)
    .join('\n');

  fs.writeFileSync(CONCAT_FILE, concatContent);

  // Merge → final.wav
  const ffmpeg = spawn('ffmpeg', [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', CONCAT_FILE,
    '-c', 'copy',
    FINAL_FILE
  ]);

  ffmpeg.on('exit', () => {
    console.log(`🔗 Merged ${chunks.length} chunks → final.wav`);
  });
}
