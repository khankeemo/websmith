import { SmsConfig, SmsProvider } from './types';
import { Fast2SmsProvider } from './fast2sms';

const providers: Map<string, SmsProvider> = new Map();

function registerProvider(provider: SmsProvider) {
  providers.set(provider.name, provider);
}

registerProvider(new Fast2SmsProvider());

export function getSmsProvider(name: string): SmsProvider | undefined {
  return providers.get(name);
}

export function getRegisteredProviders(): string[] {
  return Array.from(providers.keys());
}

export type { SmsConfig, SmsProvider };
