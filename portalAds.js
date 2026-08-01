export function canUseCrazyGamesAds({ isPortal, adsEnabled, sdk }) {
  return Boolean(isPortal && adsEnabled && sdk?.ad);
}

export function shouldRequestCrazyGamesBanners({ isPortal, adsEnabled, width, bannerSdk }) {
  return Boolean(isPortal && adsEnabled && width >= 1280 && bannerSdk?.requestBanner);
}

export function createCrazyGamesMidgameAdCallbacks({ wasMuted, restoreMute, dispatchMuteChange }) {
  const restoreAudio = () => {
    restoreMute(wasMuted);
    dispatchMuteChange();
  };

  return {
    adStarted: () => dispatchMuteChange(true),
    adFinished: restoreAudio,
    adError: restoreAudio
  };
}
