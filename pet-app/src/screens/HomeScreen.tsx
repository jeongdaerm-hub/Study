import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

interface Pet {
  id: string;
  name: string;
  species: '강아지' | '고양이';
  nextVaccine: string;
}

const PETS: Pet[] = [
  { id: '1', name: '초코', species: '강아지', nextVaccine: '2026-11-15 종합백신' },
  { id: '2', name: '나비', species: '고양이', nextVaccine: '2026-12-02 광견병' },
];

export function HomeScreen() {
  return (
    <FlatList
      data={PETS}
      keyExtractor={(p) => p.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={<Text style={styles.header}>우리 아이들</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.name}>
            {item.species === '강아지' ? '🐶' : '🐱'} {item.name}
          </Text>
          <Text style={styles.sub}>다음 접종: {item.nextVaccine}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16 },
  header: { fontSize: 22, fontWeight: '800', marginBottom: 12 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, elevation: 1 },
  name: { fontSize: 18, fontWeight: '700' },
  sub: { fontSize: 13, color: '#666', marginTop: 4 },
});
