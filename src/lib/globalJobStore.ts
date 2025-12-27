import { JobStore } from './JobStore';

type ScheduledJob = {
  jobId: string;
  runAt: number; // epoch ms
  timer?: NodeJS.Timeout;
};

class GlobalScheduler {
  private store = new JobStore();
  private scheduledJobs = new Map<string, ScheduledJob>();

  get jobStore() {
    return this.store;
  }

  isShutdownRequested(): boolean {
    return this.store.isShutdownRequested();
  }

  isBusy(): boolean {
    return this.store.isBusy();
  }

  /**
   * Schedule a job at exact timestamp
   */
  scheduleExact(
    jobId: string,
    runAt: number,
    fn: () => Promise<void>
  ) {
    if (this.isShutdownRequested()) {
      throw new Error('Scheduler is shutting down');
    }

    const delay = runAt - Date.now();

    if (delay <= 0) {
      // past or immediate → execute now
      this.executeNow(jobId, fn);
      return;
    }

    if (this.scheduledJobs.has(jobId)) {
      throw new Error(`Job already scheduled: ${jobId}`);
    }

    const timer = setTimeout(async () => {
      try {
        await this.executeNow(jobId, fn);
      } finally {
        this.scheduledJobs.delete(jobId);
      }
    }, delay);

    this.scheduledJobs.set(jobId, {
      jobId,
      runAt,
      timer,
    });
  }

  /**
   * Immediate execution (used by scheduler)
   */
  private async executeNow(jobId: string, fn: () => Promise<void>) {
    if (this.isShutdownRequested()) return;

    await this.store.run(jobId, fn);
  }

  /**
   * Cancel a scheduled job
   */
  cancel(jobId: string) {
    const job = this.scheduledJobs.get(jobId);
    if (job?.timer) {
      clearTimeout(job.timer);
      this.scheduledJobs.delete(jobId);
    }
  }

  /**
   * Shutdown scheduler safely
   */
  async shutdown() {
    for (const job of this.scheduledJobs.values()) {
      if (job.timer) clearTimeout(job.timer);
    }
    this.scheduledJobs.clear();
    await this.store.requestShutdown();
  }
}

// ✅ SINGLETON
export const globalScheduler = new GlobalScheduler();

// Backward compatibility
export const globalJobStore = globalScheduler.jobStore;

export const isShutdownRequested = () =>
  globalScheduler.isShutdownRequested();

export const isJobStoreBusy = () =>
  globalScheduler.isBusy();
