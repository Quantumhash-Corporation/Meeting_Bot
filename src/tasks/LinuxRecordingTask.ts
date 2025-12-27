import { Task } from './Task';
import { createSink, setDefaultSink, removeSink } from '../lib/pulseManager';
import { startRecording, stopRecording } from '../lib/linuxAudioRecorder';
import { Logger } from 'winston';

interface Input {
  meetingId: string;
}

export class LinuxRecordingTask extends Task<Input, void> {
  private sink: string | null = null;

  constructor(logger: Logger) {
    super(logger);
  }

  protected async execute({ meetingId }: Input): Promise<void> {
    this._logger.info('🎙️ LinuxRecordingTask starting', { meetingId });

    // 1️⃣ create sink
    this.sink = createSink(meetingId);
    this._logger.info('🔊 Sink created', { sink: this.sink });

    // 2️⃣ route audio to sink
    setDefaultSink(this.sink);
    this._logger.info('🎚️ Default sink set', { sink: this.sink });

    // 3️⃣ start ffmpeg
    startRecording(meetingId, this.sink);
    this._logger.info('⏺️ Recording started', { meetingId });

    // 4️⃣ WAIT — task stays alive
    await new Promise<void>(() => { });
  }

  public async stop(meetingId: string) {
    this._logger.info('🛑 LinuxRecordingTask stopping', { meetingId });

    try {
      await stopRecording(meetingId);
      this._logger.info('✅ Recording stopped & merged', { meetingId });
    } catch (e) {
      this._logger.error('❌ Error stopping recording', e);
    }

    if (this.sink) {
      removeSink(this.sink);
      this._logger.info('🧹 Sink removed', { sink: this.sink });
    }
  }
}