import React, { useState } from 'react';
import { useAppUpdate } from './useAppUpdate.ts';
import { shouldShowBanner } from './policy.ts';
import { UpdateBanner } from './UpdateBanner.tsx';
import { ForceUpdateModal } from './ForceUpdateModal.tsx';

/**
 * 앱 최상단에 한 번만 두면 되는 업데이트 컨트롤러.
 * - 업데이트가 없으면 아무것도 렌더링하지 않음
 * - 있으면 [업데이트] 버튼 배너, 필수면 차단 모달
 */
export function UpdateGate() {
  const u = useAppUpdate();
  const [dismissed, setDismissed] = useState<string | null>(null);

  if (u.storeLevel === 'force') {
    return <ForceUpdateModal visible notes={u.manifest?.releaseNotes} onUpdate={u.applyUpdate} />;
  }

  // 스토어 업데이트(optional) 또는 OTA 업데이트가 있는 경우
  const key = u.storeLevel === 'optional' ? u.manifest!.latestVersion : 'ota';
  const level = u.storeLevel === 'optional' || u.otaAvailable ? 'optional' : 'none';
  const busy = u.status === 'downloading' || u.status === 'ready';
  if (!busy && u.status !== 'error' && !shouldShowBanner(level, key, dismissed)) return null;
  if (level === 'none') return null;

  const title =
    u.storeLevel === 'optional'
      ? `새 버전 ${u.manifest!.latestVersion} 이 출시됐어요`
      : '새로운 기능이 준비됐어요';

  return (
    <UpdateBanner
      status={u.status}
      title={title}
      notes={u.storeLevel === 'optional' ? u.manifest?.releaseNotes : undefined}
      onUpdate={u.applyUpdate}
      onLater={() => setDismissed(key)}
    />
  );
}
