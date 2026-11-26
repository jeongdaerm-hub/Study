import React, { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { DialogProvider, FamilySyncProvider, TestBuildRibbon, ThemeProvider, UpdateGate } from '@daro/app-core';
import { AppDataProvider, useAppData } from './src/state/AppData.tsx';
import { HomeScreen } from './src/screens/HomeScreen.tsx';
import { HealthScreen } from './src/screens/HealthScreen.tsx';
import { WeightScreen } from './src/screens/WeightScreen.tsx';
import { LogScreen } from './src/screens/LogScreen.tsx';
import { ScheduleScreen } from './src/screens/ScheduleScreen.tsx';
import { PetForm } from './src/screens/PetForm.tsx';
import { SettingsScreen } from './src/screens/SettingsScreen.tsx';
import { color } from './src/theme.ts';

type Tab = 'home' | 'health' | 'weight' | 'log' | 'schedule' | 'settings';
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'home', label: '홈', icon: '🏠' },
  { key: 'health', label: '건강수첩', icon: '🩺' },
  { key: 'weight', label: '체중', icon: '⚖️' },
  { key: 'log', label: '생활일지', icon: '📔' },
  { key: 'schedule', label: '일정', icon: '🔔' },
  { key: 'settings', label: '설정', icon: '⚙️' },
];
// 반려동물을 등록하기 전에는 홈·설정만
const FIRST_TABS = TABS.filter((t) => t.key === 'home' || t.key === 'settings');

function Main() {
  const { ready, db, saveError } = useAppData();
  // 폰 아래쪽 버튼·제스처 영역만큼 탭 바를 올림
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('home');
  const [addPet, setAddPet] = useState(false);
  const hasPet = db.pets.length > 0;
  const onAddPet = () => setAddPet(true);
  // 등록 전에는 설정 외 탭은 홈으로 보임
  const current: Tab = hasPet || tab === 'settings' ? tab : 'home';

  let body: React.ReactNode;
  if (!ready) body = <ActivityIndicator style={{ marginTop: 48 }} color={color.primary} />;
  else if (tab === 'settings') body = <SettingsScreen />;
  else if (!hasPet || tab === 'home') body = <HomeScreen goTo={setTab} />;
  else if (tab === 'health') body = <HealthScreen onAddPet={onAddPet} />;
  else if (tab === 'weight') body = <WeightScreen onAddPet={onAddPet} />;
  else if (tab === 'log') body = <LogScreen onAddPet={onAddPet} />;
  else body = <ScheduleScreen onAddPet={onAddPet} />;

  return (
    <View style={{ flex: 1 }}>
      {/* 테스트 앱에서만 보임: 지금 확인 중인 업데이트 */}
      <TestBuildRibbon />
      <UpdateGate icon="🐾" forceMessage="안전한 반려동물 건강 기록 관리를 위해 최신 버전으로 업데이트가 필요해요." />
      {saveError && (
        <View style={s.warn} accessibilityRole="alert">
          <Text style={{ color: color.danger, fontSize: 13 }}>⚠ 기기에 저장하지 못했어요. 저장 공간을 확인해 주세요.</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>{body}</View>
      {ready && (
        <View style={[s.tabBar, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 0 : 4) }]} accessibilityRole="tablist">
          {(hasPet ? TABS : FIRST_TABS).map((t) => (
            <Pressable
              key={t.key}
              style={s.tab}
              onPress={() => setTab(t.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: current === t.key }}
              accessibilityLabel={t.label}
            >
              <Text style={{ fontSize: 20, opacity: current === t.key ? 1 : 0.55 }}>{t.icon}</Text>
              <Text style={[s.tabText, current === t.key && s.tabOn]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {addPet && <PetForm onClose={() => setAddPet(false)} />}
    </View>
  );
}

/** 가족 공유: 같은 가족끼리 기록 주고받기 */
function FamilySync({ children }: { children: React.ReactNode }) {
  const { syncSource } = useAppData();
  return (
    <FamilySyncProvider appSlug="pet" source={syncSource}>
      {children}
    </FamilySyncProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
    {/* 위쪽(시계·배터리)과 좌우만 비움. 아래는 탭 바가 직접 비움 */}
    <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" />
      <ThemeProvider theme={color}>
        <DialogProvider>
          <AppDataProvider>
            <FamilySync>
              <Main />
            </FamilySync>
          </AppDataProvider>
        </DialogProvider>
      </ThemeProvider>
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg, ...(Platform.OS === 'web' ? { height: '100%' as const } : null) },
  warn: { backgroundColor: '#FFEBEE', padding: 10, alignItems: 'center' },
  tabBar: { flexDirection: 'row', borderTopWidth: 1, borderColor: color.line, backgroundColor: '#fff' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  tabText: { fontSize: 11, color: color.sub, marginTop: 2 },
  tabOn: { color: color.primary, fontWeight: '700' },
});
