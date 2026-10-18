// Renders public/icons/icon.svg to the PNG sizes the manifest and iOS need.
// Usage: node scripts/icons.mjs   (uses the Playwright Chromium)
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const svg = readFileSync('public/icons/icon.svg', 'utf8');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
for (const [size, name] of [[192, 'icon-192.png'], [512, 'icon-512.png'], [180, 'apple-touch-icon.png']]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:#14213d}</style>${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}`);
  await page.screenshot({ path: `public/icons/${name}`, omitBackground: false });
}
await browser.close();
console.log('icons written');
