import * as Linking from 'expo-linking';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { FieldsEditor, type EditableField } from '@/components/FieldsEditor';
import { ImagesSection } from '@/components/ImagesSection';
import { Button, ChipRow, Input, Section } from '@/components/ui';
import { createPass } from '@/lib/api';
import { pickImageForSlot, type ProcessedImage } from '@/lib/images';
import { slotsForStyle, type ImageSlot } from '@/lib/slots';
import { colors } from '@/theme';
import type {
  BarcodeFormat,
  FieldCategory,
  PassField,
  PassSpec,
  PassStyle,
  TransitType,
} from '@/types';

const STYLE_OPTIONS: { value: PassStyle; label: string }[] = [
  { value: 'generic', label: 'Generic' },
  { value: 'storeCard', label: 'Store card' },
  { value: 'coupon', label: 'Coupon' },
  { value: 'eventTicket', label: 'Event ticket' },
  { value: 'boardingPass', label: 'Boarding pass' },
];

const BARCODE_OPTIONS: { value: 'none' | BarcodeFormat; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'PKBarcodeFormatQR', label: 'QR' },
  { value: 'PKBarcodeFormatPDF417', label: 'PDF417' },
  { value: 'PKBarcodeFormatAztec', label: 'Aztec' },
  { value: 'PKBarcodeFormatCode128', label: 'Code 128' },
];

const TRANSIT_OPTIONS: { value: TransitType; label: string }[] = [
  { value: 'PKTransitTypeGeneric', label: 'Generic' },
  { value: 'PKTransitTypeAir', label: 'Air' },
  { value: 'PKTransitTypeTrain', label: 'Train' },
  { value: 'PKTransitTypeBus', label: 'Bus' },
  { value: 'PKTransitTypeBoat', label: 'Boat' },
];

const HEX_COLOR = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

export default function PassDesigner() {
  const [style, setStyle] = useState<PassStyle>('storeCard');
  const [description, setDescription] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [logoText, setLogoText] = useState('');

  const [bgColor, setBgColor] = useState('#1d3557');
  const [fgColor, setFgColor] = useState('#ffffff');
  const [labelColor, setLabelColor] = useState('#a8dadc');

  const [fields, setFields] = useState<EditableField[]>([]);

  const [barcodeFormat, setBarcodeFormat] = useState<'none' | BarcodeFormat>(
    'PKBarcodeFormatQR'
  );
  const [barcodeMessage, setBarcodeMessage] = useState('');
  const [barcodeAltText, setBarcodeAltText] = useState('');

  const [transitType, setTransitType] = useState<TransitType>('PKTransitTypeGeneric');

  const [images, setImages] = useState<Partial<Record<string, ProcessedImage>>>({});
  const [busySlot, setBusySlot] = useState<string | null>(null);

  const [serverUrl, setServerUrl] = useState(
    process.env.EXPO_PUBLIC_PASS_SERVER_URL ?? ''
  );
  const [apiToken, setApiToken] = useState(
    process.env.EXPO_PUBLIC_PASS_API_TOKEN ?? ''
  );

  const [submitting, setSubmitting] = useState(false);

  const slots = useMemo(() => slotsForStyle(style), [style]);

  const previewBg = HEX_COLOR.test(bgColor) ? bgColor : '#1d3557';
  const previewFg = HEX_COLOR.test(fgColor) ? fgColor : '#ffffff';
  const previewLabel = HEX_COLOR.test(labelColor) ? labelColor : '#a8dadc';
  const previewPrimary = fields.find((f) => f.category === 'primary' && f.value);

  const handlePick = async (slot: ImageSlot) => {
    setBusySlot(slot.name);
    try {
      const picked = await pickImageForSlot(slot);
      if (picked) {
        setImages((current) => ({ ...current, [slot.name]: picked }));
      }
    } catch (err) {
      Alert.alert('Image error', err instanceof Error ? err.message : String(err));
    } finally {
      setBusySlot(null);
    }
  };

  const handleClear = (slot: ImageSlot) => {
    setImages((current) => {
      const next = { ...current };
      delete next[slot.name];
      return next;
    });
  };

  const handleSubmit = async () => {
    const url = serverUrl.trim();
    if (!url) {
      Alert.alert('Server URL required', 'Set the pass server URL at the bottom of the form.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Description required', 'Wallet requires a short description of the pass.');
      return;
    }
    if (!images.icon) {
      Alert.alert('Icon required', 'Pick an icon image — Wallet rejects passes without one.');
      return;
    }
    for (const [name, value] of [
      ['Background', bgColor],
      ['Foreground', fgColor],
      ['Label', labelColor],
    ] as const) {
      if (!HEX_COLOR.test(value.trim())) {
        Alert.alert('Invalid color', `${name} color must be a hex value like #1d3557.`);
        return;
      }
    }
    if (barcodeFormat !== 'none' && !barcodeMessage.trim()) {
      Alert.alert('Barcode message required', 'Enter the text to encode, or set barcode to None.');
      return;
    }

    const specFields: Partial<Record<FieldCategory, PassField[]>> = {};
    for (const field of fields) {
      if (!field.value.trim()) continue;
      const list = (specFields[field.category] ??= []);
      list.push({
        key: `${field.category}-${list.length + 1}`,
        ...(field.label.trim() ? { label: field.label.trim() } : {}),
        value: field.value.trim(),
      });
    }

    const specImages: Record<string, string> = {};
    for (const slot of slots) {
      const picked = images[slot.name];
      if (picked) Object.assign(specImages, picked.files);
    }

    const spec: PassSpec = {
      style,
      description: description.trim(),
      ...(organizationName.trim() ? { organizationName: organizationName.trim() } : {}),
      ...(logoText.trim() ? { logoText: logoText.trim() } : {}),
      colors: {
        backgroundColor: bgColor.trim(),
        foregroundColor: fgColor.trim(),
        labelColor: labelColor.trim(),
      },
      ...(Object.keys(specFields).length > 0 ? { fields: specFields } : {}),
      ...(barcodeFormat !== 'none'
        ? {
            barcode: {
              format: barcodeFormat,
              message: barcodeMessage.trim(),
              ...(barcodeAltText.trim() ? { altText: barcodeAltText.trim() } : {}),
            },
          }
        : {}),
      ...(style === 'boardingPass' ? { transitType } : {}),
      images: specImages,
    };

    setSubmitting(true);
    try {
      const created = await createPass(url, spec, apiToken.trim() || undefined);
      // Safari fetches the URL, sees application/vnd.apple.pkpass, and hands
      // it to Wallet, which shows the add sheet.
      await Linking.openURL(created.url);
    } catch (err) {
      Alert.alert('Could not create pass', err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.preview, { backgroundColor: previewBg }]}>
          <Text style={[styles.previewLogo, { color: previewFg }]}>
            {logoText || organizationName || 'Your pass'}
          </Text>
          {previewPrimary ? (
            <View>
              {previewPrimary.label ? (
                <Text style={[styles.previewLabel, { color: previewLabel }]}>
                  {previewPrimary.label.toUpperCase()}
                </Text>
              ) : null}
              <Text style={[styles.previewValue, { color: previewFg }]}>
                {previewPrimary.value}
              </Text>
            </View>
          ) : (
            <Text style={[styles.previewLabel, { color: previewLabel }]}>
              {description || 'Design below, then create'}
            </Text>
          )}
        </View>

        <Section title="Style">
          <ChipRow options={STYLE_OPTIONS} value={style} onChange={setStyle} />
          {style === 'boardingPass' ? (
            <>
              <Text style={styles.hint}>Transit type</Text>
              <ChipRow options={TRANSIT_OPTIONS} value={transitType} onChange={setTransitType} />
            </>
          ) : null}
        </Section>

        <Section title="Basics">
          <Input
            label="Description (required)"
            value={description}
            onChangeText={setDescription}
            placeholder="e.g. Coffee punch card"
            autoCapitalize="sentences"
          />
          <Input
            label="Organization name"
            value={organizationName}
            onChangeText={setOrganizationName}
            placeholder="Shown when the pass is on the lock screen"
            autoCapitalize="words"
          />
          <Input
            label="Logo text"
            value={logoText}
            onChangeText={setLogoText}
            placeholder="Text next to the logo image"
            autoCapitalize="words"
          />
        </Section>

        <Section title="Colors">
          <Input label="Background" value={bgColor} onChangeText={setBgColor} placeholder="#1d3557" />
          <Input label="Foreground (text)" value={fgColor} onChangeText={setFgColor} placeholder="#ffffff" />
          <Input label="Labels" value={labelColor} onChangeText={setLabelColor} placeholder="#a8dadc" />
        </Section>

        <Section title="Fields">
          <FieldsEditor fields={fields} onChange={setFields} />
        </Section>

        <Section title="Barcode">
          <ChipRow options={BARCODE_OPTIONS} value={barcodeFormat} onChange={setBarcodeFormat} />
          {barcodeFormat !== 'none' ? (
            <>
              <Input
                label="Message (what the barcode encodes)"
                value={barcodeMessage}
                onChangeText={setBarcodeMessage}
                placeholder="e.g. MEMBER-12345"
              />
              <Input
                label="Alt text (shown under the barcode)"
                value={barcodeAltText}
                onChangeText={setBarcodeAltText}
                placeholder="Optional"
              />
            </>
          ) : null}
        </Section>

        <Section title="Images">
          <ImagesSection
            slots={slots}
            images={images}
            busySlot={busySlot}
            onPick={handlePick}
            onClear={handleClear}
          />
        </Section>

        <Section title="Server">
          <Input
            label="Pass server URL"
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder="https://your-app.up.railway.app"
            keyboardType="url"
          />
          <Input
            label="API token (only if the server sets one)"
            value={apiToken}
            onChangeText={setApiToken}
            placeholder="Optional"
            secureTextEntry
          />
        </Section>

        <Button
          title="Create pass & add to Wallet"
          onPress={handleSubmit}
          loading={submitting}
        />
        <View style={styles.footer} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  preview: {
    borderRadius: 14,
    padding: 18,
    marginBottom: 24,
    gap: 14,
    minHeight: 110,
  },
  previewLogo: {
    fontSize: 16,
    fontWeight: '600',
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  previewValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  hint: {
    color: colors.dim,
    fontSize: 13,
  },
  footer: {
    height: 40,
  },
});
