import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { EditableField } from '@/components/FieldsEditor';
import type { ProcessedImage } from '@/lib/images';
import { colors, fonts, radii, tracking } from '@/theme';
import type { PassStyle } from '@/types';

const HEX_COLOR = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;
const STYLE_LABELS: Record<PassStyle, string> = {
  generic: 'Generic pass',
  storeCard: 'Store card',
  coupon: 'Coupon',
  eventTicket: 'Event ticket',
  boardingPass: 'Boarding pass',
};

export function PassPreview({
  style,
  description,
  organizationName,
  logoText,
  backgroundColor,
  foregroundColor,
  labelColor,
  fields,
  images,
  barcodeCount,
  voided,
}: {
  style: PassStyle;
  description: string;
  organizationName: string;
  logoText: string;
  backgroundColor: string;
  foregroundColor: string;
  labelColor: string;
  fields: EditableField[];
  images: Partial<Record<string, ProcessedImage>>;
  barcodeCount: number;
  voided: boolean;
}) {
  const background = HEX_COLOR.test(backgroundColor) ? backgroundColor : '#131822';
  const foreground = HEX_COLOR.test(foregroundColor) ? foregroundColor : '#ffffff';
  const labels = HEX_COLOR.test(labelColor) ? labelColor : '#a9b2c0';
  const primary = fields.filter((field) => field.category === 'primary' && field.value).slice(0, 2);
  const detail = fields.filter((field) => ['header', 'secondary', 'auxiliary'].includes(field.category) && field.value).slice(0, 4);
  const posterArtwork = style === 'eventTicket' ? images.artwork : undefined;
  const logo = posterArtwork ? images.primaryLogo ?? images.logo : images.logo;
  const strip = posterArtwork ?? images.strip ?? images.background;

  return (
    <View style={styles.shell}>
      <View style={styles.previewHeading}>
        <View>
          <Text style={styles.eyebrow}>LIVE PREVIEW</Text>
          <Text style={styles.styleLabel}>{STYLE_LABELS[style]}</Text>
        </View>
        <View style={styles.statusPill}><View style={styles.statusDot} /><Text style={styles.statusText}>Draft</Text></View>
      </View>
      <View style={[styles.pass, { backgroundColor: background }]}>
        {strip ? (
          <Image
            source={{ uri: strip.previewUri }}
            style={[styles.artwork, posterArtwork && styles.posterArtwork]}
            contentFit="cover"
            transition={180}
          />
        ) : null}
        <View style={styles.scrim} />
        <View style={styles.passContent}>
          <View style={styles.topRow}>
            {logo ? <Image source={{ uri: logo.previewUri }} style={styles.logoImage} contentFit="contain" /> : <View style={styles.logoMark}><Text style={[styles.logoMarkText, { color: foreground }]}>P</Text></View>}
            <Text style={[styles.logoText, { color: foreground }]} numberOfLines={1}>{logoText || organizationName || 'Pocketful'}</Text>
            <Text style={[styles.passType, { color: labels }]}>{style === 'boardingPass' ? '✈︎' : '◆'}</Text>
          </View>

          <View style={styles.primaryArea}>
            {primary.length ? primary.map((field) => (
              <PreviewField key={field.id} field={field} labelColor={labels} valueColor={foreground} primary />
            )) : (
              <View style={styles.placeholderCopy}>
                <Text style={[styles.previewLabel, { color: labels }]}>DESCRIPTION</Text>
                <Text style={[styles.primaryValue, { color: foreground }]} numberOfLines={2}>{description || 'Your pass description appears here.'}</Text>
              </View>
            )}
          </View>

          {detail.length ? (
            <View style={styles.detailGrid}>
              {detail.map((field) => <PreviewField key={field.id} field={field} labelColor={labels} valueColor={foreground} />)}
            </View>
          ) : null}

          <View style={styles.bottomRow}>
            {barcodeCount ? (
              <View style={styles.barcode}>
                {[2, 1, 3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1].map((width, index) => <View key={index} style={[styles.bar, { width }]} />)}
              </View>
            ) : <Text style={[styles.previewLabel, { color: labels }]}>NO BARCODE</Text>}
            <Text style={[styles.walletMark, { color: foreground }]}>◉</Text>
          </View>
          {voided ? <View style={styles.voided}><Text style={styles.voidedText}>VOID</Text></View> : null}
        </View>
        <View style={[styles.notch, styles.notchLeft]} />
        <View style={[styles.notch, styles.notchRight]} />
      </View>
    </View>
  );
}

function PreviewField({ field, labelColor, valueColor, primary = false }: { field: EditableField; labelColor: string; valueColor: string; primary?: boolean }) {
  return (
    <View style={styles.previewField}>
      {field.label ? <Text style={[styles.previewLabel, { color: labelColor }]} numberOfLines={1}>{field.label.toUpperCase()}</Text> : null}
      <Text style={[primary ? styles.primaryValue : styles.detailValue, { color: valueColor }]} numberOfLines={primary ? 2 : 1}>{field.value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { gap: 12, marginBottom: 22 },
  previewHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  eyebrow: { color: colors.dim, fontFamily: fonts.monoMedium, fontSize: 11, letterSpacing: tracking.micro },
  styleLabel: { color: colors.text, fontFamily: fonts.textSemiBold, fontSize: 17, marginTop: 2 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.control, backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  statusText: { color: colors.textSoft, fontFamily: fonts.monoMedium, fontSize: 11 },
  pass: { minHeight: 225, borderRadius: 24, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  artwork: { ...StyleSheet.absoluteFill, opacity: 0.36 },
  posterArtwork: { opacity: 0.72 },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.08)' },
  passContent: { flex: 1, minHeight: 225, padding: 18, gap: 18 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 30 },
  logoImage: { width: 54, height: 28 },
  logoMark: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.34)', alignItems: 'center', justifyContent: 'center' },
  logoMarkText: { fontSize: 14, fontWeight: '800' },
  logoText: { flex: 1, fontSize: 15, fontWeight: '700' },
  passType: { fontSize: 20 },
  primaryArea: { flexDirection: 'row', gap: 16, minHeight: 52 },
  placeholderCopy: { flex: 1, gap: 3 },
  previewField: { flex: 1, minWidth: 60, gap: 2 },
  previewLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  primaryValue: { fontSize: 25, lineHeight: 29, fontWeight: '800', letterSpacing: -0.5 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  detailValue: { fontSize: 14, fontWeight: '700' },
  bottomRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 'auto' },
  barcode: { height: 28, flexDirection: 'row', gap: 2, alignItems: 'stretch', backgroundColor: colors.white, borderRadius: 4, padding: 5 },
  bar: { backgroundColor: colors.black },
  walletMark: { fontSize: 22 },
  notch: { position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: colors.bg, top: '58%' },
  notchLeft: { left: -11 },
  notchRight: { right: -11 },
  voided: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(70,0,10,0.42)' },
  voidedText: { color: colors.white, fontFamily: fonts.displayHeavy, fontSize: 42, letterSpacing: 5, transform: [{ rotate: '-12deg' }] },
});
