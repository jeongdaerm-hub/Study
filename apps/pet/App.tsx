import React, { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { DialogProvider, ThemeProvider, UpdateGate } from '@daro/app-core';
import { AppDataProvider, useAppData } from './src/state/AppData.tsx';
import { HomeScreen } from './src/screens/HomeScreen.tsx';
import { HealthScreen } from './src/screens/HealthScreen.tsx';
import { WeightScreen } from './src/screens/WeightScreen.tsx';
import { LogScreen } from './src/screens/LogScreen.tsx';
import { ScheduleScreen } from './src/screens/ScheduleScreen.tsx';
import { PetForm } from './src/screens/PetForm.tsx';
import { color } from './src/theme.ts';

type Tab = 'home' | 'health' | 'weight' | 'log' | 'schedule';
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'home', label: '홈', icon: '🏠' },
  { key: 'health', label: '건강수첩', icon: '🩺' },
  { key: 'weight', label: '체중', icon: '⚖️' },
  { key: 'log', label: '생활일지', icon: '📔' },
  { key: 'schedule', label: '일정', icon: '🔔' },
];

function Main() {
  const { ready, db, saveError } = useAppData();
  const [tab, setTab] = useState<Tab>('home');
  const [addPet, setAddPet] = useState(false);
  const hasPet = db.pets.length > 0;
  const onAddPet = () => setAddPet(true);

  let body: React.ReactNode;
  if (!ready) body = <ActivityIndicator style={{ marginTop: 48 }} color={color.primary} />;
  else if (!hasPet || tab === 'home') body = <HomeScreen goTo={setTab} />;
  else if (tab === 'health') body = <HealthScreen onAddPet={onAddPet} />;
  else if (tab === 'weight') body = <WeightScreen onAddPet={onAddPet} />;
  else if (tab === 'log') body = <LogScreen onAddPet={onAddPet} />;
  else body = <ScheduleScreen onAddPet={onAddPet} />;

  return (
    <View style={{ flex: 1 }}>
      <UpdateGate icon="🐾" forceMessage="안전한 반려동물 건강 기록 관리를 위해 최신 버전으로 업데이트가 필요해요." />
      {saveError && (
        <View style={s.warn} accessibilityRole="alert">
          <Text style={{ color: color.danger, fontSize: 13 }}>⚠ 기기에 저장하지 못했어요. 저장 공간을 확인해 주세요.</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>{body}</View>
      {hasPet && (
        <View style={s.tabBar} accessibilityRole="tablist">
          {TABS.map((t) => (
            <Pressable
              key={t.key}
              style={s.tab}
              onPress={() => setTab(t.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t.key }}
              accessibilityLabel={t.label}
            >
              <Text style={{ fontSize: 20, opacity: tab === t.key ? 1 : 0.55 }}>{t.icon}</Text>
              <Text style={[s.tabText, tab === t.key && s.tabOn]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {addPet && <PetForm onClose={() => setAddPet(false)} />}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="dark-content" />
      <ThemeProvider theme={color}>
        <DialogProvider>
          <AppDataProvider>
            <Main />
          </AppDataProvider>
        </DialogProvider>
      </ThemeProvider>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg, ...(Platform.OS === 'web' ? { height: '100%' as const } : null) },
  warn: { backgroundColor: '#FFEBEE', padding: 10, alignItems: 'center' },
  tabBar: { flexDirection: 'row', borderTopWidth: 1, borderColor: color.line, backgroundColor: '#fff', paddingBottom: Platform.OS === 'ios' ? 0 : 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  tabText: { fontSize: 11, color: color.sub, marginTop: 2 },
  tabOn: { color: color.primary, fontWeight: '700' },
});
