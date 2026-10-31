import React, { useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { UpdateGate } from './src/update/UpdateGate.tsx';
import { AppDataProvider, useAppData } from './src/state/AppData.tsx';
import { HomeScreen } from './src/screens/HomeScreen.tsx';
import { DiaryScreen } from './src/screens/DiaryScreen.tsx';
import { ScheduleScreen } from './src/screens/ScheduleScreen.tsx';
import { PETS } from './src/data/pets.ts';
import { color } from './src/components/ui.tsx';

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
      <UpdateGate />
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
      <AppDataProvider>
        <Main />
      </AppDataProvider>
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
