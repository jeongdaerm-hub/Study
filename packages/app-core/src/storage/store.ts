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

export async function saveList<T>(key: string, list: T[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(list));
}
