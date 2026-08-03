import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, ChipRow, Input } from '@/components/ui';
import { colors } from '@/theme';
import type { FieldCategory } from '@/types';

export interface EditableField {
  id: string;
  category: FieldCategory;
  label: string;
  value: string;
}

const CATEGORY_OPTIONS: { value: FieldCategory; label: string }[] = [
  { value: 'header', label: 'Header' },
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'auxiliary', label: 'Auxiliary' },
  { value: 'back', label: 'Back' },
];

let nextFieldId = 1;
export function newField(category: FieldCategory = 'primary'): EditableField {
  return { id: `field-${nextFieldId++}`, category, label: '', value: '' };
}

export function FieldsEditor({
  fields,
  onChange,
}: {
  fields: EditableField[];
  onChange: (fields: EditableField[]) => void;
}) {
  const update = (id: string, patch: Partial<EditableField>) => {
    onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  return (
    <View style={styles.wrap}>
      {fields.length === 0 ? (
        <Text style={styles.empty}>
          No fields yet. Fields are the labeled text on the front and back of the pass.
        </Text>
      ) : null}
      {fields.map((field, index) => (
        <View key={field.id} style={styles.field}>
          <Text style={styles.fieldTitle}>Field {index + 1}</Text>
          <ChipRow
            options={CATEGORY_OPTIONS}
            value={field.category}
            onChange={(category) => update(field.id, { category })}
          />
          <Input
            label="Label"
            value={field.label}
            onChangeText={(label) => update(field.id, { label })}
            placeholder="e.g. MEMBER"
          />
          <Input
            label="Value"
            value={field.value}
            onChangeText={(value) => update(field.id, { value })}
            placeholder="e.g. Jane Appleseed"
            autoCapitalize="sentences"
          />
          <Button
            title="Remove field"
            kind="danger"
            onPress={() => onChange(fields.filter((f) => f.id !== field.id))}
          />
        </View>
      ))}
      <Button title="Add field" kind="secondary" onPress={() => onChange([...fields, newField()])} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  empty: {
    color: colors.dim,
    fontSize: 13,
    lineHeight: 18,
  },
  field: {
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
  },
  fieldTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
});
