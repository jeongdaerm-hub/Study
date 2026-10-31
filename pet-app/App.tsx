import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { UpdateGate } from './src/update/UpdateGate.tsx';
import { HomeScreen } from './src/screens/HomeScreen.tsx';

export default function App() {
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <UpdateGate />
      <HomeScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F7F9' },
});
