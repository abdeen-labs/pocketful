import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TEMPLATES, type PassTemplate } from '@/lib/templates';
import { colors, radii } from '@/theme';
import type { PassStyle } from '@/types';

const STYLE_LABELS: Record<PassStyle, string> = {
  generic: 'Pass',
  storeCard: 'Store card',
  coupon: 'Coupon',
  eventTicket: 'Event ticket',
  boardingPass: 'Boarding pass',
};

export function TemplateGallery({ onApply }: { onApply: (template: PassTemplate) => void }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
      snapToInterval={CARD_WIDTH + CARD_GAP}
      decelerationRate="fast"
    >
      {TEMPLATES.map((template) => (
        <TemplateCard key={template.id} template={template} onPress={() => onApply(template)} />
      ))}
    </ScrollView>
  );
}

function TemplateCard({ template, onPress }: { template: PassTemplate; onPress: () => void }) {
  const { background, foreground, label } = template.colors;
  const primary = template.fields.find((field) => field.category === 'primary');
  const details = template.fields
    .filter((field) => field.category === 'header' || field.category === 'secondary')
    .filter((field) => field.valueType !== 'date')
    .slice(0, 2);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={[styles.pass, { backgroundColor: background }]}>
        <View style={[styles.orb, { backgroundColor: label }]} />
        <View style={styles.topRow}>
          <Text style={styles.glyph}>{template.glyph}</Text>
          <Text style={[styles.logoText, { color: foreground }]} numberOfLines={1}>{template.logoText}</Text>
          <Text style={[styles.styleTag, { color: label }]}>{STYLE_LABELS[template.style].toUpperCase()}</Text>
        </View>
        <View style={styles.primaryBlock}>
          {primary?.label ? <Text style={[styles.fieldLabel, { color: label }]} numberOfLines={1}>{primary.label.toUpperCase()}</Text> : null}
          <Text style={[styles.primaryValue, { color: foreground }]} numberOfLines={1}>{primary?.value ?? template.name}</Text>
        </View>
        <View style={styles.bottomRow}>
          <View style={styles.details}>
            {details.map((field) => (
              <View key={field.key} style={styles.detail}>
                {field.label ? <Text style={[styles.fieldLabel, { color: label }]} numberOfLines={1}>{field.label.toUpperCase()}</Text> : null}
                <Text style={[styles.detailValue, { color: foreground }]} numberOfLines={1}>{field.value}</Text>
              </View>
            ))}
          </View>
          {template.barcode ? (
            <View style={styles.barcode}>
              {[2, 1, 3, 1, 2, 3, 1, 2].map((width, index) => <View key={index} style={[styles.bar, { width }]} />)}
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.caption}>
        <Text style={styles.name}>{template.name}</Text>
        <Text style={styles.tagline} numberOfLines={2}>{template.tagline}</Text>
      </View>
    </Pressable>
  );
}

const CARD_WIDTH = 208;
const CARD_GAP = 12;

const styles = StyleSheet.create({
  scroll: { marginHorizontal: -16 },
  row: { paddingHorizontal: 16, gap: CARD_GAP },
  card: { width: CARD_WIDTH, gap: 9 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  pass: { height: 128, borderRadius: 18, padding: 13, overflow: 'hidden', justifyContent: 'space-between' },
  orb: { position: 'absolute', width: 104, height: 104, borderRadius: 52, right: -30, top: -44, opacity: 0.16 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  glyph: { fontSize: 15 },
  logoText: { flex: 1, fontSize: 12, fontWeight: '700', letterSpacing: -0.2 },
  styleTag: { fontSize: 7, fontWeight: '800', letterSpacing: 0.8 },
  primaryBlock: { gap: 1 },
  fieldLabel: { fontSize: 7.5, fontWeight: '800', letterSpacing: 0.7 },
  primaryValue: { fontSize: 19, fontWeight: '800', letterSpacing: -0.4 },
  bottomRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  details: { flex: 1, flexDirection: 'row', gap: 12 },
  detail: { gap: 1, maxWidth: 76 },
  detailValue: { fontSize: 10.5, fontWeight: '700' },
  barcode: { height: 16, flexDirection: 'row', gap: 1.5, alignItems: 'stretch', backgroundColor: colors.white, borderRadius: 3, paddingHorizontal: 4, paddingVertical: 3 },
  bar: { backgroundColor: colors.black },
  caption: { gap: 2, paddingHorizontal: 2 },
  name: { color: colors.text, fontSize: 14, fontWeight: '700' },
  tagline: { color: colors.dim, fontSize: 11, lineHeight: 15 },
});
