import { BrowserContext, Page } from 'playwright';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import config from '../config';
import { getCorrelationIdLog } from '../util/logger';
import path from 'path';

const stealthPlugin = StealthPlugin();
stealthPlugin.enabledEvasions.delete('iframe.contentWindow');
stealthPlugin.enabledEvasions.delete('media.codecs');
chromium.use(stealthPlugin);

export type BotType = 'microsoft' | 'google' | 'zoom';

function attachBrowserErrorHandlers(context: BrowserContext, page: Page, correlationId: string) {
  const log = getCorrelationIdLog(correlationId);

  context.on('close', () => {
    console.log(`${log} Browser context closed`);
  });

  page.on('crash', () => {
    console.error(`${log} Page crashed`);
  });

  page.on('close', () => {
    console.log(`${log} Page closed`);
  });
}

async function createBrowserContext(
  url: string,
  correlationId: string,
  botType: BotType = 'google'
): Promise<Page> {
  const size = { width: 1280, height: 720 };

  const browserArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-web-security',
    '--autoplay-policy=no-user-gesture-required',
    '--enable-usermedia-screen-capturing',
    '--allow-http-screen-capture',
    '--enable-features=MediaRecorder',
    '--enable-audio-service-out-of-process',
    `--window-size=${size.width},${size.height}`,
  ];

  const profileDir = path.resolve(
    process.env.HOME || '/tmp',
    '.meetbot-google-profile'
  );

  console.log(
    `${getCorrelationIdLog(correlationId)} Launching persistent Chrome profile at ${profileDir}`
  );

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    executablePath: config.chromeExecutablePath,
    args: browserArgs,
    viewport: size,
    ignoreHTTPSErrors: true,
    permissions: ['microphone', 'camera'],
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  // 🔑 VERY IMPORTANT
  // This unlocks tab audio for Google Meet
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  attachBrowserErrorHandlers(context, page, correlationId);

  console.log(`${getCorrelationIdLog(correlationId)} Browser ready`);

  return page;
}

export default createBrowserContext;
