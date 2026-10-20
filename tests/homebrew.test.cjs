const { test } = require('node:test');
const assert = require('node:assert/strict');
const homebrew = require('../app/homebrew.js');

const equipment = (id = 'gear-1', name = 'Pocket Scanner') => ({ type: 'equipment', data: { id, name, rank: 1, category: 'Tool', availability: 'Common', tags: ['Small', 'Electronic', 'Portable'] } });
const document = items => ({ format: homebrew.FORMAT, schemaVersion: 2, name: 'Test pack', items });

test('every supported asset type survives a versioned JSON round trip', () => {
  const samples = {
    cliques: { plus: 'Body', minus: 'Mind', edge: ['Athletics'] },
    backgrounds: { d8: 'Athletics', d6: ['Investigation', 'Presence'] },
    techniques: { rank: 1, category: 'Training', tags: ['Fast', 'Quiet', 'Sharp'] },
    equipment: { rank: 1 }, assets: { rating: 1 }, threats: { rating: 2 },
    characters: { snapshot: { name: 'Player', tokens: 7 } }, characterBuilds: { snapshot: { name: 'Draft', dots: {} } },
    teams: { snapshot: { name: 'Crew', tokens: 9 } }
  };
  const library = Object.fromEntries(Object.keys(homebrew.TYPES).map(type => [type, type === 'customTags' ? ['Luminous'] : [{ id: type + '-1', name: 'Custom ' + type, ...samples[type] }]]));
  library.collections = [{ id: 'collection-1', name: 'Starter Pack', members: [{ type: 'equipment', id: 'equipment-1' }] }];
  const exported = homebrew.pack(library);
  const parsed = homebrew.parse(JSON.stringify(exported));
  const restored = homebrew.plan({}, parsed);
  assert.deepEqual(restored.unresolved, []);
  assert.equal(restored.added, Object.keys(homebrew.TYPES).length);
  assert.deepEqual(homebrew.pack(restored.library).items, parsed.items);
  assert.deepEqual(restored.library.collections, library.collections);
});

test('ID and normalized name conflicts require explicit choices; plans never mutate storage', () => {
  const library = { equipment: [equipment().data] }, before = structuredClone(library);
  const source = document([equipment('other-id', '  POCKET SCANNER  ')]);
  const preview = homebrew.plan(library, source);
  assert.equal(preview.unresolved.length, 1);
  assert.deepEqual(library, before);
  const skipped = homebrew.plan(library, source, { 0: 'skip' });
  assert.equal(skipped.added, 0);
  const copied = homebrew.plan(library, source, { 0: 'copy' });
  assert.equal(copied.library.equipment.length, 2);
  assert.notEqual(copied.library.equipment[1].id, 'other-id');
  assert.equal(copied.library.equipment[1].name, 'POCKET SCANNER (copy)');
  const replaced = homebrew.plan(library, document([equipment('gear-1', 'Updated scanner')]), { 0: 'replace:gear-1' });
  assert.equal(replaced.library.equipment.length, 1);
  assert.equal(replaced.library.equipment[0].id, 'gear-1');
  assert.equal(replaced.library.equipment[0].name, 'Updated scanner');
  assert.throws(() => homebrew.plan(library, source, { 0: 'replace:missing' }), /Choose an existing/);
  assert.deepEqual(library, before);
});

test('copy remaps linked IDs and collections, while existing records stay intact', () => {
  const library = { equipment: [equipment().data], assets: [{ id: 'asset-1', name: 'Lab', rating: 1 }],
    teams: [{ id: 'team-1', name: 'Crew', snapshot: { assetIds: ['asset-1'] } }], collections: [{ id: 'c1', name: 'Pack', members: [] }] };
  const source = homebrew.pack(library);
  source.collections[0] = { id: 'c1', name: 'Pack', members: [{ type: 'assets', id: 'asset-1' }] };
  const merged = homebrew.plan(library, source, { 0: 'copy', 1: 'copy', 2: 'copy' });
  const team = merged.library.teams[1], asset = merged.library.assets[1];
  assert.deepEqual(team.snapshot.assetIds, [asset.id]);
  assert.notEqual(asset.id, 'asset-1');
  assert.deepEqual(merged.library.teams[0].snapshot.assetIds, ['asset-1']);
  assert.equal(merged.library.collections[1].name, 'Pack (import 1)');
  assert.equal(merged.library.collections[1].members[0].id, asset.id);
});

test('selection and collection exports include transitive dependencies', () => {
  const library = { adventures: [{ id: 'a', name: 'Arc', missionIds: ['m'] }], missions: [{ id: 'm', name: 'Mission', sceneIds: ['s'] }], scenes: [{ id: 's', name: 'Scene' }] };
  assert.equal(homebrew.pack(library, ['adventures:a']).items.length, 3);
  assert.equal(homebrew.pack(library, ['adventures:a'], { dependencies: false }).items.length, 1);
});

test('legacy migration extracts library without touching player/campaign state', () => {
  const legacy = { format: 'RoleCreditsStudioV2', state: { character: { name: 'Keep me' }, library: { equipment: [equipment().data], customTags: ['Glowing'] } }, campaignStore: { campaigns: [{ id: 'private' }] } };
  const parsed = homebrew.parse(JSON.stringify(legacy));
  assert.equal(parsed.items.length, 2);
  assert.match(parsed.warnings[0], /legacy/);
  assert.equal(parsed.state, undefined);
  const v1 = homebrew.parse({ format: homebrew.FORMAT, schemaVersion: 1, library: { scenes: [{ name: 'Old scene' }] } });
  assert.ok(v1.items[0].data.id);
  assert.match(v1.warnings[0], /schema 1/);
});

test('rejects malformed, future, unsafe, ambiguous and oversized data atomically', () => {
  for (const value of ['{bad json', '[]', JSON.stringify({ format: homebrew.FORMAT, schemaVersion: 999, items: [] }),
    JSON.stringify(document([{ type: 'unknown', data: {} }])), JSON.stringify(document([{ ...equipment(), data: { id: 'bad', name: 'Bad', rank: '1' } }])),
    JSON.stringify(document([equipment(), equipment()])), '{"format":"RoleCreditsHomebrew","schemaVersion":2,"items":[],"__proto__":{}}']) {
    assert.throws(() => homebrew.parse(value));
  }
  assert.throws(() => homebrew.parse(document([{ type: 'missions', data: { id: 'bad', name: 'Bad', sceneIds: 'oops' } }])), /list/);
  assert.throws(() => homebrew.parse(document([{ type: 'techniques', data: { id: 'bad', name: 'Bad', rank: 1, type: 'Bogus' } }])), /unknown Technique/);
  assert.throws(() => homebrew.parse(document([{ type: 'assets', data: { id: 'bad', name: 'Bad', rating: 1, classification: 'Bogus' } }])), /unknown Asset/);
  assert.throws(() => homebrew.parse(document([equipment("bad'id")])), /safe ID/);
  assert.throws(() => homebrew.parse(document([{ ...equipment(), data: { ...equipment().data, category: '<img onerror=alert(1)>' } }])), /without markup/);
  assert.throws(() => homebrew.parse(document([{ type: 'threats', data: { id: 'bad', name: 'Bad', rating: 99 } }])), /invalid rating/);
  assert.throws(() => homebrew.parse(document(Array.from({ length: 5001 }, (_, index) => equipment('item-' + index)))), /5,000/);
});

test('a later same-name incoming item becomes a conflict and backup restore remains a merge', () => {
  const source = document([equipment('a', 'Same name'), equipment('b', 'Same name')]);
  const pending = homebrew.plan({}, source);
  assert.deepEqual(pending.unresolved, ['Same name']);
  const merged = homebrew.plan({ customTags: ['Preserved'] }, source, { 1: 'copy' }, { restore: true });
  assert.equal(merged.library.equipment.length, 2);
  assert.deepEqual(merged.library.customTags, ['Preserved']);
  assert.ok(merged.warnings.some(warning => /Restore merges/.test(warning)));
});
