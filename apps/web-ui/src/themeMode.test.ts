import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { themeOverrideStorageKey, useAppThemeMode } from './themeMode';

describe('useAppThemeMode document attributes', () => {
  afterEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.zcTheme;
    delete document.documentElement.dataset.zcThemeMode;
  });

  it('writes the civil day attribute while preserving zc theme attributes', async () => {
    window.localStorage.setItem(themeOverrideStorageKey, 'day');

    const { unmount } = renderHook(() => useAppThemeMode());

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('dia');
      expect(document.documentElement.dataset.zcTheme).toBe('light');
      expect(document.documentElement.dataset.zcThemeMode).toBe('day');
    });

    unmount();

    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(document.documentElement.dataset.zcTheme).toBeUndefined();
    expect(document.documentElement.dataset.zcThemeMode).toBeUndefined();
  });

  it('writes the civil night attribute while preserving zc theme attributes', async () => {
    window.localStorage.setItem(themeOverrideStorageKey, 'night');

    const { unmount } = renderHook(() => useAppThemeMode());

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('noche');
      expect(document.documentElement.dataset.zcTheme).toBe('dark');
      expect(document.documentElement.dataset.zcThemeMode).toBe('night');
    });

    unmount();

    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(document.documentElement.dataset.zcTheme).toBeUndefined();
    expect(document.documentElement.dataset.zcThemeMode).toBeUndefined();
  });
});
