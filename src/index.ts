// Ensure global Web Crypto API is available (needed by Azure SDK, polyfill for older Node versions)
import './shims/crypto-polyfill';
import http from 'http';
import app, { redisConsumerService, setGracefulShutdown } from './app';
import { globalJobStore } from './lib/globalJobStore';
import messageBroker from './connect/messageBroker';
import config from './config';

import { SchedulerWorker } from './services/schedulerWorker';
import { createLogger } from './util/logger';

const port = 3000;

// Create Express server
const server = http.createServer(app);

server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);

  // 🔹 START SCHEDULER WORKER
  const logger = createLogger('scheduler');
  const schedulerWorker = new SchedulerWorker(logger);
  schedulerWorker.start();
});

// Flag to prevent multiple shutdown attempts
let shutdownInProgress = false;

const initiateGracefulShutdown = async () => {
  if (shutdownInProgress) {
    console.log('Shutdown already in progress, ignoring signal');
    return;
  }

  shutdownInProgress = true;
  console.log('Initiating graceful shutdown...');

  try {
    // Set the graceful shutdown flag
    setGracefulShutdown(1);

    // Request shutdown on the job store (prevents new jobs from being accepted)
    globalJobStore.requestShutdown();

    // Wait for ongoing tasks to complete
    await globalJobStore.waitForCompletion();

    gracefulShutdownApp();
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('SIGTERM', initiateGracefulShutdown);
process.on('SIGINT', initiateGracefulShutdown);
process.on('SIGABRT', initiateGracefulShutdown);

export const gracefulShutdownApp = () => {
  server.close(async () => {
    console.log('HTTP server closed. Exiting application');

    if (config.redis.enabled) {
      await redisConsumerService.shutdown();
      await messageBroker.quitClientGracefully();
    }

    process.exit(0);
  });
};
