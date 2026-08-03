import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import type { ImageSlot } from '@/lib/slots';

export interface ProcessedImage {
  /** Local file URI of the largest rendition, for previews. */
  previewUri: string;
  /** e.g. { icon: <b64>, "icon@2x": <b64>, "icon@3x": <b64> } */
  files: Record<string, string>;
}

/**
 * Pick an image from the photo library, center-crop it to the slot's aspect
 * ratio, and export PNG renditions at 1x/2x/3x of the slot's point size —
 * exactly what Wallet expects to find in the .pkpass.
 *
 * Returns null if the user cancels the picker.
 */
export async function pickImageForSlot(slot: ImageSlot): Promise<ProcessedImage | null> {
  // No permission request needed: launchImageLibraryAsync uses the system
  // photo picker, which runs out-of-process and only returns what's selected.
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
  });
  if (result.canceled) return null;

  const asset = result.assets[0];
  const crop = centeredCrop(asset.width, asset.height, slot.width / slot.height);

  const files: Record<string, string> = {};
  let previewUri = asset.uri;

  for (const scale of [1, 2, 3] as const) {
    const context = ImageManipulator.manipulate(asset.uri);
    if (crop) context.crop(crop);
    context.resize({ width: slot.width * scale, height: slot.height * scale });
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ format: SaveFormat.PNG, base64: true });
    if (!saved.base64) throw new Error('Image conversion returned no data.');
    // Some platforms return a data URI; the server wants bare base64.
    files[scale === 1 ? slot.name : `${slot.name}@${scale}x`] = saved.base64.replace(
      /^data:.*?;base64,/,
      ''
    );
    if (scale === 3) previewUri = saved.uri;
  }

  return { previewUri, files };
}

function centeredCrop(
  srcWidth: number | undefined,
  srcHeight: number | undefined,
  targetAspect: number
): { originX: number; originY: number; width: number; height: number } | null {
  if (!srcWidth || !srcHeight) return null;
  const srcAspect = srcWidth / srcHeight;
  let width: number;
  let height: number;
  if (srcAspect > targetAspect) {
    height = srcHeight;
    width = Math.round(height * targetAspect);
  } else {
    width = srcWidth;
    height = Math.round(width / targetAspect);
  }
  return {
    originX: Math.round((srcWidth - width) / 2),
    originY: Math.round((srcHeight - height) / 2),
    width,
    height,
  };
}
