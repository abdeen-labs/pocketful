import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';

import type { ProcessedImage } from '@/lib/images';

type AssetModule = number;

interface BundledSlot {
  preview: AssetModule;
  files: Record<string, AssetModule>;
}

type BundledTemplate = Record<string, BundledSlot>;

const BUNDLED_TEMPLATES: Record<string, BundledTemplate> = {
  'midnight-live': {
    icon: {
      preview: require('../../assets/templates/midnight-live/icon-3x.png'),
      files: {
        icon: require('../../assets/templates/midnight-live/icon-1x.png'),
        'icon@2x': require('../../assets/templates/midnight-live/icon-2x.png'),
        'icon@3x': require('../../assets/templates/midnight-live/icon-3x.png'),
      },
    },
    primaryLogo: {
      preview: require('../../assets/templates/midnight-live/primary-logo-3x.png'),
      files: {
        primaryLogo: require('../../assets/templates/midnight-live/primary-logo-1x.png'),
        'primaryLogo@2x': require('../../assets/templates/midnight-live/primary-logo-2x.png'),
        'primaryLogo@3x': require('../../assets/templates/midnight-live/primary-logo-3x.png'),
      },
    },
    secondaryLogo: {
      preview: require('../../assets/templates/midnight-live/secondary-logo-3x.png'),
      files: {
        secondaryLogo: require('../../assets/templates/midnight-live/secondary-logo-1x.png'),
        'secondaryLogo@2x': require('../../assets/templates/midnight-live/secondary-logo-2x.png'),
        'secondaryLogo@3x': require('../../assets/templates/midnight-live/secondary-logo-3x.png'),
      },
    },
    artwork: {
      preview: require('../../assets/templates/midnight-live/artwork-3x.png'),
      files: {
        artwork: require('../../assets/templates/midnight-live/artwork-1x.png'),
        'artwork@2x': require('../../assets/templates/midnight-live/artwork-2x.png'),
        'artwork@3x': require('../../assets/templates/midnight-live/artwork-3x.png'),
      },
    },
  },
  'harbor-fc': {
    icon: {
      preview: require('../../assets/templates/harbor-fc/icon-3x.png'),
      files: {
        icon: require('../../assets/templates/harbor-fc/icon-1x.png'),
        'icon@2x': require('../../assets/templates/harbor-fc/icon-2x.png'),
        'icon@3x': require('../../assets/templates/harbor-fc/icon-3x.png'),
      },
    },
    primaryLogo: {
      preview: require('../../assets/templates/harbor-fc/primary-logo-3x.png'),
      files: {
        primaryLogo: require('../../assets/templates/harbor-fc/primary-logo-1x.png'),
        'primaryLogo@2x': require('../../assets/templates/harbor-fc/primary-logo-2x.png'),
        'primaryLogo@3x': require('../../assets/templates/harbor-fc/primary-logo-3x.png'),
      },
    },
    secondaryLogo: {
      preview: require('../../assets/templates/harbor-fc/secondary-logo-3x.png'),
      files: {
        secondaryLogo: require('../../assets/templates/harbor-fc/secondary-logo-1x.png'),
        'secondaryLogo@2x': require('../../assets/templates/harbor-fc/secondary-logo-2x.png'),
        'secondaryLogo@3x': require('../../assets/templates/harbor-fc/secondary-logo-3x.png'),
      },
    },
    artwork: {
      preview: require('../../assets/templates/harbor-fc/artwork-3x.png'),
      files: {
        artwork: require('../../assets/templates/harbor-fc/artwork-1x.png'),
        'artwork@2x': require('../../assets/templates/harbor-fc/artwork-2x.png'),
        'artwork@3x': require('../../assets/templates/harbor-fc/artwork-3x.png'),
      },
    },
  },
};

const cache = new Map<string, Promise<Partial<Record<string, ProcessedImage>>>>();

export function loadBundledTemplateImages(
  templateId: string
): Promise<Partial<Record<string, ProcessedImage>>> {
  const bundled = BUNDLED_TEMPLATES[templateId];
  if (!bundled) return Promise.resolve({});

  const cached = cache.get(templateId);
  if (cached) return cached;

  const pending = loadTemplate(bundled);
  cache.set(templateId, pending);
  return pending;
}

async function loadTemplate(
  bundled: BundledTemplate
): Promise<Partial<Record<string, ProcessedImage>>> {
  const entries = await Promise.all(
    Object.entries(bundled).map(async ([slotName, slot]) => {
      const fileEntries = await Promise.all(
        Object.entries(slot.files).map(async ([filename, source]) => [
          filename,
          await readAssetBase64(source),
        ] as const)
      );
      const preview = await Asset.fromModule(slot.preview).downloadAsync();
      const previewUri = preview.localUri ?? preview.uri;
      if (!previewUri) throw new Error(`Bundled ${slotName} artwork could not be loaded.`);

      return [slotName, { previewUri, files: Object.fromEntries(fileEntries) }] as const;
    })
  );

  return Object.fromEntries(entries);
}

async function readAssetBase64(source: AssetModule): Promise<string> {
  const asset = await Asset.fromModule(source).downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (!uri) throw new Error('A bundled template image could not be loaded.');
  return new File(uri).base64();
}
