import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'daro:install-id';
let cached: string | null = null;

/**
 * 앱 설치별 임의 ID — 서버 요청 제한용 (개인정보 아님, 비밀값 아님)
 * 앱을 지우면 새로 만들어짐
 */
export async function getInstallId(): Promise<string> {
  if (cached) return cached;
  try {
    const saved = await AsyncStorage.getItem(KEY);
    if (saved && /^[A-Za-z0-9_-]{8,64}$/.test(saved)) return (cached = saved);
  } catch {
    // 저장소 접근 불가 → 이번 실행 동안만 쓰는 ID
  }
  const bytes = new Uint8Array(16);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  cached = 'i_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  try {
    await AsyncStorage.setItem(KEY, cached);
  } catch {
    // 무시
  }
  return cached;
}
