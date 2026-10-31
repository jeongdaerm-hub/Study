import React, { createContext, useContext } from 'react';

/** 앱별 브랜드 색만 바꾸면 공통 컴포넌트 전체에 반영 */
export interface Theme {
  primary: string;
  primarySoft: string;
  primaryText: string;
  text: string;
  sub: string;
  line: string;
  bg: string;
  danger: string;
  ok: string;
  warn: string;
}

export const defaultTheme: Theme = {
  primary: '#FF8A00',
  primarySoft: '#FFF4E5',
  primaryText: '#7A4100',
  text: '#222222',
  sub: '#666666',
  line: '#E6E6EA',
  bg: '#F7F7F9',
  danger: '#C62828',
  ok: '#2E7D32',
  warn: '#B26A00',
};

const ThemeCtx = createContext<Theme>(defaultTheme);

export function ThemeProvider({ theme, children }: { theme?: Partial<Theme>; children: React.ReactNode }) {
  return <ThemeCtx.Provider value={{ ...defaultTheme, ...theme }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
