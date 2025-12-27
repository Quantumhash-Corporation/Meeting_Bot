import dotenv from 'dotenv';
dotenv.config();

/**
 * Environment
 */
export type Environment =
  | 'production'
  | 'staging'
  | 'development'
  | 'cli'
  | 'test';

export const NODE_ENV: Environment =
  (process.env.NODE_ENV as Environment) || 'development';

/**
 * Helpers
 */
const num = (v: any, d: number) => (v ? Number(v) : d);
const bool = (v: any) => v === 'true';

/**
 * Main config
 */
export default {
  /* Server */
  port: num(process.env.PORT, 3000),

  /* Browser (MAC FIX) */
  chromeExecutablePath:
    process.env.CHROME_PATH ||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',

  /* Google Meet timings */
  joinWaitTimeMinutes: num(process.env.JOIN_WAIT_TIME_MINUTES, 180),

  /* Recording limits */
  maxRecordingDurationMinutes: num(
    process.env.MAX_RECORDING_DURATION_MINUTES,
    180
  ),
  inactivityLimitMinutes: num(
    process.env.MEETING_INACTIVITY_MINUTES,
    5
  ),
  inactivityDetectionDelayMinutes: num(
    process.env.INACTIVITY_DETECTION_START_DELAY_MINUTES,
    2
  ),

  /**
   * AUDIO (MAC MODE)
   * ⚠️ PulseAudio / ffmpeg DISABLED on Mac
   * Browser MediaRecorder only
   */
  audio: {
    sampleRate: 48000,     // Chrome native
    channels: 2,           // Stereo (Meet audio)
    bitDepth: 16,
    chunkSeconds: 5,
    mode: 'browser',       // 🔴 IMPORTANT
  },

  /**
   * LOCAL STORAGE (FOR DEV TESTING)
   * Audio will be saved here 👇
   */
  audioStoragePath:
    process.env.AUDIO_STORAGE_PATH ||
    '/Users/sbapan/Data/audio',

  /* Storage */
  storageProvider: 'local' as const,

  /* Redis — disabled for local dev */
  redis: {
    enabled: false,
    uri: '',
    queueName: '',
  },

  /* Notifications — disabled */
  notifications: {
    webhookEnabled: false,
    webhookUrl: '',
    redisEnabled: false,
    redisList: '',
  },
};
