#!/usr/bin/env node
/**
 * 관리자 코드 → 앱에 넣을 해시 만들기 (코드 원문은 어디에도 저장하지 않음)
 *
 *   npm run admin:hash          # 코드를 화면에 안 보이게 입력
 *
 * 출력된 64자리 값을 GitHub → Settings → Secrets → Actions 에
 * DARO_ADMIN_CODE_HASH 로 저장. 계산 방식은 packages/app-core/src/admin/adminCode.ts 와 같음
 */
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline';

const SALT = 'daro-admin-v1:';
const MIN = 8;

function ask(q) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => {
      if (s.startsWith(q)) process.stdout.write(q);
    };
    rl.question(q, (a) => {
      rl.close();
      process.stdout.write('\n');
      resolve(a);
    });
  });
}

const code = (await ask('관리자 코드 (12자 이상 권장): ')).normalize('NFKC').trim();
if (code.length < MIN) {
  console.error(`코드는 ${MIN}자 이상이어야 해요.`);
  process.exit(1);
}
const again = (await ask('한 번 더 입력: ')).normalize('NFKC').trim();
if (again !== code) {
  console.error('두 번 입력한 코드가 달라요.');
  process.exit(1);
}
if (code.length < 12) console.warn('⚠ 12자 이상, 단어 여러 개를 섞으면 더 안전해요.');
console.log('\nDARO_ADMIN_CODE_HASH =');
console.log(createHash('sha256').update(SALT + code, 'utf8').digest('hex'));
