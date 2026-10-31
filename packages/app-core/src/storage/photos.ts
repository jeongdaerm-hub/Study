import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { newId } from '../logic/date.ts';

const PHOTO_DIR = `${FileSystem.documentDirectory}photos/`;
export const MAX_PHOTOS = 5;

export interface PickPhotoMessages {
  cameraDenied?: string;
  libraryDenied?: string;
}

/**
 * 앨범 또는 카메라에서 사진 선택 → 앱 전용 폴더로 복사 (앱 공통)
 * (갤러리 원본이 지워져도 일기 사진은 유지)
 */
export async function pickPhotos(
  source: 'library' | 'camera',
  remain: number,
  msg: PickPhotoMessages = {},
): Promise<string[]> {
  if (remain <= 0) return [];
  const perm =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error(
      source === 'camera'
        ? (msg.cameraDenied ?? '카메라 권한이 필요해요.')
        : (msg.libraryDenied ?? '사진 접근 권한이 필요해요.'),
    );
  }

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.7, // 용량 절감
    allowsMultipleSelection: source === 'library',
    selectionLimit: remain,
  };
  const result =
    source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled) return [];

  await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true }).catch(() => {});
  const saved: string[] = [];
  for (const asset of result.assets.slice(0, remain)) {
    const ext = asset.uri.split('.').pop()?.split('?')[0] || 'jpg';
    const dest = `${PHOTO_DIR}${newId()}.${ext}`;
    await FileSystem.copyAsync({ from: asset.uri, to: dest });
    saved.push(dest);
  }
  return saved;
}

export async function deletePhotos(uris: string[]): Promise<void> {
  await Promise.all(uris.map((u) => FileSystem.deleteAsync(u, { idempotent: true }).catch(() => {})));
}
