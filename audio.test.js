import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const loadPortalAudio = async () => {
  vi.resetModules();
  vi.stubEnv('VITE_CRAZYGAMES_BUILD', 'true');
  return import('./audio');
};

describe('CrazyGames audio settings', () => {
  beforeEach(() => {
    localStorage.clear();
    delete window.CrazyGames;
    delete window.cgInitPromise;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('uses settings-change payloads to keep platform audio muted', async () => {
    let settingsListener;
    const addSettingsChangeListener = vi.fn((listener) => {
      settingsListener = listener;
    });
    const removeSettingsChangeListener = vi.fn();

    window.CrazyGames = {
      SDK: {
        game: {
          settings: { muteAudio: false },
          addSettingsChangeListener,
          removeSettingsChangeListener,
        },
      },
    };

    const audio = await loadPortalAudio();
    const cleanup = await audio.bindCrazyGamesMuteSetting();

    expect(audio.getEffectiveMuteState()).toBe(false);
    expect(addSettingsChangeListener).toHaveBeenCalledOnce();

    settingsListener({ muteAudio: true });
    expect(audio.getEffectiveMuteState()).toBe(true);
    expect(audio.toggleUserMutePreference()).toBe(true);
    expect(localStorage.getItem('dyut_muted')).toBeNull();

    settingsListener({ muteAudio: false });
    expect(audio.getEffectiveMuteState()).toBe(false);

    window.CrazyGames.SDK.game.settings.muteAudio = true;
    settingsListener();
    expect(audio.getEffectiveMuteState()).toBe(true);

    cleanup();
    expect(removeSettingsChangeListener).toHaveBeenCalledWith(settingsListener);
  });
});
