import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { DiaryEntry, Schedule } from '../types.ts';
import { cancelReminder, deletePhotos, initNotifications, loadList, rollForward, saveList, storageKey } from '@daro/app-core';
import { PET_CHANNEL, schedulePetReminder } from '../notifications.ts';

const KEYS = {
  diary: storageKey('pet', 'diary'),
  schedule: storageKey('pet', 'schedule'),
};

interface AppData {
  ready: boolean;
  diaries: DiaryEntry[];
  schedules: Schedule[];
  saveDiary: (e: DiaryEntry) => Promise<void>;
  removeDiary: (id: string) => Promise<void>;
  saveSchedule: (s: Schedule) => Promise<void>;
  toggleScheduleDone: (id: string) => Promise<void>;
  removeSchedule: (id: string) => Promise<void>;
}

const Ctx = createContext<AppData | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [diaries, setDiaries] = useState<DiaryEntry[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const scheduleRef = useRef(schedules);
  scheduleRef.current = schedules;

  // 최초 로드 + 지난 반복 일정 다음 회차로 이동 & 알림 재예약
  useEffect(() => {
    (async () => {
      const [d, s] = await Promise.all([loadList<DiaryEntry>(KEYS.diary), loadList<Schedule>(KEYS.schedule)]);
      setDiaries(d);
      const granted = await initNotifications('반려동물 일정', PET_CHANNEL).catch(() => false);
      const rolled = await Promise.all(
        s.map(async (item) => {
          const next = rollForward(item);
          if (next === item || !granted) return next;
          await cancelReminder(item.notificationId);
          return { ...next, notificationId: await schedulePetReminder(next) };
        }),
      );
      setSchedules(rolled);
      await saveList(KEYS.schedule, rolled);
      setReady(true);
    })();
  }, []);

  const persistDiaries = useCallback(async (next: DiaryEntry[]) => {
    setDiaries(next);
    await saveList(KEYS.diary, next);
  }, []);

  const persistSchedules = useCallback(async (next: Schedule[]) => {
    setSchedules(next);
    await saveList(KEYS.schedule, next);
  }, []);

  const saveDiary = useCallback(
    async (e: DiaryEntry) => {
      const prev = diaries.find((x) => x.id === e.id);
      if (prev) await deletePhotos(prev.photos.filter((p) => !e.photos.includes(p)));
      await persistDiaries([e, ...diaries.filter((x) => x.id !== e.id)]);
    },
    [diaries, persistDiaries],
  );

  const removeDiary = useCallback(
    async (id: string) => {
      const target = diaries.find((x) => x.id === id);
      if (target) await deletePhotos(target.photos);
      await persistDiaries(diaries.filter((x) => x.id !== id));
    },
    [diaries, persistDiaries],
  );

  /** 저장 시 기존 알림 취소 → 새로 예약 (수정·완료 해제 모두 같은 경로) */
  const upsertWithReminder = useCallback(
    async (s: Schedule) => {
      const prev = scheduleRef.current.find((x) => x.id === s.id);
      await cancelReminder(prev?.notificationId);
      const notificationId = await schedulePetReminder(s).catch(() => undefined);
      const saved = { ...s, notificationId };
      await persistSchedules([saved, ...scheduleRef.current.filter((x) => x.id !== s.id)]);
    },
    [persistSchedules],
  );

  const toggleScheduleDone = useCallback(
    async (id: string) => {
      const s = scheduleRef.current.find((x) => x.id === id);
      if (!s) return;
      // 반복 일정은 '완료' = 이번 회차 끝 → 다음 회차로 이동
      const next = s.repeat !== 'none' && !s.done ? rollForward(s, new Date(new Date(s.dateTime).getTime() + 1)) : { ...s, done: !s.done };
      await upsertWithReminder(next);
    },
    [upsertWithReminder],
  );

  const removeSchedule = useCallback(
    async (id: string) => {
      const s = scheduleRef.current.find((x) => x.id === id);
      await cancelReminder(s?.notificationId);
      await persistSchedules(scheduleRef.current.filter((x) => x.id !== id));
    },
    [persistSchedules],
  );

  const value = useMemo<AppData>(
    () => ({
      ready,
      diaries,
      schedules,
      saveDiary,
      removeDiary,
      saveSchedule: upsertWithReminder,
      toggleScheduleDone,
      removeSchedule,
    }),
    [ready, diaries, schedules, saveDiary, removeDiary, upsertWithReminder, toggleScheduleDone, removeSchedule],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppData(): AppData {
  const v = useContext(Ctx);
  if (!v) throw new Error('AppDataProvider 가 필요해요');
  return v;
}
