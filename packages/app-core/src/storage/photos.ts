import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { newId } from '../logic/date.ts';

export const MAX_PHOTOS = 5;
const MAX_EDGE = 1280; // 긴 변 최대 픽셀 (용량 절감)

export interface PickPhotoMessages {
  cameraDenied?: string;
  libraryDenied?: string;
}

const isWeb = Platform.OS === 'web';
const photoDir = () => new Directory(Paths.document, 'photos');

/**
 * 앨범 또는 카메라에서 사진 선택 (앱 공통)
 *  - 재인코딩으로 EXIF(촬영 위치 GPS 등) 메타데이터 제거 → 개인정보 보호
 *  - 긴 변 1280px 로 축소 → 저장 공간 절감
 *  - 앱: 앱 전용 폴더에 저장 (갤러리 원본이 지워져도 유지)
 *  - 웹 미리보기: data URI 로 보관
 */
export async function pickPhotos(
  source: 'library' | 'camera',
  remain: number,
  msg: PickPhotoMessages = {},
): Promise<string[]> {
  if (remain <= 0) return [];
  if (!isWeb) {
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
  }

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 1,
    exif: false,
    allowsMultipleSelection: source === 'library',
    selectionLimit: remain,
  };
  const result =
    source === 'camera' && !isWeb
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled) return [];

  let dir: Directory | null = null;
  if (!isWeb) {
    dir = photoDir();
    if (!dir.exists) dir.create({ intermediates: true });
  }
  const saved: string[] = [];
  for (const asset of result.assets.slice(0, remain)) {
    const landscape = (asset.width ?? 0) >= (asset.height ?? 0);
    const resize = landscape
      ? { width: Math.min(asset.width || MAX_EDGE, MAX_EDGE) }
      : { height: Math.min(asset.height || MAX_EDGE, MAX_EDGE) };
    // 재인코딩 = 메타데이터 제거 + 축소
    const ref = await ImageManipulator.manipulate(asset.uri).resize(resize).renderAsync();
    const out = await ref.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: isWeb });
    if (isWeb) {
      saved.push(`data:image/jpeg;base64,${out.base64}`);
    } else if (dir) {
      const dest = new File(dir, `${newId()}.jpg`);
      await new File(out.uri).move(dest);
      saved.push(dest.uri);
    }
  }
  return saved;
}

/** 앱 전용 사진 폴더 안의 파일만 삭제 (경로 조작 방지) */
export async function deletePhotos(uris: string[]): Promise<void> {
  if (isWeb || !uris.length) return;
  const base = photoDir().uri;
  for (const u of uris) {
    if (!u.startsWith(base) || u.includes('..')) continue;
    try {
      const f = new File(u);
      if (f.exists) f.delete();
    } catch {
      // 이미 없는 파일 등은 무시
    }
  }
}
