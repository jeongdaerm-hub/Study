import React from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Label, MAX_PHOTOS, pickPhotos, useDialog } from '@daro/app-core';
import { color } from '../theme.ts';

/** 사진 첨부 (앨범 / 촬영) — 위치정보 제거·축소는 공통 모듈이 처리 */
export function PhotoField({
  label = '사진',
  photos,
  onChange,
  max = MAX_PHOTOS,
}: {
  label?: string;
  photos: string[];
  onChange: (p: string[]) => void;
  max?: number;
}) {
  const { notify } = useDialog();
  const add = async (source: 'library' | 'camera') => {
    try {
      const uris = await pickPhotos(source, max - photos.length);
      if (uris.length) onChange([...photos, ...uris]);
    } catch (e) {
      await notify('사진', e instanceof Error ? e.message : '사진을 불러오지 못했어요.');
    }
  };
  return (
    <View>
      <Label>
        {label} ({photos.length}/{max})
      </Label>
      <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
        {photos.map((uri) => (
          <View key={uri}>
            <Image source={{ uri }} style={st.thumb} />
            <Pressable
              style={st.remove}
              onPress={() => onChange(photos.filter((x) => x !== uri))}
              accessibilityLabel="사진 삭제"
              hitSlop={6}
            >
              <Text style={{ color: '#fff', fontSize: 12 }}>✕</Text>
            </Pressable>
          </View>
        ))}
        {photos.length < max && (
          <>
            <Pressable style={[st.thumb, st.add]} onPress={() => add('library')} accessibilityLabel="앨범에서 선택">
              <Text style={st.addText}>🖼️{'\n'}앨범</Text>
            </Pressable>
            {Platform.OS !== 'web' && (
              <Pressable style={[st.thumb, st.add]} onPress={() => add('camera')} accessibilityLabel="사진 촬영">
                <Text style={st.addText}>📷{'\n'}촬영</Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  thumb: { width: 80, height: 80, borderRadius: 10 },
  add: { borderWidth: 1, borderStyle: 'dashed', borderColor: color.line, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  addText: { textAlign: 'center', color: color.sub, fontSize: 12 },
  remove: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
});
