#!/usr/bin/env node
/** CI: 모든 앱에 매니페스트가 있고 형식/버전 규칙이 맞는지 검사 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareVersions, isValidManifest } from '../packages/app-core/logic.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
for (const slug of readdirSync(join(root, 'apps'))) {
  const p = join(root, 'manifests', `${slug}.json`);
  if (!existsSync(p)) {
    errors.push(`${slug}: manifests/${slug}.json 없음`);
    continue;
  }
  let m;
  try {
    m = JSON.parse(readFileSync(p, 'utf8'));
  } catch (e) {
    errors.push(`${slug}: JSON 파싱 실패 (${e.message})`);
    continue;
  }
  if (!isValidManifest(m)) errors.push(`${slug}: 필수 필드 누락 (latestVersion, minSupportedVersion, storeUrl)`);
  else if (compareVersions(m.minSupportedVersion, m.latestVersion) > 0) errors.push(`${slug}: min > latest`);
}
if (errors.length) {
  console.error(errors.map((e) => `✖ ${e}`).join('\n'));
  process.exit(1);
}
console.log('✔ manifests OK');
