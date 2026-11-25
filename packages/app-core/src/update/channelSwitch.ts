import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Updates from 'expo-updates';
import * as Application from 'expo-application';
import { isPreviewAppId } from './buildInfo.ts';

/**
 * 앱을 다시 설치하지 않고 '업데이트 채널'만 바꿔서 다른 버전을 받아보기
 *  - production(공식): 모든 사용자가 받는 버전
 *  - preview(배포 전): 내 폰에서 먼저 확인하는 버전
 * expo-updates 의 setUpdateRequestHeadersOverride 사용 → 빌드 때 선언한
 * 'expo-channel-name' 헤더 값만 바꿈 (주소 변경 불가 → 안전장치 유지)
 */
export type Channel = 'production' | 'preview';
const KEY = 'daro:channel-override';
const HEADER = 'expo-channel-name';

/** 설치된 앱의 기본 채널 */
export function buildChannel(): Channel {
  return Platform.OS !== 'web' && isPreviewAppId(Application.applicationId) ? 'preview' : 'production';
}

export function canSwitchChannel(): boolean {
  return Platform.OS !== 'web' && !__DEV__ && Updates.isEnabled;
}

/** 지금 받고 있는 채널 (기본 채널을 바꿨다면 바꾼 채널) */
export async function currentChannel(): Promise<Channel> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v === 'production' || v === 'preview') return v;
  } catch {
    // 저장소 접근 불가 → 기본 채널
  }
  return buildChannel();
}

function applyOverride(target: Channel) {
  // 기본 채널로 돌아갈 때는 덮어쓰기를 지움 (빌드 때 설정으로 복귀)
  Updates.setUpdateRequestHeadersOverride(target === buildChannel() ? null : { [HEADER]: target });
}

async function remember(target: Channel) {
  try {
    if (target === buildChannel()) await AsyncStorage.removeItem(KEY);
    else await AsyncStorage.setItem(KEY, target);
  } catch {
    // 무시: 네이티브 쪽 설정은 이미 저장됨
  }
}

export type SwitchResult =
  | { ok: true; reloading: boolean; message: string }
  | { ok: false; message: string };

const NAME: Record<Channel, string> = { production: '공식 버전', preview: '배포 전(테스트) 버전' };

/**
 * 채널을 바꾸고 그 채널의 최신 업데이트를 받아 바로 다시 시작
 * 받을 업데이트가 없으면 원래 채널로 되돌림
 */
export async function switchChannel(target: Channel): Promise<SwitchResult> {
  if (!canSwitchChannel()) return { ok: false, message: '웹 미리보기·개발 모드에서는 쓸 수 없어요. 폰에 설치한 앱에서 해주세요.' };
  const before = await currentChannel();
  try {
    applyOverride(target);
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) {
      if (target === before) return { ok: true, reloading: false, message: `이미 최신 ${NAME[target]}이에요.` };
      applyOverride(before); // 받을 게 없으면 원래대로
      return {
        ok: false,
        message:
          target === 'preview'
            ? '아직 확인할 배포 전 버전이 없어요. 새 버전을 올린 뒤 다시 눌러 주세요.'
            : '공식 버전 업데이트가 아직 없어요. 첫 공식 배포 뒤에 다시 눌러 주세요.',
      };
    }
    const fetched = await Updates.fetchUpdateAsync();
    await remember(target);
    if (!fetched.isNew && !fetched.isRollBackToEmbedded) {
      return { ok: true, reloading: false, message: `${NAME[target]}을 받았어요. 앱을 다시 열면 적용돼요.` };
    }
    await Updates.reloadAsync();
    return { ok: true, reloading: true, message: `${NAME[target]}으로 다시 시작해요.` };
  } catch (e) {
    try {
      applyOverride(before);
    } catch {
      // 무시
    }
    return { ok: false, message: `전환하지 못했어요. 인터넷 연결을 확인해 주세요. (${e instanceof Error ? e.message : String(e)})` };
  }
}

export const channelName = (c: Channel) => NAME[c];
