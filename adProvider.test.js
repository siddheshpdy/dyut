import { afterEach, describe, expect, it, vi } from 'vitest';
import { AD_PROVIDERS, resolveAdProvider } from './adProvider';

afterEach(() => {
  vi.unstubAllEnvs();
  delete window.CrazyGames;
  delete window.adBreak;
  delete window.adConfig;
  document.querySelectorAll('script[data-dyut-google-ads]').forEach((script) => script.remove());
});

describe('ad provider selection', () => {
  it('uses CrazyGames automatically for portal builds', () => {
    expect(resolveAdProvider({ provider: 'auto', isPortal: true })).toBe(AD_PROVIDERS.CRAZYGAMES);
  });

  it('uses Google automatically for standalone builds', () => {
    expect(resolveAdProvider({ provider: 'auto', isPortal: false })).toBe(AD_PROVIDERS.GOOGLE);
  });

  it('allows an explicit provider override', () => {
    expect(resolveAdProvider({ provider: 'crazygames', isPortal: false })).toBe(AD_PROVIDERS.CRAZYGAMES);
    expect(resolveAdProvider({ provider: 'google', isPortal: true })).toBe(AD_PROVIDERS.CRAZYGAMES);
    expect(resolveAdProvider({ provider: 'none', isPortal: false })).toBe(AD_PROVIDERS.NONE);
  });

  it('routes rewarded ads through the CrazyGames SDK provider', async () => {
    vi.stubEnv('VITE_CG_ENABLE_ADS', 'true');
    vi.stubEnv('VITE_ADS_PROVIDER', 'crazygames');
    vi.stubEnv('VITE_CRAZYGAMES_BUILD', 'true');
    vi.resetModules();
    const { requestRewardedAd } = await import('./adProvider');
    const adStarted = vi.fn();
    const adFinished = vi.fn();
    let callbacks;
    window.CrazyGames = { SDK: { ad: { requestAd: vi.fn((_placement, nextCallbacks) => { callbacks = nextCallbacks; }) } } };

    const resultPromise = requestRewardedAd({ adStarted, adFinished });
    expect(window.CrazyGames.SDK.ad.requestAd).toHaveBeenCalledWith('rewarded', expect.any(Object));
    callbacks.adStarted();
    callbacks.adFinished();

    await expect(resultPromise).resolves.toMatchObject({ provider: AD_PROVIDERS.CRAZYGAMES });
    expect(adStarted).toHaveBeenCalledOnce();
    expect(adFinished).toHaveBeenCalledOnce();
  });

  it('routes rewarded ads through the Google H5 Games Ads provider', async () => {
    vi.stubEnv('VITE_CG_ENABLE_ADS', 'true');
    vi.stubEnv('VITE_ADS_PROVIDER', 'google');
    vi.stubEnv('VITE_CRAZYGAMES_BUILD', 'false');
    vi.resetModules();
    const { requestRewardedAd } = await import('./adProvider');
    const adStarted = vi.fn();
    const adFinished = vi.fn();
    window.adBreak = vi.fn((options) => {
      options.beforeReward(() => {
        options.beforeAd();
        options.adViewed();
        options.afterAd();
        options.adBreakDone({});
      });
    });

    await expect(requestRewardedAd({ adStarted, adFinished })).resolves.toMatchObject({ provider: AD_PROVIDERS.GOOGLE });
    expect(adStarted).toHaveBeenCalledOnce();
    expect(adFinished).toHaveBeenCalledOnce();
    expect(window.adBreak).toHaveBeenCalledWith(expect.objectContaining({ type: 'reward', name: 'dyut_reward_multiplier' }));
  });
});
