import { ContentType } from '../types';

/**
 * Browser MediaRecorder configuration
 * Used by Google Meet & Zoom bots
 */

/**
 * MIME types (order matters)
 * Chrome stable support
 */
export const webmMimeType = 'video/webm;codecs=vp9,opus';
export const vp9MimeType = 'video/webm;codecs=vp9';

/**
 * Content types
 */
export const webmContentType: ContentType = 'video/webm';

/**
 * Chunking (browser side)
 * MediaRecorder.start(timeslice)
 */
export const MEDIARECORDER_CHUNK_MS = 2000;

/**
 * File naming
 */
export const RECORDING_FILE_EXTENSION = '.webm';

/**
 * NOTE:
 * - No WAV
 * - No PulseAudio
 * - No sample rate control (browser handles it)
 *
 * Audio captured = Google Meet tab audio
 * NOT microphone
 */
