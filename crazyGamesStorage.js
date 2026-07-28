import { parseCrazyGamesStoredValue } from './crazyGamesData';

const IS_PORTAL = import.meta.env.VITE_CRAZYGAMES_BUILD === 'true';
const OFFLINE_RESUME_DATA_KEY = 'dyut_offline_resume';
const LOCAL_GAME_STATE_KEY = 'dyut_game_state';
const LOCAL_PLAYER_COUNT_KEY = 'dyut_player_count';

const getDataModule = async () => {
  if (!IS_PORTAL || !window.CrazyGames?.SDK?.data) return null;
  if (window.cgInitPromise) await window.cgInitPromise;
  return window.CrazyGames.SDK.data;
};

export const loadCrazyGamesOfflineResumeToLocal = async () => {
  const dataModule = await getDataModule();
  if (!dataModule) return false;

  const savedResume = parseCrazyGamesStoredValue(await dataModule.getItem(OFFLINE_RESUME_DATA_KEY));
  if (!savedResume?.state || !savedResume?.playerCount) return false;

  localStorage.setItem(LOCAL_GAME_STATE_KEY, JSON.stringify(savedResume.state));
  localStorage.setItem(LOCAL_PLAYER_COUNT_KEY, String(savedResume.playerCount));
  return true;
};

export const saveCrazyGamesOfflineResume = async (state) => {
  if (!state || state.isOnline) return;

  const dataModule = await getDataModule();
  if (!dataModule) return;

  const playerCount = Object.keys(state.players || {}).length;
  await dataModule.setItem(OFFLINE_RESUME_DATA_KEY, JSON.stringify({
    playerCount,
    state,
    updatedAt: Date.now()
  }));
};

export const clearCrazyGamesOfflineResume = async () => {
  const dataModule = await getDataModule();
  if (!dataModule) return;
  await dataModule.removeItem(OFFLINE_RESUME_DATA_KEY);
};
