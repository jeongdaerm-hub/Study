import AsyncStorage from '@react-native-async-storage/async-storage';

/** 기기 내부 저장소 (스키마 변경 시 키 버전 올리기) */
export const KEYS = {
  diary: 'daro:diary:v1',
  schedule: 'daro:schedule:v1',
} as const;

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
