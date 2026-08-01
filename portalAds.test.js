import { describe, expect, it, vi } from 'vitest';
import { canUseCrazyGamesAds, createCrazyGamesMidgameAdCallbacks, shouldRequestCrazyGamesBanners } from './portalAds.js';

describe('CrazyGames ad capability', () => {
  it('keeps Basic Launch ad-free', () => {
    expect(canUseCrazyGamesAds({ isPortal: true, adsEnabled: false, sdk: { ad: {} } })).toBe(false);
    expect(shouldRequestCrazyGamesBanners({ isPortal: true, adsEnabled: false, width: 1920, bannerSdk: { requestBanner() {} } })).toBe(false);
  });

  it('only permits banners on large portal screens with SDK support', () => {
    expect(shouldRequestCrazyGamesBanners({ isPortal: true, adsEnabled: true, width: 1279, bannerSdk: { requestBanner() {} } })).toBe(false);
    expect(shouldRequestCrazyGamesBanners({ isPortal: true, adsEnabled: true, width: 1280, bannerSdk: { requestBanner() {} } })).toBe(true);
  });
});

describe('CrazyGames midgame ad audio', () => {
  it('mutes during an ad and restores the previous state after completion or error', () => {
    const restoreMute = vi.fn();
    const dispatchMuteChange = vi.fn();
    const callbacks = createCrazyGamesMidgameAdCallbacks({ wasMuted: false, restoreMute, dispatchMuteChange });

    callbacks.adStarted();
    callbacks.adFinished();
    callbacks.adError();

    expect(dispatchMuteChange).toHaveBeenNthCalledWith(1, true);
    expect(restoreMute).toHaveBeenCalledTimes(2);
    expect(restoreMute).toHaveBeenCalledWith(false);
    expect(dispatchMuteChange).toHaveBeenCalledTimes(3);
  });
});
