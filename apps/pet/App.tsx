import React, { useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { AppDataProvider, useAppData } from './src/state/AppData.tsx';
import { HomeScreen } from './src/screens/HomeScreen.tsx';
import { DiaryScreen } from './src/screens/DiaryScreen.tsx';
import { ScheduleScreen } from './src/screens/ScheduleScreen.tsx';
import { PETS } from './src/data/pets.ts';
import { ThemeProvider, UpdateGate } from '@daro/app-core';
import { color } from './src/theme.ts';

type Tab = 'home' | 'diary' | 'schedule';
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'home', label: '홈', icon: '🏠' },
  { key: 'diary', label: '일기', icon: '📔' },
  { key: 'schedule', label: '일정', icon: '🔔' },
];

function Main() {
  const { ready } = useAppData();
  const [tab, setTab] = useState<Tab>('home');
  const [petId, setPetId] = useState(PETS[0].id);

  return (
    <View style={{ flex: 1 }}>
      <UpdateGate icon="🐾" forceMessage="안전한 반려동물 건강 기록 관리를 위해 최신 버전으로 업데이트가 필요해요." />
      <View style={{ flex: 1 }}>
        {!ready ? (
          <ActivityIndicator style={{ marginTop: 48 }} color={color.primary} />
        ) : tab === 'home' ? (
          <HomeScreen />
        ) : tab === 'diary' ? (
          <DiaryScreen petId={petId} onPetChange={setPetId} />
        ) : (
          <ScheduleScreen petId={petId} onPetChange={setPetId} />
        )}
      </View>
      <View style={s.tabBar}>
        {TABS.map((t) => (
          <Pressable key={t.key} style={s.tab} onPress={() => setTab(t.key)} accessibilityRole="tab" accessibilityState={{ selected: tab === t.key }}>
            <Text style={{ fontSize: 20 }}>{t.icon}</Text>
            <Text style={[s.tabText, tab === t.key && s.tabOn]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="dark-content" />
      <ThemeProvider theme={color}>
        <AppDataProvider>
          <Main />
        </AppDataProvider>
      </ThemeProvider>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  tabBar: { flexDirection: 'row', borderTopWidth: 1, borderColor: color.line, backgroundColor: '#fff' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  tabText: { fontSize: 12, color: color.sub, marginTop: 2 },
  tabOn: { color: color.primary, fontWeight: '700' },
});
