export type ChapaMode = 'live' | 'test';

export function isChapaMode(value: unknown): value is ChapaMode {
  return value === 'test' || value === 'live';
}

export function chapaConfiguration(get: (name: string) => string | undefined) {
  const configured = get('CHAPA_MODE')?.trim();
  const defaultMode = isChapaMode(configured) ? configured : 'test';
  const legacy = isChapaMode(configured) ? get('CHAPA_SECRET_KEY')?.trim() : undefined;
  const keys: Partial<Record<ChapaMode, string>> = {};
  for (const mode of ['live', 'test'] as const) {
    const dedicated = get(mode === 'live' ? 'CHAPA_LIVE_SECRET_KEY' : 'CHAPA_TEST_SECRET_KEY')?.trim();
    const key = dedicated || (mode === defaultMode ? legacy : undefined);
    const pattern = mode === 'live' ? /^CHASECK-[A-Za-z0-9_-]+$/ : /^CHASECK_TEST-[A-Za-z0-9_-]+$/;
    if (key && pattern.test(key)) keys[mode] = key;
  }
  return { defaultMode, keys, availableModes: (['live', 'test'] as const).filter((mode) => Boolean(keys[mode])) };
}
