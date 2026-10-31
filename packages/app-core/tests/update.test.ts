import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions } from '../src/update/version.ts';
import { decideStoreUpdate, isValidManifest, shouldShowBanner } from '../src/update/policy.ts';

const manifest = {
  latestVersion: '1.2.0',
  minSupportedVersion: '1.0.0',
  storeUrl: { android: 'market://details?id=com.daro.pet' },
};

test('compareVersions', () => {
  assert.equal(compareVersions('1.2.10', '1.2.9'), 1);
  assert.equal(compareVersions('1.0', '1.0.0'), 0);
  assert.equal(compareVersions('v2.0.0', '1.9.9'), 1);
  assert.equal(compareVersions('1.0.0-beta', '1.0.1'), -1);
});

test('decideStoreUpdate', () => {
  assert.equal(decideStoreUpdate('0.9.0', manifest), 'force');
  assert.equal(decideStoreUpdate('1.0.0', manifest), 'optional');
  assert.equal(decideStoreUpdate('1.2.0', manifest), 'none');
  assert.equal(decideStoreUpdate('1.3.0', manifest), 'none');
});

test('isValidManifest', () => {
  assert.equal(isValidManifest(manifest), true);
  assert.equal(isValidManifest({ latestVersion: '1.0.0' }), false);
  assert.equal(isValidManifest(null), false);
});

test('shouldShowBanner', () => {
  assert.equal(shouldShowBanner('optional', '1.2.0', null), true);
  assert.equal(shouldShowBanner('optional', '1.2.0', '1.2.0'), false);
  assert.equal(shouldShowBanner('optional', '1.3.0', '1.2.0'), true);
  assert.equal(shouldShowBanner('force', '1.2.0', '1.2.0'), true);
  assert.equal(shouldShowBanner('none', '1.2.0', null), false);
});
