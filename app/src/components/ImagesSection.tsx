import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import type { ProcessedImage } from '@/lib/images';
import type { ImageSlot } from '@/lib/slots';
import { colors } from '@/theme';

export function ImagesSection({
  slots,
  images,
  busySlot,
  onPick,
  onClear,
}: {
  slots: ImageSlot[];
  images: Partial<Record<string, ProcessedImage>>;
  busySlot: string | null;
  onPick: (slot: ImageSlot) => void;
  onClear: (slot: ImageSlot) => void;
}) {
  return (
    <View style={styles.wrap}>
      {slots.map((slot) => {
        const picked = images[slot.name];
        return (
          <View key={slot.name} style={styles.slot}>
            <View style={styles.slotHeader}>
              <Text style={styles.slotName}>
                {slot.name}
                {slot.required ? <Text style={styles.required}> · required</Text> : null}
              </Text>
              <Text style={styles.slotHint}>{slot.hint}</Text>
            </View>
            {picked ? (
              <Image
                source={{ uri: picked.previewUri }}
                style={[
                  styles.preview,
                  { aspectRatio: slot.width / slot.height },
                ]}
                contentFit="cover"
              />
            ) : null}
            <View style={styles.slotButtons}>
              <View style={styles.slotButton}>
                <Button
                  title={picked ? 'Replace' : 'Choose photo'}
                  kind="secondary"
                  loading={busySlot === slot.name}
                  onPress={() => onPick(slot)}
                />
              </View>
              {picked ? (
                <View style={styles.slotButton}>
                  <Button title="Clear" kind="danger" onPress={() => onClear(slot)} />
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 16,
  },
  slot: {
    gap: 8,
  },
  slotHeader: {
    gap: 2,
  },
  slotName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  required: {
    color: colors.accent,
    fontWeight: '400',
  },
  slotHint: {
    color: colors.dim,
    fontSize: 12,
  },
  preview: {
    width: '100%',
    maxHeight: 160,
    borderRadius: 8,
    backgroundColor: colors.bg,
  },
  slotButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  slotButton: {
    flex: 1,
  },
});
