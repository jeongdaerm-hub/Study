import type { Pet } from '../types.ts';

// TODO: 펫 등록 화면이 생기면 저장소에서 읽도록 교체
export const PETS: Pet[] = [
  { id: 'p1', name: '초코', species: '강아지' },
  { id: 'p2', name: '나비', species: '고양이' },
];

export const petEmoji = (p: Pet) => (p.species === '강아지' ? '🐶' : '🐱');
