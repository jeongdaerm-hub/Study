#!/usr/bin/env node
/**
 * 저장소 보안 점검 (로컬·CI 공통, 외부 도구 없이 실행)
 *  1) 비밀키·토큰 유출 패턴
 *  2) 위험 코드 패턴 (eval, innerHTML 등)
 *  3) 평문 HTTP 주소
 *  4) 앱 코드의 console.log (데이터 유출 방지)
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const files = execSync('git ls-files -co --exclude-standard', { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && !/(^|\/)(node_modules|dist)\//.test(f) && !/package-lock\.json$|\.(png|jpe?g|gif|ico|webp)$/.test(f));

const RULES = [
  { id: 'secret/aws', re: /AKIA[0-9A-Z]{16}/ },
  { id: 'secret/google', re: /AIza[0-9A-Za-z_-]{35}/ },
  { id: 'secret/github', re: /(ghp_[0-9A-Za-z]{36}|github_pat_[0-9A-Za-z_]{40,})/ },
  { id: 'secret/slack', re: /xox[baprs]-[0-9A-Za-z-]{10,}/ },
  { id: 'secret/openai-like', re: /\bsk-[A-Za-z0-9]{32,}/ },
  { id: 'secret/private-key', re: /-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
  { id: 'secret/hardcoded', re: /(password|passwd|secret|api[_-]?key|token)\s*[:=]\s*['"][^'"\s]{8,}['"]/i },
  { id: 'code/eval', re: /\beval\s*\(|new Function\s*\(/, code: true },
  { id: 'code/html-injection', re: /dangerouslySetInnerHTML|\.innerHTML\s*=|document\.write\(/, code: true },
  { id: 'net/plain-http', re: /['"`]http:\/\/(?!localhost|127\.0\.0\.1)[^'"`\s]+/, code: true, skipTests: true },
  { id: 'log/console', re: /console\.(log|info|debug)\(/, code: true, appOnly: true },
];

const CODE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const findings = [];
for (const f of files) {
  if (f === 'scripts/security-scan.mjs') continue;
  let text;
  try {
    text = readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  const lines = text.split('\n');
  for (const r of RULES) {
    if (r.code && !CODE.test(f)) continue;
    if (r.skipTests && /(^|\/)tests?\//.test(f)) continue;
    if (r.appOnly && !/^(apps\/[^/]+\/src|packages\/app-core\/src)\//.test(f)) continue;
    lines.forEach((line, i) => {
      if (r.re.test(line)) findings.push(`${r.id.padEnd(22)} ${f}:${i + 1}  ${line.trim().slice(0, 100)}`);
    });
  }
}

console.log(`검사 파일 ${files.length}개`);
if (findings.length) {
  console.error(`✖ 보안 점검 실패 ${findings.length}건\n` + findings.join('\n'));
  process.exit(1);
}
console.log('✔ 비밀키 유출·위험 코드·평문 HTTP·로그 출력 없음');
