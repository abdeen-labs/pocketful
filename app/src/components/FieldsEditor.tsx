import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, ChipRow, Disclosure, Input, MultiChipRow, ToggleRow } from '@/components/ui';
import { colors, radii } from '@/theme';
import type {
  DataDetectorType,
  DateStyle,
  FieldCategory,
  NumberStyle,
  PassStyle,
  TextAlignment,
} from '@/types';

export interface EditableField {
  id: string;
  category: FieldCategory;
  key: string;
  label: string;
  value: string;
  valueType: 'text' | 'number' | 'date';
  attributedValue: string;
  changeMessage: string;
  textAlignment: 'unset' | TextAlignment;
  dateStyle: 'unset' | DateStyle;
  timeStyle: 'unset' | DateStyle;
  ignoresTimeZone: boolean;
  isRelative: boolean;
  currencyCode: string;
  numberStyle: 'unset' | NumberStyle;
  row: 'unset' | '0' | '1';
  dataDetectorTypes: DataDetectorType[];
  semanticsJson: string;
}

const BASE_CATEGORY_OPTIONS: { value: FieldCategory; label: string }[] = [
  { value: 'header', label: 'Header' },
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'auxiliary', label: 'Auxiliary' },
  { value: 'back', label: 'Back' },
];
const VALUE_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
] as const;
const ALIGNMENTS: { value: EditableField['textAlignment']; label: string }[] = [
  { value: 'unset', label: 'Automatic' },
  { value: 'PKTextAlignmentLeft', label: 'Left' },
  { value: 'PKTextAlignmentCenter', label: 'Center' },
  { value: 'PKTextAlignmentRight', label: 'Right' },
  { value: 'PKTextAlignmentNatural', label: 'Natural' },
];
const DATE_STYLES: { value: EditableField['dateStyle']; label: string }[] = [
  { value: 'unset', label: 'Automatic' },
  { value: 'PKDateStyleNone', label: 'None' },
  { value: 'PKDateStyleShort', label: 'Short' },
  { value: 'PKDateStyleMedium', label: 'Medium' },
  { value: 'PKDateStyleLong', label: 'Long' },
  { value: 'PKDateStyleFull', label: 'Full' },
];
const NUMBER_STYLES: { value: EditableField['numberStyle']; label: string }[] = [
  { value: 'unset', label: 'Automatic' },
  { value: 'PKNumberStyleDecimal', label: 'Decimal' },
  { value: 'PKNumberStylePercent', label: 'Percent' },
  { value: 'PKNumberStyleScientific', label: 'Scientific' },
  { value: 'PKNumberStyleSpellOut', label: 'Spell out' },
];
const DETECTORS: { value: DataDetectorType; label: string }[] = [
  { value: 'PKDataDetectorTypePhoneNumber', label: 'Phone' },
  { value: 'PKDataDetectorTypeLink', label: 'Link' },
  { value: 'PKDataDetectorTypeAddress', label: 'Address' },
  { value: 'PKDataDetectorTypeCalendarEvent', label: 'Calendar' },
];

let nextFieldId = 1;
export function newField(category: FieldCategory = 'primary'): EditableField {
  return {
    id: `field-${nextFieldId++}`,
    category,
    key: '',
    label: '',
    value: '',
    valueType: 'text',
    attributedValue: '',
    changeMessage: '',
    textAlignment: 'unset',
    dateStyle: 'unset',
    timeStyle: 'unset',
    ignoresTimeZone: false,
    isRelative: false,
    currencyCode: '',
    numberStyle: 'unset',
    row: 'unset',
    dataDetectorTypes: [],
    semanticsJson: '',
  };
}

export function FieldsEditor({
  fields,
  style,
  onChange,
}: {
  fields: EditableField[];
  style: PassStyle;
  onChange: (fields: EditableField[]) => void;
}) {
  const update = (id: string, patch: Partial<EditableField>) => {
    onChange(fields.map((field) => (field.id === id ? { ...field, ...patch } : field)));
  };
  const categoryOptions = style === 'eventTicket'
    ? [...BASE_CATEGORY_OPTIONS, { value: 'additionalInfo' as const, label: 'Event details' }]
    : BASE_CATEGORY_OPTIONS;

  return (
    <View style={styles.wrap}>
      {fields.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No content fields yet</Text>
          <Text style={styles.emptyText}>Add the visible text, dates, numbers, and back-of-pass details Wallet should render.</Text>
        </View>
      ) : null}
      {fields.map((field, index) => (
        <View key={field.id} style={styles.field}>
          <View style={styles.fieldHeader}>
            <View style={styles.numberBubble}><Text style={styles.numberText}>{index + 1}</Text></View>
            <View style={styles.fieldHeaderCopy}>
              <Text style={styles.fieldTitle}>{field.label || field.key || 'Untitled field'}</Text>
              <Text style={styles.fieldMeta}>{field.category} · {field.valueType}</Text>
            </View>
            <Button title="Remove" kind="ghost" compact onPress={() => onChange(fields.filter((item) => item.id !== field.id))} />
          </View>

          <ChipRow options={categoryOptions} value={field.category} onChange={(category) => update(field.id, { category })} />
          <View style={styles.twoColumn}>
            <View style={styles.column}><Input label="Label" value={field.label} onChangeText={(label) => update(field.id, { label })} placeholder="MEMBER" /></View>
            <View style={styles.column}><Input label="Unique key" value={field.key} onChangeText={(key) => update(field.id, { key })} placeholder={`${field.category}-${index + 1}`} /></View>
          </View>
          <ChipRow options={[...VALUE_TYPES]} value={field.valueType} onChange={(valueType) => update(field.id, { valueType })} />
          <Input
            label={field.valueType === 'date' ? 'ISO-8601 date value' : field.valueType === 'number' ? 'Numeric value' : 'Value'}
            value={field.value}
            onChangeText={(value) => update(field.id, { value })}
            placeholder={field.valueType === 'date' ? '2026-09-01T19:30:00-04:00' : field.valueType === 'number' ? '42.50' : 'Jane Appleseed'}
            keyboardType={field.valueType === 'number' ? 'decimal-pad' : 'default'}
          />

          <Disclosure title="Formatting & behavior" description="Attributed display, updates, alignment, data detection, and type-specific formatting">
            <Input label="Attributed value" value={field.attributedValue} onChangeText={(attributedValue) => update(field.id, { attributedValue })} placeholder="Optional rich display value" />
            <Input label="Change message" value={field.changeMessage} onChangeText={(changeMessage) => update(field.id, { changeMessage })} placeholder="Gate changed to %@" helper="Use %@ where Wallet should insert the new value." />
            <Text style={styles.miniLabel}>Text alignment</Text>
            <ChipRow options={ALIGNMENTS} value={field.textAlignment} onChange={(textAlignment) => update(field.id, { textAlignment })} />
            {field.category === 'back' ? (
              <>
                <Text style={styles.miniLabel}>Automatic data detection</Text>
                <MultiChipRow options={DETECTORS} values={field.dataDetectorTypes} onChange={(dataDetectorTypes) => update(field.id, { dataDetectorTypes })} />
              </>
            ) : null}
            {field.valueType === 'date' ? (
              <>
                <Text style={styles.miniLabel}>Date style</Text>
                <ChipRow options={DATE_STYLES} value={field.dateStyle} onChange={(dateStyle) => update(field.id, { dateStyle })} />
                <Text style={styles.miniLabel}>Time style</Text>
                <ChipRow options={DATE_STYLES} value={field.timeStyle} onChange={(timeStyle) => update(field.id, { timeStyle })} />
                <ToggleRow label="Ignore time zone" value={field.ignoresTimeZone} onChange={(ignoresTimeZone) => update(field.id, { ignoresTimeZone })} />
                <ToggleRow label="Show relative date" description="For example, “in 3 hours.”" value={field.isRelative} onChange={(isRelative) => update(field.id, { isRelative })} />
              </>
            ) : null}
            {field.valueType === 'number' ? (
              <>
                <Text style={styles.miniLabel}>Number style</Text>
                <ChipRow options={NUMBER_STYLES} value={field.numberStyle} onChange={(numberStyle) => update(field.id, { numberStyle })} />
                <Input label="Currency code" value={field.currencyCode} onChangeText={(currencyCode) => update(field.id, { currencyCode })} placeholder="USD" autoCapitalize="characters" />
              </>
            ) : null}
            {style === 'eventTicket' && field.category === 'auxiliary' ? (
              <>
                <Text style={styles.miniLabel}>Auxiliary row</Text>
                <ChipRow options={[{ value: 'unset', label: 'Automatic' }, { value: '0', label: 'Row 1' }, { value: '1', label: 'Row 2' }]} value={field.row} onChange={(row) => update(field.id, { row })} />
              </>
            ) : null}
            <Input
              label="Field semantics (JSON)"
              value={field.semanticsJson}
              onChangeText={(semanticsJson) => update(field.id, { semanticsJson })}
              placeholder={'{\n  "seat": { "seatNumber": "12A" }\n}'}
              multiline
              autoCapitalize="none"
              helper="Any passkit-generator semantic tags object. Leave blank for none."
            />
          </Disclosure>
        </View>
      ))}
      <Button title="+ Add pass field" kind="secondary" onPress={() => onChange([...fields, newField()])} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  empty: { alignItems: 'center', padding: 20, gap: 5, borderRadius: radii.medium, backgroundColor: colors.surface },
  emptyTitle: { color: colors.textSoft, fontSize: 15, fontWeight: '700' },
  emptyText: { color: colors.dim, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  field: { gap: 13, borderWidth: 1, borderColor: colors.border, borderRadius: radii.medium, padding: 14, backgroundColor: colors.cardElevated },
  fieldHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  numberBubble: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentMuted },
  numberText: { color: colors.accent, fontSize: 12, fontWeight: '800' },
  fieldHeaderCopy: { flex: 1, gap: 1 },
  fieldTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  fieldMeta: { color: colors.dim, fontSize: 11, textTransform: 'capitalize' },
  twoColumn: { flexDirection: 'row', gap: 10 },
  column: { flex: 1 },
  miniLabel: { color: colors.textSoft, fontSize: 12, fontWeight: '600' },
});
