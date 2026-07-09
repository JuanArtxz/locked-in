import { useCallback, useEffect, useState } from 'react';
import * as db from '../lib/db';
import type { Settings } from '../types';

export interface UseSettings {
  settings: Settings | null;
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
}

export function useSettings(onError: (message: string) => void): UseSettings {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    db.getAllSettings()
      .then(setSettings)
      .catch((err) => onError(String(err)));
  }, [onError]);

  const update = useCallback(
    async <K extends keyof Settings>(key: K, value: Settings[K]) => {
      const previous = settings;
      setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
      try {
        await db.setSetting(key, value);
      } catch (err) {
        setSettings(previous ?? null);
        onError(String(err));
      }
    },
    [settings, onError],
  );

  return { settings, update };
}
