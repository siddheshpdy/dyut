const GOOGLE_ADS_CLIENT_ID = 'ca-pub-8676646466866124';
const configuredProvider = String(import.meta.env.VITE_ADS_PROVIDER || 'auto').trim().toLowerCase();
const isCrazyGamesBuild = import.meta.env.VITE_CRAZYGAMES_BUILD === 'true';
const adsEnabled = import.meta.env.VITE_CG_ENABLE_ADS === 'true';
const googleAdsClientId = String(import.meta.env.VITE_GOOGLE_ADS_CLIENT_ID || GOOGLE_ADS_CLIENT_ID).trim();
const isLocalEconomyQa = () => import.meta.env.DEV
  && typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('qa')?.startsWith('economy');

export const AD_PROVIDERS = Object.freeze({
  AUTO: 'auto',
  CRAZYGAMES: 'crazygames',
  GOOGLE: 'google',
  NONE: 'none',
});

export const resolveAdProvider = ({ provider = configuredProvider, isPortal = isCrazyGamesBuild } = {}) => {
  const normalized = String(provider || AD_PROVIDERS.AUTO).trim().toLowerCase();

  if (normalized === AD_PROVIDERS.NONE) return AD_PROVIDERS.NONE;
  if (isPortal) return AD_PROVIDERS.CRAZYGAMES;
  if (normalized === AD_PROVIDERS.CRAZYGAMES) return AD_PROVIDERS.CRAZYGAMES;
  if (normalized === AD_PROVIDERS.GOOGLE) return AD_PROVIDERS.GOOGLE;

  return isPortal ? AD_PROVIDERS.CRAZYGAMES : AD_PROVIDERS.GOOGLE;
};

export const getAdProvider = () => resolveAdProvider();

export const getAdsConfig = () => ({
  enabled: (() => {
    const provider = getAdProvider();
    if (!adsEnabled || provider === AD_PROVIDERS.NONE) return false;
    if (provider !== AD_PROVIDERS.GOOGLE) return true;
    return googleAdsClientId.startsWith('ca-pub-')
      || (typeof window !== 'undefined' && typeof window.adBreak === 'function')
      || isLocalEconomyQa();
  })(),
  provider: getAdProvider(),
});

export const isRewardedAdsEnabled = () => getAdsConfig().enabled;

const withCrazyGamesSdk = async (callback) => {
  if (window.cgInitPromise) await window.cgInitPromise;
  if (!window.CrazyGames?.SDK?.ad?.requestAd) {
    throw new Error('CrazyGames rewarded ads are unavailable');
  }
  return callback(window.CrazyGames.SDK.ad);
};

const requestCrazyGamesAd = (placement, callbacks = {}) => withCrazyGamesSdk((ad) => new Promise((resolve, reject) => {
  ad.requestAd(placement, {
    adStarted: () => callbacks.adStarted?.(),
    adFinished: () => {
      callbacks.adFinished?.();
      resolve({ shown: true, provider: AD_PROVIDERS.CRAZYGAMES });
    },
    adError: (error) => {
      callbacks.adError?.(error);
      reject(error || new Error('CrazyGames ad failed'));
    },
  });
}));

const requestGoogleRewardedAd = (callbacks = {}) => new Promise((resolve, reject) => {
  let settled = false;
  let viewed = false;
  const fail = (error) => {
    if (settled) return;
    settled = true;
    callbacks.adError?.(error);
    reject(error || new Error('Google rewarded ad was not completed'));
  };

  const requestPlacement = () => {
    if (typeof window.adBreak !== 'function') {
      fail(new Error('Google H5 Games Ads are unavailable'));
      return;
    }

    window.adBreak({
      type: 'reward',
      name: 'dyut_reward_multiplier',
      beforeAd: () => callbacks.adStarted?.(),
      afterAd: () => callbacks.adFinished?.(),
      beforeReward: (showAd) => showAd(),
      adDismissed: () => fail(new Error('Google rewarded ad was dismissed')),
      adViewed: () => {
        viewed = true;
        if (!settled) {
          settled = true;
          resolve({ shown: true, provider: AD_PROVIDERS.GOOGLE });
        }
      },
      adBreakDone: () => {
        if (!viewed) fail(new Error('Google rewarded ad was unavailable'));
      },
    });
  };

  try {
    if (typeof window.adBreak === 'function') {
      requestPlacement();
      return;
    }
    if (!googleAdsClientId.startsWith('ca-pub-')) {
      fail(new Error('Google H5 Games Ads are unavailable'));
      return;
    }

    const existingScript = document.querySelector('script[data-dyut-google-ads]');
    if (existingScript) {
      existingScript.addEventListener('load', requestPlacement, { once: true });
      existingScript.addEventListener('error', () => fail(new Error('Google H5 Games Ads failed to load')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.dataset.dyutGoogleAds = 'true';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(googleAdsClientId)}`;
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adBreak = window.adConfig = (options) => window.adsbygoogle.push(options);
      requestPlacement();
    };
    script.onerror = () => fail(new Error('Google H5 Games Ads failed to load'));
    document.head.appendChild(script);
  } catch (error) {
    fail(error);
  }
});

export const requestRewardedAd = (callbacks = {}) => {
  const config = getAdsConfig();
  if (!config.enabled) return Promise.reject(new Error('Rewarded ads are disabled'));

  if (isLocalEconomyQa() && config.provider === AD_PROVIDERS.GOOGLE && typeof window.adBreak !== 'function') {
    return Promise.resolve({ shown: false, simulated: true, provider: AD_PROVIDERS.GOOGLE });
  }

  if (config.provider === AD_PROVIDERS.CRAZYGAMES) {
    return requestCrazyGamesAd('rewarded', callbacks);
  }

  if (config.provider === AD_PROVIDERS.GOOGLE) {
    return requestGoogleRewardedAd(callbacks);
  }

  return Promise.reject(new Error('No rewarded ad provider is configured'));
};
