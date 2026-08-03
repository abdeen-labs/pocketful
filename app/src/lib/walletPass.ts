import { requireNativeModule } from 'expo-modules-core';

interface WalletPassModule {
  present(url: string): Promise<void>;
}

const WalletPass = requireNativeModule<WalletPassModule>('ExpoWalletPass');

export async function presentWalletPass(url: string): Promise<void> {
  await WalletPass.present(url);
}
