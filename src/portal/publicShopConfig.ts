import { callApi, type PublicShopConfig } from './api';
import { installGuestShopConfig } from './guest';

export async function loadGuestShopConfig(): Promise<PublicShopConfig> {
  const config = await callApi<PublicShopConfig>('getPublicShopConfig', null);
  installGuestShopConfig(config);
  return config;
}
