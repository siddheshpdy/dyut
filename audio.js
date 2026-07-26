const IS_PORTAL = import.meta.env.VITE_IS_PORTAL === 'true';
const MUTE_STORAGE_KEY = 'dyut_muted';
let latestPlatformMuteState;

export const isPlatformAudioMuted = () => (
    IS_PORTAL && (latestPlatformMuteState ?? window.CrazyGames?.SDK?.game?.settings?.muteAudio) === true
);

export const getUserMutePreference = () => localStorage.getItem(MUTE_STORAGE_KEY) === 'true';

export const getEffectiveMuteState = () => isPlatformAudioMuted() || getUserMutePreference();

export const dispatchMuteState = () => {
    window.dispatchEvent(new CustomEvent('dyut-mute-change', { detail: getEffectiveMuteState() }));
};

export const toggleUserMutePreference = () => {
    if (isPlatformAudioMuted()) {
        dispatchMuteState();
        return true;
    }

    const next = !getUserMutePreference();
    localStorage.setItem(MUTE_STORAGE_KEY, next);
    dispatchMuteState();
    return next;
};

export const bindCrazyGamesMuteSetting = async () => {
    if (!IS_PORTAL) return undefined;

    if (window.cgInitPromise) await window.cgInitPromise;
    if (!window.CrazyGames?.SDK?.game) return undefined;

    latestPlatformMuteState = window.CrazyGames.SDK.game.settings?.muteAudio === true;
    dispatchMuteState();

    if (typeof window.CrazyGames.SDK.game.addSettingsChangeListener !== 'function') {
        return undefined;
    }

    const listener = (newSettings) => {
        latestPlatformMuteState = typeof newSettings?.muteAudio === 'boolean'
            ? newSettings.muteAudio
            : window.CrazyGames.SDK.game.settings?.muteAudio === true;
        dispatchMuteState();
    };
    window.CrazyGames.SDK.game.addSettingsChangeListener(listener);

    return () => {
        try {
            window.CrazyGames.SDK.game.removeSettingsChangeListener?.(listener);
        } catch (error) {
            console.warn('Failed to remove CrazyGames settings listener:', error);
        }
    };
};

export const playSound = (soundFile) => {
    if (getEffectiveMuteState()) return null;

    const audio = new Audio(soundFile);
    audio.play().catch(error => {
        console.error("Error playing sound:", error);
        audio.dispatchEvent(new Event('error')); // Dispatch error so listeners know it failed
    });
    return audio;
};
