import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 기기 내부 리스트 저장소 (앱 공통)
 * 키 충돌 방지를 위해 `${appSlug}:${name}:v${version}` 형식 사용 권장
 */
export function storageKey(appSlug: string, name: string, version = 1): string {
  return `${appSlug}:${name}:v${version}`;
}

export async function loadList<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    const data: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? (data as T[]) : [];
  } catch {
    return [];
  }
}

/**
 * 저장 실패(용량 초과, 브라우저 저장소 차단 등)가 앱을 멈추지 않도록 false 반환
 */
export async function saveList<T>(key: string, list: T[]): Promise<boolean> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/**
 * 저장된 데이터 검증 로드: 형식이 깨진 항목은 버림 (손상·변조 데이터로 인한 크래시 방지)
 */
export async function loadValidList<T>(key: string, isValid: (x: unknown) => x is T): Promise<T[]> {
  const raw = await loadList<unknown>(key);
  return raw.filter(isValid);
}
