import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppUpdate } from '@daro/app-core';
import { color } from '../theme.ts';

export function HomeScreen() {
  const { currentVersion } = useAppUpdate();
  return (
    <View style={s.wrap}>
      <Text style={s.title}>__APP_NAME__</Text>
      <Text style={s.sub}>v{currentVersion}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '800', color: color.text },
  sub: { marginTop: 8, color: color.sub },
});
