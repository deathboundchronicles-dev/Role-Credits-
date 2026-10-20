const { chromium } = require('playwright');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  await fs.mkdir('test-results', { recursive: true });
  const file = path.resolve('test-results/v0.2.5.0-baseline.html');
  await fs.writeFile(file, execFileSync('git', ['show', 'v0.2.5.0:index.html'], { maxBuffer: 10_000_000 }));
  const browser = await chromium.launch({ headless: true, ...(process.env.RC_BROWSER ? { executablePath: process.env.RC_BROWSER } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true });
    await page.goto(pathToFileURL(file).href);
    await page.evaluate(() => { studioNewCharacter(); studioOpenMode('build', 'create'); openSuite('cliqueBackgroundBuilderPanel'); });
    const input = page.locator('#cliqueBackgroundBuilder input').first();
    await input.focus();
    await page.evaluate(() => { window.originalInput = document.activeElement; });
    await input.pressSequentially('Typing test', { delay: 10 });
    const result = await page.evaluate(() => ({ version: '0.2.5.0', attempted: 'Typing test', saved: state.creation.clique.name,
      originalNodeConnected: originalInput.isConnected, retainedFocus: originalInput === document.activeElement }));
    await fs.writeFile('test-results/baseline-reproduction.json', JSON.stringify(result, null, 2));
    console.log(result);
    if (result.originalNodeConnected || result.retainedFocus || result.saved === result.attempted) throw new Error('Baseline bug was not reproduced');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
