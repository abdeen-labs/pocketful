import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { colors, radii } from '@/theme';

export function Section({
  title,
  description,
  badge,
  collapsible = false,
  collapsed,
  defaultCollapsed = false,
  onCollapsedChange,
  children,
}: {
  title: string;
  description?: string;
  badge?: string;
  collapsible?: boolean;
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  children: React.ReactNode;
}) {
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const isCollapsed = collapsed ?? internalCollapsed;
  const toggleCollapsed = () => {
    if (!collapsible) return;
    const next = !isCollapsed;
    setInternalCollapsed(next);
    onCollapsedChange?.(next);
  };

  const heading = (
    <>
      <View style={styles.sectionHeadingCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
      </View>
      <View style={styles.sectionHeadingActions}>
        {badge ? <Badge text={badge} /> : null}
        {collapsible ? (
          <View style={styles.sectionCollapseButton}>
            <Text style={styles.sectionCollapseIcon}>{isCollapsed ? '+' : '−'}</Text>
          </View>
        ) : null}
      </View>
    </>
  );

  return (
    <View style={styles.section}>
      {collapsible ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: !isCollapsed }}
          accessibilityLabel={`${isCollapsed ? 'Expand' : 'Collapse'} ${title}`}
          onPress={toggleCollapsed}
          style={({ pressed }) => [styles.sectionHeading, styles.sectionHeadingPressable, pressed && styles.pressed]}
        >
          {heading}
        </Pressable>
      ) : (
        <View style={styles.sectionHeading}>{heading}</View>
      )}
      {!isCollapsed ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

export function Disclosure({
  title,
  description,
  defaultOpen = false,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={styles.disclosure}>
      <Pressable onPress={() => setOpen((value) => !value)} style={styles.disclosureHeader}>
        <View style={styles.disclosureCopy}>
          <Text style={styles.disclosureTitle}>{title}</Text>
          {description ? <Text style={styles.disclosureDescription}>{description}</Text> : null}
        </View>
        <Text style={styles.disclosureChevron}>{open ? '−' : '+'}</Text>
      </Pressable>
      {open ? <View style={styles.disclosureBody}>{children}</View> : null}
    </View>
  );
}

export function Input({
  label,
  helper,
  ...props
}: TextInputProps & { label?: string; helper?: string }) {
  return (
    <View style={styles.inputWrap}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.dim}
        autoCapitalize="none"
        autoCorrect={false}
        {...props}
        style={[styles.input, props.multiline && styles.inputMultiline, props.style]}
      />
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

export function ChipRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.chip,
              selected && styles.chipSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function MultiChipRow<T extends string>({
  options,
  values,
  onChange,
}: {
  options: { value: T; label: string }[];
  values: T[];
  onChange: (values: T[]) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((option) => {
        const selected = values.includes(option.value);
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(selected ? values.filter((value) => value !== option.value) : [...values, option.value])}
            style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Pressable onPress={() => onChange(!value)} style={styles.toggleRow}>
      <View style={styles.toggleCopy}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {description ? <Text style={styles.toggleDescription}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.borderStrong, true: colors.accentMuted }}
        thumbColor={value ? colors.accent : colors.textSoft}
      />
    </Pressable>
  );
}

export function Notice({
  title,
  children,
  tone = 'info',
}: {
  title?: string;
  children: React.ReactNode;
  tone?: 'info' | 'warning';
}) {
  return (
    <View style={[styles.notice, tone === 'warning' && styles.noticeWarning]}>
      {title ? <Text style={styles.noticeTitle}>{title}</Text> : null}
      <Text style={styles.noticeText}>{children}</Text>
    </View>
  );
}

export function Badge({ text }: { text: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{text}</Text>
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled,
  loading,
  compact = false,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        kind === 'primary' && styles.buttonPrimary,
        kind === 'secondary' && styles.buttonSecondary,
        kind === 'danger' && styles.buttonDanger,
        kind === 'ghost' && styles.buttonGhost,
        (disabled || loading) && styles.buttonDisabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={kind === 'primary' ? colors.accentText : colors.text} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            kind === 'primary' && styles.buttonTextPrimary,
            kind === 'danger' && styles.buttonTextDanger,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 28, gap: 12 },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 2 },
  sectionHeadingPressable: { marginHorizontal: -8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: radii.medium },
  sectionHeadingCopy: { flex: 1, gap: 3 },
  sectionHeadingActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionCollapseButton: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong },
  sectionCollapseIcon: { color: colors.textSoft, fontSize: 20, lineHeight: 22, fontWeight: '400' },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '700', letterSpacing: -0.25 },
  sectionDescription: { color: colors.dim, fontSize: 13, lineHeight: 18 },
  sectionBody: {
    backgroundColor: colors.card,
    borderRadius: radii.large,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 16,
    gap: 14,
  },
  disclosure: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: radii.medium, overflow: 'hidden' },
  disclosureHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: colors.surface },
  disclosureCopy: { flex: 1, gap: 2 },
  disclosureTitle: { color: colors.textSoft, fontSize: 14, fontWeight: '600' },
  disclosureDescription: { color: colors.dim, fontSize: 12, lineHeight: 16 },
  disclosureChevron: { color: colors.accent, fontSize: 22, fontWeight: '400' },
  disclosureBody: { padding: 14, gap: 13, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  inputWrap: { gap: 7 },
  inputLabel: { color: colors.textSoft, fontSize: 13, fontWeight: '500' },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.small,
    paddingHorizontal: 13,
    paddingVertical: 11,
    color: colors.text,
    fontSize: 15,
  },
  inputMultiline: { minHeight: 104, textAlignVertical: 'top' },
  helper: { color: colors.dim, fontSize: 11, lineHeight: 15 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipSelected: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  chipText: { color: colors.dim, fontSize: 13, fontWeight: '600' },
  chipTextSelected: { color: colors.text },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  toggleCopy: { flex: 1, gap: 2 },
  toggleLabel: { color: colors.textSoft, fontSize: 14, fontWeight: '600' },
  toggleDescription: { color: colors.dim, fontSize: 12, lineHeight: 16 },
  notice: { backgroundColor: colors.accentMuted, borderRadius: radii.small, padding: 12, gap: 3 },
  noticeWarning: { backgroundColor: '#3a2d1a' },
  noticeTitle: { color: colors.text, fontSize: 13, fontWeight: '700' },
  noticeText: { color: colors.textSoft, fontSize: 12, lineHeight: 17 },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radii.pill, backgroundColor: colors.accentMuted },
  badgeText: { color: colors.accent, fontSize: 11, fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  button: { borderRadius: radii.medium, paddingVertical: 14, paddingHorizontal: 17, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  buttonCompact: { minHeight: 38, paddingVertical: 8, paddingHorizontal: 12 },
  buttonPrimary: { backgroundColor: colors.accent },
  buttonSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong },
  buttonDanger: { backgroundColor: colors.dangerMuted, borderWidth: 1, borderColor: colors.danger },
  buttonGhost: { backgroundColor: 'transparent' },
  buttonDisabled: { opacity: 0.45 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  buttonText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  buttonTextPrimary: { color: colors.accentText },
  buttonTextDanger: { color: colors.danger },
});
