const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs/promises');

const html = path.resolve(process.env.RC_HTML || 'Role_Credits_Studio_Standalone.html');
const output = path.resolve('test-results');
const pack = { format: 'RoleCreditsHomebrew', schemaVersion: 2, name: 'Mobile Pack', items: [
  { type: 'equipment', data: { id: 'scanner', name: 'Pocket Scanner', category: 'Tool', rank: 1, availability: 'Common', tags: ['Small', 'Electronic', 'Portable'] } },
  { type: 'scenes', data: { id: 'alley', name: 'The Alley', type: 'Information', mapSize: 'Standard', question: 'Who was here?' } }
] };

async function run() {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.RC_BROWSER ? { executablePath: process.env.RC_BROWSER } : {}) });
  const results = [];
  try {
    for (const profile of [
      { name: 'windows', viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false },
      { name: 'android', viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36' },
      { name: 'tablet', viewport: { width: 800, height: 1024 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' }
    ]) {
      const context = await browser.newContext({ ...profile, name: undefined, offline: true });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(pathToFileURL(html).href);
      try { await page.waitForFunction(() => typeof studioOpenMode === 'function' && document.querySelector('#studioHome .studio-card')); }
      catch (error) { console.error('App errors:', errors); console.error((await page.locator('body').innerText()).slice(-2000)); throw error; }
      await page.evaluate(() => { studioNewCharacter(); studioOpenMode('build', 'create'); openSuite('cliqueBackgroundBuilderPanel'); });
      const name = page.locator('[data-draft-bind="clique.name"]');
      await name.fill('');
      await name.focus();
      await page.evaluate(() => { window.testInput = document.activeElement; window.testBlurCount = 0; testInput.addEventListener('blur', () => window.testBlurCount++); });
      await name.pressSequentially('Midnight Cartographers', { delay: 12 });
      assert.equal(await name.inputValue(), 'Midnight Cartographers');
      assert.deepEqual(await page.evaluate(() => ({ same: document.activeElement === window.testInput, connected: testInput.isConnected, blurs: testBlurCount, saved: JSON.parse(localStorage.getItem('roleCreditsStudio')).creation.clique.name })),
        { same: true, connected: true, blurs: 0, saved: 'Midnight Cartographers' });
      await name.press('ArrowLeft');
      await name.press('ArrowLeft');
      await name.pressSequentially('X');
      assert.equal(await name.inputValue(), 'Midnight CartographeXrs');
      assert.equal(await name.evaluate(element => element.selectionStart), 21);
      const once = page.locator('[data-draft-bind="clique.once"]');
      await once.fill(''); await once.pressSequentially('Find the hidden path.', { delay: 5 });
      assert.equal(await once.inputValue(), 'Find the hidden path.');
      assert.equal(await once.evaluate(element => element === document.activeElement), true);
      await page.evaluate(() => { openSuite('characterBuilderPanel'); });
      const dropdown = page.locator('#characterBuilder select[onchange="characterBackgroundChange(this.value)"]');
      await dropdown.scrollIntoViewIfNeeded(); await dropdown.focus();
      await page.evaluate(() => { window.beforeScroll = window.scrollY; window.beforeSelect = document.activeElement; });
      const options = await dropdown.locator('option').evaluateAll(elements => elements.map(element => element.value));
      await dropdown.selectOption(options.find(value => value !== '__custom__' && value !== 'Medic'));
      assert.equal(await dropdown.evaluate(element => element === window.beforeSelect), true);
      assert.ok(await page.evaluate(() => Math.abs(window.scrollY - window.beforeScroll) < 4), 'Dropdown must preserve scroll');
      await page.evaluate(() => { openSuite('cliqueBackgroundBuilderPanel'); });
      await page.locator('[data-draft-bind="clique.name"]').focus();
      await page.evaluate(() => {
        const input = document.activeElement;
        input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
        input.value += '地図'; input.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
        input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
      });
      assert.equal(await page.locator('[data-draft-bind="clique.name"]').evaluate(element => element === document.activeElement), true);
      await page.reload();
      assert.ok(await page.evaluate(() => state.creation.clique.name.endsWith('地図')));
      await page.evaluate(() => { studioOpenMode('build', 'create'); openSuite('creationLibraryPanel'); });
      const before = await page.evaluate(() => JSON.stringify({ character: state.character, scene: state.scene, team: state.team, roster: state.playerRoster, creation: state.creation, active: state.activeCharacterId, campaigns: campaignStore.campaigns }));
      await page.locator('[data-hb-action="import"]').click();
      await page.locator('#hbImportText').fill(JSON.stringify(pack));
      await page.locator('[data-hb-action="preview-import"]').click();
      assert.equal(await page.evaluate(() => state.library.equipment.length), 0);
      await page.locator('[data-hb-action="commit-import"]').click();
      assert.equal(await page.locator('.hb-card').count(), 2);
      assert.equal(await page.evaluate(() => JSON.stringify({ character: state.character, scene: state.scene, team: state.team, roster: state.playerRoster, creation: state.creation, active: state.activeCharacterId, campaigns: campaignStore.campaigns })), before);
      await page.locator('#hbSearch').pressSequentially('scanner', { delay: 12 });
      assert.equal(await page.locator('.hb-card').count(), 1);
      assert.equal(await page.locator('#hbSearch').evaluate(element => element === document.activeElement), true);
      await page.locator('[data-hb-select]').check();
      await page.locator('#hbCollectionName').fill('Field Kit');
      await page.locator('[data-hb-action="collection"]').click();
      assert.equal(await page.locator('#hbCollection').inputValue(), await page.evaluate(() => state.library.collections[0].id));
      const downloadEvent = page.waitForEvent('download');
      await page.locator('[data-hb-action="export-collection"]').click();
      const download = await downloadEvent;
      const downloadPath = path.join(output, profile.name + '-pack.json');
      await download.saveAs(downloadPath);
      const downloaded = JSON.parse(await fs.readFile(downloadPath, 'utf8'));
      assert.equal(downloaded.items.length, 1);
      assert.equal(downloaded.items[0].data.name, 'Pocket Scanner');
      const nativeExport = await page.evaluate(async () => {
        let exported;
        window.RoleCreditsAndroid = { saveTextFile: (name, json) => { exported = { name, pack: JSON.parse(json) }; } };
        try { await hbExport(['equipment:scanner'], 'Native_Test'); } finally { delete window.RoleCreditsAndroid; }
        return exported;
      });
      assert.equal(nativeExport.name, 'Native_Test.json');
      assert.equal(nativeExport.pack.schemaVersion, 2);
      assert.equal(nativeExport.pack.items.length, 1);
      await page.locator('[data-hb-action="import"]').click();
      await page.locator('#hbImportFile').setInputFiles(downloadPath);
      await page.waitForSelector('[data-hb-choice]');
      assert.equal(await page.locator('[data-hb-action="commit-import"]').isDisabled(), true);
      await page.locator('[data-hb-choice="0"]').selectOption('copy');
      await page.locator('[data-hb-action="commit-import"]').click();
      assert.equal(await page.evaluate(() => state.library.equipment.length), 2);
      assert.equal(await page.evaluate(() => state.library.equipment[0].name), 'Pocket Scanner');
      assert.equal(await page.evaluate(() => state.library.equipment[1].name), 'Pocket Scanner (copy)');
      assert.ok(await page.evaluate(() => !!localStorage.getItem(hbBackupKey())));
      const rollback = await page.evaluate(() => {
        const original = JSON.stringify(state.library), saved = localStorage.getItem('roleCreditsStudio');
        const setter = Storage.prototype.setItem;
        let failOnce = true, message = '';
        Storage.prototype.setItem = function (key, value) {
          if (key === 'roleCreditsStudio' && failOnce) { failOnce = false; throw new DOMException('test full storage', 'QuotaExceededError'); }
          return setter.call(this, key, value);
        };
        try { hbPersistLibrary({ ...structuredClone(state.library), equipment: [] }); } catch (error) { message = error.message; }
        finally { Storage.prototype.setItem = setter; }
        return { unchanged: original === JSON.stringify(state.library), storage: saved === localStorage.getItem('roleCreditsStudio'), message };
      });
      assert.equal(rollback.unchanged, true);
      assert.equal(rollback.storage, true);
      assert.match(rollback.message, /not changed/);
      await page.locator('[data-hb-action="restore"]').click();
      await page.locator('[data-hb-action="preview-restore"]').click();
      await page.locator('[data-hb-action="commit-restore"]').click();
      assert.equal(await page.evaluate(() => state.library.equipment.length), 2);
      const campaignDataBeforePack = await page.evaluate(() => JSON.stringify({ character: state.character, team: state.team, scene: state.scene }));
      await page.evaluate(async payload => {
        importData({ target: { files: [new File([JSON.stringify(payload)], 'pack.json', { type: 'application/json' })] } });
      }, pack);
      await page.waitForSelector('[data-hb-choice]');
      assert.equal(await page.evaluate(() => JSON.stringify({ character: state.character, team: state.team, scene: state.scene })), campaignDataBeforePack);
      await page.locator('[data-hb-action="close"]').first().click();
      await page.evaluate(() => hbPreviewImport(JSON.stringify(hbModel.pack({ equipment: [state.library.equipment[0]] }, null, { backup: true }))));
      await page.locator('[data-hb-action="preview-restore"]').click();
      await page.locator('[data-hb-action="commit-restore"]').click();
      assert.equal(await page.evaluate(() => state.library.equipment.length), 1);
      assert.equal(await page.evaluate(() => state.library.scenes.length), 0);
      assert.equal(await page.evaluate(() => JSON.stringify({ character: state.character, team: state.team, scene: state.scene })), campaignDataBeforePack);
      await page.locator('#hbSearch').fill('');
      await page.locator('#hbCollection').selectOption('');
      await page.evaluate(payload => { hbPersistLibrary(hbModel.plan(hbLibrary(), payload, { 0: 'copy' }).library); renderHomebrewLibrary(); }, pack);
      const importedScene = page.locator('.hb-card[data-key="scenes:alley"] [data-hb-action="edit"]');
      await importedScene.click();
      await page.locator('[data-draft-bind="scene.question"]').fill('Can this imported scene be edited?');
      await page.evaluate(() => openSuite('creationLibraryPanel'));
      await page.screenshot({ path: path.join(output, profile.name + '-library.png'), fullPage: true });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'No horizontal overflow');
      let auditedFields = 0;
      for (const [suite, root] of [['characterBuilderPanel', 'characterBuilder'], ['cliqueBackgroundBuilderPanel', 'cliqueBackgroundBuilder'], ['signatureBuilderPanel', 'signatureBuilder'], ['techniqueBuilderPanel', 'techniqueBuilder'], ['gearAssetBuilderPanel', 'gearAssetBuilder'], ['threatBuilderPanel', 'threatBuilder'], ['teamBuilderPanel', 'teamBuilder'], ['adventureBuilderPanel', 'adventureBuilder'], ['missionSceneBuilderPanel', 'missionSceneBuilder'], ['crisisBuilderPanel', 'crisisBuilder']]) {
        await page.evaluate(id => openSuite(id), suite);
        for (const selector of ['input[data-draft-bind]:not([type=number])', 'textarea[data-draft-bind]']) {
          const field = page.locator('#' + root + ' ' + selector).first();
          if (!await field.count()) continue;
          const original = await field.inputValue();
          await field.fill(''); await field.focus();
          await field.evaluate(element => { window.auditField = element; });
          await field.pressSequentially('Keep typing', { delay: 2 });
          assert.equal(await field.inputValue(), 'Keep typing', suite + ' text');
          assert.equal(await field.evaluate(element => element === window.auditField && element === document.activeElement), true, suite + ' identity');
          await field.fill(original);
          auditedFields++;
        }
      }
      assert.deepEqual(errors, [], 'No browser exceptions');
      results.push({ profile: profile.name, passed: true, viewport: profile.viewport, auditedFields, checks: ['continuous typing', 'stable node identity', 'caret insertion', 'textarea typing', 'dropdown scroll', 'composition', 'save and reload', 'import preview', 'player state preservation', 'search', 'selection and collection', 'file export/import', 'conflict choice', 'local backup', 'exact restore', 'storage failure rollback', 'main importer pack routing', 'imported scene editing', 'all builder suites', 'mobile layout', 'no runtime errors'] });
      console.log(profile.name + ': all browser checks passed');
      await context.close();
    }
  } finally { await browser.close(); await fs.writeFile(path.join(output, 'browser-results.json'), JSON.stringify(results, null, 2)); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
