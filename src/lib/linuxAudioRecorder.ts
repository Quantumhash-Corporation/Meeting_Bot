import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import fs from 'fs';
import path from 'path';

const BASE_DIR = path.join(process.cwd(), 'data', 'audio');

type Recorder = {
  process: ChildProcessWithoutNullStreams;
  stopping: boolean;
};

const recorders = new Map<string, Recorder>();

/* =========================
   START RECORDING (ISOLATED)
   ========================= */
export function startRecording(meetingId: string, sink: string) {
  if (recorders.has(meetingId)) {
    console.warn(`[audio] recorder already running → ${meetingId}`);
    return;
  }

  const dir = path.join(BASE_DIR, meetingId);
  fs.mkdirSync(dir, { recursive: true });

  console.log(`[audio] starting recording → ${meetingId}`);
  console.log(`[audio] source = ${sink}.monitor`);

  const ffmpeg = spawn(
    'ffmpeg',
    [
      '-loglevel', 'error',

      // 🔒 HARD LOCK TO THIS SINK ONLY
      '-f', 'pulse',
      '-i', `${sink}.monitor`,

      '-ac', '2',
      '-ar', '48000',
      '-c:a', 'pcm_s16le',

      '-f', 'segment',
      '-segment_time', '60',
      '-reset_timestamps', '1',
      path.join(dir, 'chunk_%03d.wav'),
    ],
    {
      stdio: ['pipe', 'ignore', 'inherit'],
      env: {
        ...process.env,
        PULSE_SINK: sink,
        PULSE_SOURCE: `${sink}.monitor`, // 🔥 CRITICAL
      },
    }
  );

  recorders.set(meetingId, {
    process: ffmpeg,
    stopping: false,
  });
}

/* =========================
   STOP RECORDING (BULLETPROOF)
   ========================= */
export async function stopRecording(meetingId: string) {
  const rec = recorders.get(meetingId);
  if (!rec) return;

  if (rec.stopping) {
    console.warn(`[audio] stop already in progress → ${meetingId}`);
    return;
  }

  rec.stopping = true;
  console.log(`[audio] stopping recording → ${meetingId}`);

  try {
    rec.process.stdin?.write('q');
  } catch { }

  // wait gracefully OR kill
  await Promise.race([
    onceClose(rec.process),
    timeout(5000),
  ]);

  if (!rec.process.killed) {
    try {
      rec.process.kill('SIGKILL');
    } catch { }
  }

  await mergeChunks(meetingId);
  cleanup(meetingId);

  recorders.delete(meetingId);
  console.log(`[audio] recording finalized → ${meetingId}`);
}

/* =========================
   MERGE CHUNKS (ORDER SAFE)
   ========================= */
async function mergeChunks(meetingId: string) {
  const dir = path.join(BASE_DIR, meetingId);

  const chunks = fs
    .readdirSync(dir)
    .filter(f => f.startsWith('chunk_') && f.endsWith('.wav'))
    .sort();

  if (!chunks.length) {
    console.warn(`[audio] no chunks found → ${meetingId}`);
    return;
  }

  const listFile = path.join(dir, 'list.txt');
  const finalFile = path.join(dir, 'final.wav');

  fs.writeFileSync(
    listFile,
    chunks.map(c => `file '${path.join(dir, c)}'`).join('\n')
  );

  console.log(`[audio] merging ${chunks.length} chunks → ${meetingId}`);

  await new Promise<void>((resolve, reject) => {
    const merge = spawn(
      'ffmpeg',
      [
        '-loglevel', 'error',
        '-f', 'concat',
        '-safe', '0',
        '-i', listFile,
        '-c', 'copy',
        finalFile,
      ],
      { stdio: ['ignore', 'ignore', 'inherit'] }
    );

    merge.on('close', code =>
      code === 0 ? resolve() : reject(new Error('ffmpeg merge failed'))
    );
  });

  fs.unlinkSync(listFile);
}

/* =========================
   CLEANUP
   ========================= */
function cleanup(meetingId: string) {
  const dir = path.join(BASE_DIR, meetingId);

  fs.readdirSync(dir)
    .filter(f => f.startsWith('chunk_'))
    .forEach(f => fs.unlinkSync(path.join(dir, f)));

  console.log(`[audio] chunks cleaned → ${meetingId}`);
}

/* =========================
   UTILS
   ========================= */
function onceClose(proc: ChildProcessWithoutNullStreams) {
  return new Promise<void>(res => proc.once('close', () => res()));
}

function timeout(ms: number) {
  return new Promise<void>(res => setTimeout(res, ms));
}