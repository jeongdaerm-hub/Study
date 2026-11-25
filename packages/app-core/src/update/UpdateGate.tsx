import React, { useState } from 'react';
import { useAppUpdate } from './useAppUpdate.ts';
import { shouldShowBanner } from './policy.ts';
import { UpdateBanner } from './UpdateBanner.tsx';
import { ForceUpdateModal } from './ForceUpdateModal.tsx';
import { InstallingScreen } from './InstallingScreen.tsx';

/**
 * 앱 최상단에 한 번만 두면 되는 업데이트 컨트롤러.
 * - 업데이트가 없으면 아무것도 렌더링하지 않음
 * - OTA: 앱을 켤 때 있으면 '업데이트 중 N%' 후 바로 새 버전 실행
 *        사용 중에 생기면 조용히 받아 두고 다음 실행 때 적용 (원하면 [지금 적용])
 * - 스토어 새 버전: [업데이트] 버튼 배너, 필수 버전이면 차단 모달
 */
export interface UpdateGateProps {
  /** 필수 업데이트 모달 문구 */
  forceMessage?: string;
  /** 배너 제목 앞 아이콘 (예: 🐾) */
  icon?: string;
  /** 앱을 켤 때 업데이트가 있으면 '업데이트 중 N%' 후 바로 적용 (기본 true) */
  installOnLaunch?: boolean;
}

export function UpdateGate({ forceMessage, icon = '✨', installOnLaunch = true }: UpdateGateProps = {}) {
  const u = useAppUpdate({ installOnLaunch });
  const [dismissed, setDismissed] = useState<string | null>(null);

  // ⓪ 앱을 켤 때 새 업데이트: '업데이트 중 N%' → 자동으로 새 버전 실행
  if (u.installing) return <InstallingScreen icon={icon} />;

  if (u.storeLevel === 'force') {
    return <ForceUpdateModal visible message={forceMessage} notes={u.manifest?.releaseNotes} onUpdate={u.applyUpdate} />;
  }

  // ① 스토어 새 버전 (선택): 스토어로 이동
  if (u.storeLevel === 'optional') {
    const key = u.manifest!.latestVersion;
    if (!shouldShowBanner('optional', key, dismissed)) return null;
    return (
      <UpdateBanner
        status={u.status}
        title={`${icon} 새 버전 ${key} 이 출시됐어요`}
        notes={u.manifest?.releaseNotes}
        onUpdate={u.applyUpdate}
        onLater={() => setDismissed(key)}
      />
    );
  }

  // ② OTA: 이미 내려받아 둠 → 다음 실행 때 자동 적용. 원하면 지금 적용
  if (u.otaReady && dismissed !== 'ota') {
    return (
      <UpdateBanner
        status={u.status}
        title={`${icon} 새로운 기능이 준비됐어요`}
        hint="다음에 앱을 열면 자동으로 적용돼요."
        actionLabel="지금 적용"
        onUpdate={u.applyUpdate}
        onLater={() => setDismissed('ota')}
      />
    );
  }
  return null;
}
