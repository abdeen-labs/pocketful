import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TEMPLATES, type PassTemplate, type TemplateField } from '@/lib/templates';
import { colors, radii } from '@/theme';
import type { BarcodeFormat, PassStyle } from '@/types';

const STYLE_LABELS: Record<PassStyle, string> = {
  generic: 'Membership',
  storeCard: 'Rewards',
  coupon: 'Offer',
  eventTicket: 'Event',
  boardingPass: 'Travel',
};

const BARCODE_LABELS: Record<BarcodeFormat, string> = {
  PKBarcodeFormatQR: 'QR',
  PKBarcodeFormatPDF417: 'PDF417',
  PKBarcodeFormatAztec: 'Aztec',
  PKBarcodeFormatCode128: 'Code 128',
};

export function TemplateGallery({
  onApply,
  lastAppliedId,
  applyingId,
}: {
  onApply: (template: PassTemplate) => void;
  lastAppliedId?: string | null;
  applyingId?: string | null;
}) {
  return (
    <View style={styles.gallery}>
      <View style={styles.galleryIntro}>
        <Text style={styles.galleryEyebrow}>CURATED STARTING POINTS</Text>
        <Text style={styles.galleryHint}>Swipe to browse. Your artwork and server settings stay untouched.</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.row}
        snapToInterval={CARD_WIDTH + CARD_GAP}
        snapToAlignment="start"
        decelerationRate="fast"
      >
        {TEMPLATES.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            lastApplied={template.id === lastAppliedId}
            applying={template.id === applyingId}
            disabled={Boolean(applyingId)}
            onPress={() => onApply(template)}
          />
        ))}
      </ScrollView>
      <Text style={styles.galleryCount}>{TEMPLATES.length} templates · Tap any card to use it</Text>
    </View>
  );
}

function TemplateCard({
  template,
  lastApplied,
  applying,
  disabled,
  onPress,
}: {
  template: PassTemplate;
  lastApplied: boolean;
  applying: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { background, foreground, label } = template.colors;
  const primary = template.fields.filter((field) => field.category === 'primary').slice(0, 2);
  const details = template.fields
    .filter((field) => field.category === 'header' || field.category === 'secondary')
    .slice(0, 2);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Use ${template.name} template`}
      accessibilityState={{ disabled, busy: applying }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.card, lastApplied && styles.cardApplied, disabled && styles.cardDisabled, pressed && styles.pressed]}
    >
      <View style={[styles.pass, { backgroundColor: background }]}>
        <View style={[styles.glowLarge, { backgroundColor: label }]} />
        <View style={[styles.glowSmall, { backgroundColor: foreground }]} />

        <View style={styles.passTopRow}>
          <View style={[styles.glyphMark, { borderColor: label }]}>
            <Text style={styles.glyph}>{template.glyph}</Text>
          </View>
          <Text style={[styles.logoText, { color: foreground }]} numberOfLines={1}>{template.logoText}</Text>
          <View style={styles.stylePill}>
            <Text style={[styles.styleTag, { color: foreground }]}>{STYLE_LABELS[template.style].toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.primaryRow}>
          {(primary.length ? primary : [{ key: template.id, value: template.name }] as TemplateField[]).map((field) => (
            <TemplateFieldView key={field.key} field={field} labelColor={label} valueColor={foreground} primary />
          ))}
        </View>

        <View style={styles.passBottomRow}>
          <View style={styles.detailRow}>
            {details.map((field) => (
              <TemplateFieldView key={field.key} field={field} labelColor={label} valueColor={foreground} />
            ))}
          </View>
          {template.barcode ? <BarcodeMark format={template.barcode.format} /> : null}
        </View>

        <View style={[styles.notch, styles.notchLeft]} />
        <View style={[styles.notch, styles.notchRight]} />
      </View>

      <View style={styles.caption}>
        <View style={styles.captionTitleRow}>
          <Text style={styles.name} numberOfLines={1}>{template.name}</Text>
          <Text style={[styles.applyText, lastApplied && styles.appliedText]}>
            {applying ? 'LOADING ARTWORK…' : lastApplied ? 'LAST USED ✓' : 'USE TEMPLATE →'}
          </Text>
        </View>
        <Text style={styles.tagline} numberOfLines={2}>{template.tagline}</Text>
        {template.features?.length ? (
          <View style={styles.featureRow}>
            {template.features.slice(0, 3).map((feature) => (
              <View key={feature} style={styles.featurePill}>
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{STYLE_LABELS[template.style]}</Text>
          <View style={styles.metaDot} />
          <Text style={styles.metaText}>{template.fields.length} fields</Text>
          {template.barcode ? (
            <>
              <View style={styles.metaDot} />
              <Text style={styles.metaText}>{BARCODE_LABELS[template.barcode.format]}</Text>
            </>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function TemplateFieldView({
  field,
  labelColor,
  valueColor,
  primary = false,
}: {
  field: Pick<TemplateField, 'label' | 'value' | 'valueType'>;
  labelColor: string;
  valueColor: string;
  primary?: boolean;
}) {
  return (
    <View style={styles.field}>
      {field.label ? <Text style={[styles.fieldLabel, { color: labelColor }]} numberOfLines={1}>{field.label.toUpperCase()}</Text> : null}
      <Text style={[primary ? styles.primaryValue : styles.detailValue, { color: valueColor }]} numberOfLines={1}>
        {displayFieldValue(field)}
      </Text>
    </View>
  );
}

function BarcodeMark({ format }: { format: BarcodeFormat }) {
  if (format === 'PKBarcodeFormatCode128' || format === 'PKBarcodeFormatPDF417') {
    return (
      <View style={styles.linearBarcode}>
        {[2, 1, 3, 1, 2, 4, 1, 3, 2, 1].map((width, index) => <View key={index} style={[styles.bar, { width }]} />)}
      </View>
    );
  }

  return (
    <View style={styles.squareBarcode}>
      <View style={[styles.finder, styles.finderTopLeft]} />
      <View style={[styles.finder, styles.finderTopRight]} />
      <View style={[styles.finder, styles.finderBottomLeft]} />
      <View style={styles.barcodePixels} />
    </View>
  );
}

function displayFieldValue(field: Pick<TemplateField, 'value' | 'valueType'>): string {
  if (field.valueType !== 'date') return field.value;
  const date = new Date(field.value);
  if (Number.isNaN(date.getTime())) return field.value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const CARD_WIDTH = 264;
const CARD_GAP = 12;

const styles = StyleSheet.create({
  gallery: { gap: 13 },
  galleryIntro: { gap: 3 },
  galleryEyebrow: { color: colors.accent, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  galleryHint: { color: colors.dim, fontSize: 11, lineHeight: 16 },
  galleryCount: { color: colors.dim, fontSize: 10, fontWeight: '600', textAlign: 'center' },
  scroll: { marginHorizontal: -16 },
  row: { paddingHorizontal: 16, gap: CARD_GAP },
  card: { width: CARD_WIDTH, padding: 9, gap: 11, borderRadius: radii.large, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  cardDisabled: { opacity: 0.62 },
  cardApplied: { borderColor: colors.accent, backgroundColor: colors.cardElevated },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  pass: { height: 154, borderRadius: 18, padding: 14, overflow: 'hidden', justifyContent: 'space-between', shadowColor: colors.black, shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 7 } },
  glowLarge: { position: 'absolute', width: 142, height: 142, borderRadius: 71, right: -42, top: -74, opacity: 0.2 },
  glowSmall: { position: 'absolute', width: 92, height: 92, borderRadius: 46, left: -38, bottom: -62, opacity: 0.08 },
  passTopRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  glyphMark: { width: 27, height: 27, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.08)' },
  glyph: { fontSize: 13 },
  logoText: { flex: 1, fontSize: 12, fontWeight: '800', letterSpacing: -0.15 },
  stylePill: { borderRadius: radii.pill, paddingHorizontal: 7, paddingVertical: 4, backgroundColor: 'rgba(0,0,0,0.14)' },
  styleTag: { fontSize: 6.5, fontWeight: '900', letterSpacing: 0.75 },
  primaryRow: { flexDirection: 'row', gap: 12, minHeight: 39 },
  field: { flex: 1, minWidth: 0, gap: 1 },
  fieldLabel: { fontSize: 7, fontWeight: '900', letterSpacing: 0.7 },
  primaryValue: { fontSize: 19, lineHeight: 22, fontWeight: '900', letterSpacing: -0.45 },
  passBottomRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  detailRow: { flex: 1, flexDirection: 'row', gap: 10 },
  detailValue: { fontSize: 10, fontWeight: '800' },
  linearBarcode: { height: 25, flexDirection: 'row', gap: 1.5, alignItems: 'stretch', backgroundColor: colors.white, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 4 },
  bar: { backgroundColor: colors.black },
  squareBarcode: { width: 29, height: 29, borderRadius: 4, backgroundColor: colors.white, padding: 4 },
  finder: { position: 'absolute', width: 7, height: 7, borderWidth: 2, borderColor: colors.black },
  finderTopLeft: { left: 4, top: 4 },
  finderTopRight: { right: 4, top: 4 },
  finderBottomLeft: { left: 4, bottom: 4 },
  barcodePixels: { position: 'absolute', width: 7, height: 7, right: 5, bottom: 5, borderTopWidth: 2, borderLeftWidth: 3, borderBottomWidth: 2, borderColor: colors.black },
  notch: { position: 'absolute', width: 16, height: 16, borderRadius: 8, backgroundColor: colors.surface, top: 87 },
  notchLeft: { left: -8 },
  notchRight: { right: -8 },
  caption: { gap: 5, paddingHorizontal: 2, paddingBottom: 2 },
  captionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  applyText: { color: colors.accent, fontSize: 8, fontWeight: '900', letterSpacing: 0.65 },
  appliedText: { color: colors.success },
  tagline: { color: colors.textSoft, fontSize: 11, lineHeight: 15 },
  featureRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 2 },
  featurePill: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: radii.pill, backgroundColor: colors.accentMuted },
  featureText: { color: colors.accent, fontSize: 8.5, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  metaText: { color: colors.dim, fontSize: 9.5, fontWeight: '600' },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.borderStrong },
});
