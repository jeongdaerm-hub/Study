#!/usr/bin/env node
/**
 * 새 앱 생성: 표준 구조(인앱 업데이트·배포·테스트)를 그대로 복제
 *
 *   npm run new-app -- <slug> "<앱 이름>" [--color #3D7EFF] [--bundle com.daro.<slug>]
 *
 * 하는 일
 *  1) manifests/<slug>.json 생성 (스토어 업데이트 체크용)
 *  2) templates/expo-app → apps/<slug> (플레이스홀더 치환, 새 파일로만 생성)
 *  3) 의존성 = @daro/app-core 표준 SDK 버전으로 고정 (모든 앱 동일)
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};

const color = flag('color', '#3D7EFF');
let bundle = flag('bundle', '');
const [slug, name] = args;

function fail(msg) {
  console.error(`✖ ${msg}`);
  console.error('  사용법: npm run new-app -- <slug> "<앱 이름>" [--color #3D7EFF] [--bundle com.daro.<slug>]');
  process.exit(1);
}

if (!slug || !/^[a-z][a-z0-9-]{1,30}$/.test(slug)) fail('slug 는 영문 소문자로 시작하는 2~31자 (a-z, 0-9, -)');
if (!name) fail('앱 이름이 필요해요');
if (!/^#[0-9a-fA-F]{6}$/.test(color)) fail('--color 는 #RRGGBB 형식');
bundle ||= `com.daro.${slug.replace(/-/g, '')}`;
if (!/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/.test(bundle)) fail('--bundle 은 com.회사.앱 형식 (소문자/숫자)');

const dest = join(root, 'apps', slug);
const manifestPath = join(root, 'manifests', `${slug}.json`);

/** 새 파일만 만들기 ('wx': 이미 있으면 실패) — 확인과 생성을 한 번에 처리해 경쟁 상태 방지 */
function createFile(path, content, what) {
  try {
    writeFileSync(path, content, { flag: 'wx' });
  } catch (e) {
    if (e.code === 'EEXIST') fail(`${what} 이(가) 이미 있어요`);
    throw e;
  }
}

// 0) 매니페스트 이름 먼저 확보 (이미 있으면 여기서 중단, 앱 폴더는 아직 안 만듦)
const manifest = {
  latestVersion: '1.0.0',
  minSupportedVersion: '1.0.0',
  releaseNotes: [],
  storeUrl: {
    android: `market://details?id=${bundle}`,
    ios: 'itms-apps://apps.apple.com/app/id0000000000',
  },
};
createFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', `manifests/${slug}.json`);

// 1) 앱 폴더 생성 (재귀 아님: 이미 있으면 EEXIST 로 실패)
try {
  mkdirSync(dest);
} catch (e) {
  rmSync(manifestPath, { force: true });
  if (e.code === 'EEXIST') fail(`apps/${slug} 가 이미 있어요`);
  throw e;
}

// 2) 템플릿을 메모리에서 치환해 새 파일로 기록 (복사 후 덮어쓰기 하지 않음)
const vars = {
  __APP_NAME__: name,
  __SLUG_ENV__: slug.toUpperCase().replace(/-/g, '_'),
  __SLUG__: slug,
  __BUNDLE_ID__: bundle,
  __BRAND_COLOR__: color,
};
const corePkg = JSON.parse(readFileSync(join(root, 'packages/app-core/package.json'), 'utf8'));
const template = join(root, 'templates', 'expo-app');

(function walk(rel) {
  for (const entry of readdirSync(join(template, rel), { withFileTypes: true })) {
    const relPath = join(rel, entry.name);
    if (entry.isDirectory()) {
      mkdirSync(join(dest, relPath));
      walk(relPath);
      continue;
    }
    if (!entry.isFile()) continue; // 심볼릭 링크 등은 복사하지 않음
    let s = readFileSync(join(template, relPath), 'utf8');
    for (const [k, v] of Object.entries(vars)) s = s.split(k).join(v);
    if (relPath === 'package.json') {
      // 표준 SDK 의존성 주입 (모든 앱 동일 버전)
      const pkg = JSON.parse(s);
      pkg.dependencies = Object.fromEntries(
        Object.entries({ '@daro/app-config': '*', '@daro/app-core': '*', ...corePkg.peerDependencies }).sort(),
      );
      s = JSON.stringify(pkg, null, 2) + '\n';
    }
    createFile(join(dest, relPath), s, `apps/${slug}/${relPath}`);
  }
})('');

console.log(`✔ apps/${slug} 생성 완료 (${name}, ${bundle})
✔ manifests/${slug}.json 생성 완료

다음 단계
  1. npm install                      # 워크스페이스 연결
  2. cd apps/${slug} && npx eas init  # EAS 프로젝트 ID 발급 → app.config.js easProjectId
  3. npm run start -w @daro/${slug}   # 개발 서버
  4. 스토어 등록 후 manifests/${slug}.json 의 storeUrl.ios 앱 ID 교체`);
