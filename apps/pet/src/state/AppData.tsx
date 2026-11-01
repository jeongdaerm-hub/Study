import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  cancelReminder,
  deletePhotos,
  initNotifications,
  loadList,
  loadValidList,
  newId,
  rollForward,
  saveList,
  storageKey,
} from '@daro/app-core';
import type { Collection, PetDb, Schedule, Vaccination } from '../types.ts';
import { isLab, isLog, isPet, isSchedule, isVaccine, isVisit, isWeight } from '../logic/validate.ts';
import { PET_CHANNEL, schedulePetReminder } from '../notifications.ts';
import { buildSample } from '../data/sample.ts';

/** 컬렉션별 저장 키 + 형식 검사기 */
const COLLECTIONS: { [K in Collection]: (x: unknown) => x is PetDb[K][number] } = {
  pets: isPet,
  visits: isVisit,
  labs: isLab,
  vaccines: isVaccine,
  weights: isWeight,
  logs: isLog,
  schedules: isSchedule,
};
const keyOf = (c: Collection) => storageKey('pet', c, 2);
const CURRENT_KEY = storageKey('pet', 'current', 2);

const EMPTY: PetDb = { pets: [], visits: [], labs: [], vaccines: [], weights: [], logs: [], schedules: [] };
type Item<C extends Collection> = PetDb[C][number];

interface AppData {
  ready: boolean;
  db: PetDb;
  currentPetId: string | null;
  setCurrentPetId: (id: string) => void;
  /** 마지막 저장 실패 여부 (저장 공간 부족 등) */
  saveError: boolean;
  upsert: <C extends Collection>(c: C, item: Item<C>) => Promise<void>;
  remove: <C extends Collection>(c: C, id: string) => Promise<void>;
  removePet: (id: string) => Promise<void>;
  saveSchedule: (s: Schedule) => Promise<void>;
  toggleScheduleDone: (id: string) => Promise<void>;
  saveVaccine: (v: Vaccination) => Promise<void>;
  loadSample: () => Promise<void>;
}

const Ctx = createContext<AppData | null>(null);

/** 사진을 가진 항목에서 사진 목록 추출 */
const photosOf = (x: unknown): string[] => {
  const o = x as { photos?: unknown; photo?: unknown };
  const list = Array.isArray(o.photos) ? (o.photos as string[]) : [];
  return typeof o.photo === 'string' ? [...list, o.photo] : list;
};

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [db, setDb] = useState<PetDb>(EMPTY);
  const [currentPetId, setCurrent] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);
  const ref = useRef(db);
  ref.current = db;

  const persist = useCallback(async <C extends Collection>(c: C, list: PetDb[C]) => {
    const next = { ...ref.current, [c]: list };
    ref.current = next;
    setDb(next);
    const ok = await saveList<unknown>(keyOf(c), list as unknown[]);
    setSaveError(!ok);
  }, []);

  // 최초 로드: 형식 검사 통과한 데이터만 사용 + 지난 반복 일정 다음 회차로
  useEffect(() => {
    (async () => {
      const entries = await Promise.all(
        (Object.keys(COLLECTIONS) as Collection[]).map(
          async (c) => [c, await loadValidList(keyOf(c), COLLECTIONS[c] as (x: unknown) => x is unknown)] as const,
        ),
      );
      const loaded = Object.fromEntries(entries) as unknown as PetDb;
      const granted = await initNotifications('반려동물 일정', PET_CHANNEL).catch(() => false);
      loaded.schedules = await Promise.all(
        loaded.schedules.map(async (item) => {
          const next = rollForward(item);
          if (next === item || !granted) return next;
          await cancelReminder(item.notificationId);
          return { ...next, notificationId: await schedulePetReminder(next, loaded.pets) };
        }),
      );
      ref.current = loaded;
      setDb(loaded);
      await saveList(keyOf('schedules'), loaded.schedules);
      const [saved] = await loadList<string>(CURRENT_KEY);
      setCurrent(loaded.pets.some((p) => p.id === saved) ? saved : (loaded.pets[0]?.id ?? null));
      setReady(true);
    })();
  }, []);

  const setCurrentPetId = useCallback((id: string) => {
    setCurrent(id);
    void saveList(CURRENT_KEY, [id]);
  }, []);

  const upsert = useCallback(
    async <C extends Collection>(c: C, item: Item<C>) => {
      const list = ref.current[c] as Item<C>[];
      const prev = list.find((x) => x.id === item.id);
      // 수정 시 빠진 사진 파일 정리
      if (prev) await deletePhotos(photosOf(prev).filter((p) => !photosOf(item).includes(p)));
      await persist(c, [item, ...list.filter((x) => x.id !== item.id)] as PetDb[C]);
    },
    [persist],
  );

  const remove = useCallback(
    async <C extends Collection>(c: C, id: string) => {
      const list = ref.current[c] as Item<C>[];
      const target = list.find((x) => x.id === id);
      if (!target) return;
      await deletePhotos(photosOf(target));
      if (c === 'schedules') await cancelReminder((target as Schedule).notificationId);
      if (c === 'vaccines' && (target as Vaccination).scheduleId) {
        const sid = (target as Vaccination).scheduleId!;
        const s = ref.current.schedules.find((x) => x.id === sid);
        await cancelReminder(s?.notificationId);
        await persist('schedules', ref.current.schedules.filter((x) => x.id !== sid));
      }
      await persist(c, list.filter((x) => x.id !== id) as PetDb[C]);
    },
    [persist],
  );

  /** 반려동물 삭제: 관련 기록·사진·알림 모두 정리 */
  const removePet = useCallback(
    async (petId: string) => {
      const cur = ref.current;
      for (const s of cur.schedules.filter((x) => x.petId === petId)) await cancelReminder(s.notificationId);
      const owned = (Object.keys(COLLECTIONS) as Collection[]).filter((c) => c !== 'pets');
      for (const c of owned) {
        const list = cur[c] as { petId: string }[];
        await deletePhotos(list.filter((x) => x.petId === petId).flatMap(photosOf));
        await persist(c, list.filter((x) => x.petId !== petId) as never);
      }
      await deletePhotos(photosOf(cur.pets.find((p) => p.id === petId) ?? {}));
      const pets = cur.pets.filter((p) => p.id !== petId);
      await persist('pets', pets);
      if (currentPetId === petId) setCurrentPetId(pets[0]?.id ?? '');
    },
    [persist, currentPetId, setCurrentPetId],
  );

  /** 일정 저장: 기존 알림 취소 → 재예약 */
  const saveSchedule = useCallback(
    async (s: Schedule) => {
      const prev = ref.current.schedules.find((x) => x.id === s.id);
      await cancelReminder(prev?.notificationId);
      const notificationId = await schedulePetReminder(s, ref.current.pets).catch(() => undefined);
      await persist('schedules', [{ ...s, notificationId }, ...ref.current.schedules.filter((x) => x.id !== s.id)]);
    },
    [persist],
  );

  const toggleScheduleDone = useCallback(
    async (id: string) => {
      const s = ref.current.schedules.find((x) => x.id === id);
      if (!s) return;
      // 반복 일정의 '완료' = 이번 회차 끝 → 다음 회차로 이동
      const next =
        s.repeat !== 'none' && !s.done
          ? rollForward(s, new Date(new Date(s.dateTime).getTime() + 1))
          : { ...s, done: !s.done };
      await saveSchedule(next);
    },
    [saveSchedule],
  );

  /** 접종 저장: 다음 접종일이 있으면 일정·알림 자동 등록 (하루 전 알림) */
  const saveVaccine = useCallback(
    async (v: Vaccination) => {
      let scheduleId = v.scheduleId;
      if (v.nextDate) {
        const [y, m, d] = v.nextDate.split('-').map(Number);
        scheduleId ??= newId();
        await saveSchedule({
          id: scheduleId,
          petId: v.petId,
          type: 'vaccine',
          title: `${v.name} 접종`,
          memo: v.hospital ? `병원: ${v.hospital}` : '',
          dateTime: new Date(y, m - 1, d, 10, 0).toISOString(),
          remindBefore: 1440,
          repeat: 'none',
          done: false,
        });
      } else if (scheduleId) {
        await remove('schedules', scheduleId);
        scheduleId = undefined;
      }
      await upsert('vaccines', { ...v, scheduleId });
    },
    [saveSchedule, remove, upsert],
  );

  const loadSample = useCallback(async () => {
    const sample = buildSample(new Date());
    // 일정·접종은 알림 예약 경로를 그대로 타도록 별도 저장
    for (const c of ['pets', 'visits', 'labs', 'weights', 'logs'] as const) {
      await persist(c, [...(sample[c] as never[]), ...(ref.current[c] as never[])] as never);
    }
    for (const s of sample.schedules) await saveSchedule(s);
    for (const v of sample.vaccines) await saveVaccine(v);
    setCurrentPetId(sample.pets[0].id);
  }, [persist, saveSchedule, saveVaccine, setCurrentPetId]);

  const value = useMemo<AppData>(
    () => ({
      ready,
      db,
      currentPetId,
      setCurrentPetId,
      saveError,
      upsert,
      remove,
      removePet,
      saveSchedule,
      toggleScheduleDone,
      saveVaccine,
      loadSample,
    }),
    [ready, db, currentPetId, setCurrentPetId, saveError, upsert, remove, removePet, saveSchedule, toggleScheduleDone, saveVaccine, loadSample],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppData(): AppData {
  const v = useContext(Ctx);
  if (!v) throw new Error('AppDataProvider 가 필요해요');
  return v;
}

/** 현재 선택된 반려동물 */
export function useCurrentPet() {
  const { db, currentPetId } = useAppData();
  return db.pets.find((p) => p.id === currentPetId) ?? null;
}
