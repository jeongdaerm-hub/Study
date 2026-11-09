#!/usr/bin/env node
/**
 * 스토어 출시 후 버전 매니페스트 갱신 → 기존 사용자 앱에 [업데이트] 버튼 노출
 *
 *   npm run release:manifest -- <slug> <latestVersion> [--min <minSupportedVersion>] [--note "변경 내용"]...
 *
 * ⚠ 스토어 심사 통과·배포 완료 '후'에 실행 (먼저 하면 스토어에 없는 버전으로 안내됨)
 */
import { closeSync, existsSync, ftruncateSync, openSync, readFileSync, writeSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareVersions, isValidManifest } from '../packages/app-core/logic.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const notes = [];
let min;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--note') notes.push(args.splice(i--, 2)[1]);
  else if (args[i] === '--min') min = args.splice(i--, 2)[1];
}
const [slug, latest] = args;
const SEMVER = /^\d+\.\d+\.\d+$/;

function fail(msg) {
  console.error(`✖ ${msg}`);
  process.exit(1);
}
if (!slug || !latest) fail('사용법: npm run release:manifest -- <slug> <version> [--min <version>] [--note "..."]');
if (!SEMVER.test(latest) || (min && !SEMVER.test(min))) fail('버전은 1.2.3 형식');

const path = join(root, 'manifests', `${slug}.json`);
// 파일을 한 번만 열고 같은 핸들로 읽고 써서 확인~쓰기 사이 경쟁 상태 방지
let fd;
try {
  fd = openSync(path, 'r+');
} catch {
  fail(`manifests/${slug}.json 이 없어요`);
}
const m = JSON.parse(readFileSync(fd, 'utf8'));
if (!isValidManifest(m)) fail('기존 매니페스트 형식이 잘못됐어요');

if (compareVersions(latest, m.latestVersion) < 0) fail(`latestVersion 을 낮출 수 없어요 (${m.latestVersion} → ${latest})`);
const nextMin = min ?? m.minSupportedVersion;
if (compareVersions(nextMin, latest) > 0) fail(`minSupportedVersion(${nextMin}) 이 latestVersion(${latest}) 보다 높아요`);

// 앱 코드 버전과 일치 확인 (불일치면 경고만)
const appConfigPath = join(root, 'apps', slug, 'app.config.js');
if (existsSync(appConfigPath)) {
  const cfg = createRequire(appConfigPath)(appConfigPath);
  if (cfg.version !== latest) console.warn(`⚠ apps/${slug}/app.config.js version(${cfg.version}) 과 다릅니다`);
}

const next = { ...m, latestVersion: latest, minSupportedVersion: nextMin, releaseNotes: notes.length ? notes : m.releaseNotes };
const out = Buffer.from(JSON.stringify(next, null, 2) + '\n');
ftruncateSync(fd, 0);
writeSync(fd, out, 0, out.length, 0);
closeSync(fd);
console.log(`✔ ${slug}: latest ${m.latestVersion} → ${latest}, min ${m.minSupportedVersion} → ${nextMin}`);
if (compareVersions(nextMin, m.minSupportedVersion) > 0) console.log('  ⚠ 필수 업데이트: 구버전 사용자는 업데이트 전까지 앱 사용이 차단됩니다');
console.log('  → 커밋 후 main 에 머지되면 사용자 앱에 반영됩니다');
