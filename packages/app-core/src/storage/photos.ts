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
  const result = await launch(source, remain, msg);
  if (!result) return [];

  const out = await Promise.all(
    result.assets.slice(0, remain).map((a) => processAsset(a, { maxEdge: MAX_EDGE, compress: 0.7, base64: false })),
  );
  return out.map((o) => o.uri);
}

export interface PickedImage {
  /** 앱 사진 폴더(또는 웹 data URI) — 기록에 첨부 가능 */
  uri: string;
  /** 업로드용 base64 (data: 접두사 없음) */
  base64: string;
  mediaType: 'image/jpeg';
}

/**
 * 문서 인식(업로드)용 사진 선택: 글자가 읽히도록 조금 더 크게(1600px), 위치정보 제거
 */
export async function pickImagesForUpload(
  source: 'library' | 'camera',
  remain: number,
  msg: PickPhotoMessages = {},
): Promise<PickedImage[]> {
  if (remain <= 0) return [];
  const result = await launch(source, remain, msg);
  if (!result) return [];
  return Promise.all(
    result.assets.slice(0, remain).map(async (a) => {
      const o = await processAsset(a, { maxEdge: 1600, compress: 0.8, base64: true });
      return { uri: o.uri, base64: o.base64 ?? '', mediaType: 'image/jpeg' as const };
    }),
  );
}

/** 재인코딩 = 메타데이터(EXIF·GPS) 제거 + 축소, 앱 사진 폴더에 저장 */
async function processAsset(
  asset: ImagePicker.ImagePickerAsset,
  o: { maxEdge: number; compress: number; base64: boolean },
): Promise<{ uri: string; base64?: string }> {
  const landscape = (asset.width ?? 0) >= (asset.height ?? 0);
  const resize = landscape
    ? { width: Math.min(asset.width || o.maxEdge, o.maxEdge) }
    : { height: Math.min(asset.height || o.maxEdge, o.maxEdge) };
  const ref = await ImageManipulator.manipulate(asset.uri).resize(resize).renderAsync();
  const out = await ref.saveAsync({ compress: o.compress, format: SaveFormat.JPEG, base64: isWeb || o.base64 });
  if (isWeb) return { uri: `data:image/jpeg;base64,${out.base64}`, base64: out.base64 };
  const dir = photoDir();
  if (!dir.exists) dir.create({ intermediates: true });
  const dest = new File(dir, `${newId()}.jpg`);
  await new File(out.uri).move(dest);
  return { uri: dest.uri, base64: out.base64 };
}

async function launch(
  source: 'library' | 'camera',
  remain: number,
  msg: PickPhotoMessages,
): Promise<ImagePicker.ImagePickerSuccessResult | null> {
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
  return result.canceled ? null : result;
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
