#!/usr/bin/env node
/**
 * 새 앱 생성: 표준 구조(인앱 업데이트·배포·테스트)를 그대로 복제
 *
 *   npm run new-app -- <slug> "<앱 이름>" [--color #3D7EFF] [--bundle com.daro.<slug>]
 *
 * 하는 일
 *  1) templates/expo-app → apps/<slug> 복사 (플레이스홀더 치환)
 *  2) 의존성 = @daro/app-core 표준 SDK 버전으로 고정 (모든 앱 동일)
 *  3) manifests/<slug>.json 생성 (스토어 업데이트 체크용)
 */
import { cpSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
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
if (existsSync(dest)) fail(`apps/${slug} 가 이미 있어요`);
const manifestPath = join(root, 'manifests', `${slug}.json`);
if (existsSync(manifestPath)) fail(`manifests/${slug}.json 이 이미 있어요`);

// 1) 템플릿 복사 + 치환
cpSync(join(root, 'templates', 'expo-app'), dest, { recursive: true });
const vars = {
  __APP_NAME__: name,
  __SLUG_ENV__: slug.toUpperCase().replace(/-/g, '_'),
  __SLUG__: slug,
  __BUNDLE_ID__: bundle,
  __BRAND_COLOR__: color,
};
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else {
      let s = readFileSync(p, 'utf8');
      for (const [k, v] of Object.entries(vars)) s = s.split(k).join(v);
      writeFileSync(p, s);
    }
  }
})(dest);

// 2) 표준 SDK 의존성 주입
const corePkg = JSON.parse(readFileSync(join(root, 'packages/app-core/package.json'), 'utf8'));
const appPkgPath = join(dest, 'package.json');
const appPkg = JSON.parse(readFileSync(appPkgPath, 'utf8'));
appPkg.dependencies = Object.fromEntries(
  Object.entries({ '@daro/app-config': '*', '@daro/app-core': '*', ...corePkg.peerDependencies }).sort(),
);
writeFileSync(appPkgPath, JSON.stringify(appPkg, null, 2) + '\n');

// 3) 버전 매니페스트
const manifest = {
  latestVersion: '1.0.0',
  minSupportedVersion: '1.0.0',
  releaseNotes: [],
  storeUrl: {
    android: `market://details?id=${bundle}`,
    ios: 'itms-apps://apps.apple.com/app/id0000000000',
  },
};
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(`✔ apps/${slug} 생성 완료 (${name}, ${bundle})
✔ manifests/${slug}.json 생성 완료

다음 단계
  1. npm install                      # 워크스페이스 연결
  2. cd apps/${slug} && npx eas init  # EAS 프로젝트 ID 발급 → app.config.js easProjectId
  3. npm run start -w @daro/${slug}   # 개발 서버
  4. 스토어 등록 후 manifests/${slug}.json 의 storeUrl.ios 앱 ID 교체`);
