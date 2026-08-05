import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, ChipRow, Divider, Input } from '@/components/ui';
import { colors, fonts, radii } from '@/theme';
import type { BarcodeFormat } from '@/types';

let nextEditorId = 1;
const id = (prefix: string) => `${prefix}-${nextEditorId++}`;

export interface EditableBarcode {
  id: string;
  format: BarcodeFormat;
  message: string;
  altText: string;
  messageEncoding: string;
}
export interface EditableLocation {
  id: string;
  latitude: string;
  longitude: string;
  altitude: string;
  relevantText: string;
}
export interface EditableBeacon {
  id: string;
  proximityUUID: string;
  major: string;
  minor: string;
  relevantText: string;
}
export interface EditableRelevantDate {
  id: string;
  kind: 'date' | 'interval';
  date: string;
  startDate: string;
  endDate: string;
}
export interface EditableTranslation {
  id: string;
  key: string;
  value: string;
}
export interface EditableLocalization {
  id: string;
  language: string;
  translations: EditableTranslation[];
}

export const newBarcode = (): EditableBarcode => ({ id: id('barcode'), format: 'PKBarcodeFormatQR', message: '', altText: '', messageEncoding: 'iso-8859-1' });
export const newLocation = (): EditableLocation => ({ id: id('location'), latitude: '', longitude: '', altitude: '', relevantText: '' });
export const newBeacon = (): EditableBeacon => ({ id: id('beacon'), proximityUUID: '', major: '', minor: '', relevantText: '' });
export const newRelevantDate = (): EditableRelevantDate => ({ id: id('relevant'), kind: 'date', date: '', startDate: '', endDate: '' });
export const newTranslation = (): EditableTranslation => ({ id: id('translation'), key: '', value: '' });
export const newLocalization = (): EditableLocalization => ({ id: id('localization'), language: '', translations: [newTranslation()] });

const BARCODE_OPTIONS: { value: BarcodeFormat; label: string }[] = [
  { value: 'PKBarcodeFormatQR', label: 'QR' },
  { value: 'PKBarcodeFormatPDF417', label: 'PDF417' },
  { value: 'PKBarcodeFormatAztec', label: 'Aztec' },
  { value: 'PKBarcodeFormatCode128', label: 'Code 128' },
];

function EditorCard({ index, title, onRemove, children }: { index: number; title: string; onRemove: () => void; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.number}><Text style={styles.numberText}>{index + 1}</Text></View>
        <Text style={styles.cardTitle}>{title}</Text>
        <Button title="Remove" kind="ghost" compact onPress={onRemove} />
      </View>
      <Divider />
      {children}
    </View>
  );
}

export function BarcodesEditor({ value, onChange }: { value: EditableBarcode[]; onChange: (value: EditableBarcode[]) => void }) {
  const update = (entryId: string, patch: Partial<EditableBarcode>) => onChange(value.map((entry) => entry.id === entryId ? { ...entry, ...patch } : entry));
  return (
    <View style={styles.wrap}>
      {value.map((entry, index) => (
        <EditorCard key={entry.id} index={index} title={entry.altText || 'Barcode'} onRemove={() => onChange(value.filter((item) => item.id !== entry.id))}>
          <ChipRow options={BARCODE_OPTIONS} value={entry.format} onChange={(format) => update(entry.id, { format })} />
          <Input label="Encoded message" value={entry.message} onChangeText={(message) => update(entry.id, { message })} placeholder="MEMBER-12345" />
          <Input label="Text below barcode" value={entry.altText} onChangeText={(altText) => update(entry.id, { altText })} placeholder="Member 12345" />
          <Input label="Message encoding" value={entry.messageEncoding} onChangeText={(messageEncoding) => update(entry.id, { messageEncoding })} placeholder="iso-8859-1" />
        </EditorCard>
      ))}
      {value.length === 0 ? <Empty text="No barcodes. Wallet can render up to four fallback formats." /> : null}
      <Button title="+ Add barcode" kind="secondary" disabled={value.length >= 4} onPress={() => onChange([...value, newBarcode()])} />
    </View>
  );
}

export function LocationsEditor({ value, onChange }: { value: EditableLocation[]; onChange: (value: EditableLocation[]) => void }) {
  const update = (entryId: string, patch: Partial<EditableLocation>) => onChange(value.map((entry) => entry.id === entryId ? { ...entry, ...patch } : entry));
  return (
    <View style={styles.wrap}>
      {value.map((entry, index) => (
        <EditorCard key={entry.id} index={index} title={entry.relevantText || 'Location'} onRemove={() => onChange(value.filter((item) => item.id !== entry.id))}>
          <View style={styles.twoColumn}>
            <View style={styles.column}><Input label="Latitude" value={entry.latitude} onChangeText={(latitude) => update(entry.id, { latitude })} placeholder="40.7128" keyboardType="numbers-and-punctuation" /></View>
            <View style={styles.column}><Input label="Longitude" value={entry.longitude} onChangeText={(longitude) => update(entry.id, { longitude })} placeholder="-74.0060" keyboardType="numbers-and-punctuation" /></View>
          </View>
          <Input label="Altitude" value={entry.altitude} onChangeText={(altitude) => update(entry.id, { altitude })} placeholder="Optional meters" keyboardType="numbers-and-punctuation" />
          <Input label="Relevant text" value={entry.relevantText} onChangeText={(relevantText) => update(entry.id, { relevantText })} placeholder="You're near the venue" />
        </EditorCard>
      ))}
      {value.length === 0 ? <Empty text="Add geographic points where Wallet may surface this pass." /> : null}
      <Button title="+ Add location" kind="secondary" disabled={value.length >= 10} onPress={() => onChange([...value, newLocation()])} />
    </View>
  );
}

export function BeaconsEditor({ value, onChange }: { value: EditableBeacon[]; onChange: (value: EditableBeacon[]) => void }) {
  const update = (entryId: string, patch: Partial<EditableBeacon>) => onChange(value.map((entry) => entry.id === entryId ? { ...entry, ...patch } : entry));
  return (
    <View style={styles.wrap}>
      {value.map((entry, index) => (
        <EditorCard key={entry.id} index={index} title={entry.relevantText || 'iBeacon'} onRemove={() => onChange(value.filter((item) => item.id !== entry.id))}>
          <Input label="Proximity UUID" value={entry.proximityUUID} onChangeText={(proximityUUID) => update(entry.id, { proximityUUID })} placeholder="00000000-0000-0000-0000-000000000000" />
          <View style={styles.twoColumn}>
            <View style={styles.column}><Input label="Major" value={entry.major} onChangeText={(major) => update(entry.id, { major })} placeholder="Optional" keyboardType="number-pad" /></View>
            <View style={styles.column}><Input label="Minor" value={entry.minor} onChangeText={(minor) => update(entry.id, { minor })} placeholder="Optional" keyboardType="number-pad" /></View>
          </View>
          <Input label="Relevant text" value={entry.relevantText} onChangeText={(relevantText) => update(entry.id, { relevantText })} placeholder="Welcome to the entrance" />
        </EditorCard>
      ))}
      {value.length === 0 ? <Empty text="Add iBeacons that can make Wallet surface the pass nearby." /> : null}
      <Button title="+ Add beacon" kind="secondary" disabled={value.length >= 10} onPress={() => onChange([...value, newBeacon()])} />
    </View>
  );
}

export function RelevantDatesEditor({ value, onChange }: { value: EditableRelevantDate[]; onChange: (value: EditableRelevantDate[]) => void }) {
  const update = (entryId: string, patch: Partial<EditableRelevantDate>) => onChange(value.map((entry) => entry.id === entryId ? { ...entry, ...patch } : entry));
  return (
    <View style={styles.wrap}>
      {value.map((entry, index) => (
        <EditorCard key={entry.id} index={index} title={entry.kind === 'date' ? 'Relevant date' : 'Live Activity interval'} onRemove={() => onChange(value.filter((item) => item.id !== entry.id))}>
          <ChipRow options={[{ value: 'date', label: 'Single date' }, { value: 'interval', label: 'Interval' }]} value={entry.kind} onChange={(kind) => update(entry.id, { kind })} />
          {entry.kind === 'date' ? (
            <Input label="ISO-8601 date" value={entry.date} onChangeText={(date) => update(entry.id, { date })} placeholder="2026-09-01T19:30:00-04:00" />
          ) : (
            <>
              <Input label="Start date" value={entry.startDate} onChangeText={(startDate) => update(entry.id, { startDate })} placeholder="2026-09-01T18:30:00-04:00" />
              <Input label="End date" value={entry.endDate} onChangeText={(endDate) => update(entry.id, { endDate })} placeholder="2026-09-01T22:30:00-04:00" helper="passkit-generator allows a relevancy interval up to 24 hours." />
            </>
          )}
        </EditorCard>
      ))}
      {value.length === 0 ? <Empty text="Single dates control relevance; intervals can trigger modern event Live Activities." /> : null}
      <Button title="+ Add relevant date" kind="secondary" onPress={() => onChange([...value, newRelevantDate()])} />
    </View>
  );
}

export function LocalizationsEditor({ value, onChange }: { value: EditableLocalization[]; onChange: (value: EditableLocalization[]) => void }) {
  const updateLanguage = (entryId: string, language: string) => onChange(value.map((entry) => entry.id === entryId ? { ...entry, language } : entry));
  const updateTranslations = (entryId: string, translations: EditableTranslation[]) => onChange(value.map((entry) => entry.id === entryId ? { ...entry, translations } : entry));
  return (
    <View style={styles.wrap}>
      {value.map((entry, index) => (
        <EditorCard key={entry.id} index={index} title={entry.language || 'Language'} onRemove={() => onChange(value.filter((item) => item.id !== entry.id))}>
          <Input label="Language tag" value={entry.language} onChangeText={(language) => updateLanguage(entry.id, language)} placeholder="en or en-US" helper="This also enables localized artwork slots in the Artwork tab." />
          {entry.translations.map((translation, translationIndex) => (
            <View key={translation.id} style={styles.translation}>
              <View style={styles.translationHeading}>
                <Text style={styles.translationTitle}>Translation {translationIndex + 1}</Text>
                <Button title="Remove" kind="ghost" compact onPress={() => updateTranslations(entry.id, entry.translations.filter((item) => item.id !== translation.id))} />
              </View>
              <Input label="Source key" value={translation.key} onChangeText={(key) => updateTranslations(entry.id, entry.translations.map((item) => item.id === translation.id ? { ...item, key } : item))} placeholder="MEMBER_LABEL" />
              <Input label="Localized value" value={translation.value} onChangeText={(translationValue) => updateTranslations(entry.id, entry.translations.map((item) => item.id === translation.id ? { ...item, value: translationValue } : item))} placeholder="Member" autoCapitalize="sentences" />
            </View>
          ))}
          <Button title="+ Add translation" kind="ghost" onPress={() => updateTranslations(entry.id, [...entry.translations, newTranslation()])} />
        </EditorCard>
      ))}
      {value.length === 0 ? <Empty text="Localize any text key and optionally provide per-language artwork." /> : null}
      <Button title="+ Add language" kind="secondary" onPress={() => onChange([...value, newLocalization()])} />
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  card: { gap: 13, padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: radii.plate, backgroundColor: colors.cardElevated },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  number: { width: 27, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.band, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  numberText: { color: colors.textSoft, fontFamily: fonts.monoSemiBold, fontSize: 12 },
  cardTitle: { flex: 1, color: colors.text, fontFamily: fonts.textSemiBold, fontSize: 14 },
  twoColumn: { flexDirection: 'row', gap: 10 },
  column: { flex: 1 },
  empty: { color: colors.dim, fontFamily: fonts.text, fontSize: 12, lineHeight: 17, textAlign: 'center', padding: 14 },
  translation: { gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 12 },
  translationHeading: { flexDirection: 'row', alignItems: 'center' },
  translationTitle: { flex: 1, color: colors.textSoft, fontFamily: fonts.textSemiBold, fontSize: 12 },
});
