import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const sampleConfig = {
  playerCount: 2,
  activeSeats: ['Player1', 'Player2'],
  playerColors: ['ruby', 'sapphire'],
  playerAliases: { Player1: 'Alice', Player2: 'Bot 2' },
  playerUids: { Player1: null, Player2: null },
  bots: ['Player2'],
  botDifficulty: 'hard',
  isVoidRuleEnabled: false,
  isQuickGame: true,
  isTeamMode: false,
  isOnline: false,
  gameId: null,
  matchType: '1v1',
  isPublic: false
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}));

vi.mock('firebase/auth', () => ({
  onIdTokenChanged: vi.fn(() => () => {})
}));

vi.mock('./firebaseSetup.js', () => ({
  auth: {},
  signInUserAnonymously: vi.fn(),
  checkAuthRedirect: vi.fn(async () => null),
  initializeUserProfile: vi.fn(),
  loadAccountResumeGame: vi.fn(async () => null),
  saveAccountResumeGame: vi.fn(async () => {})
}));

vi.mock('./crazyGamesStorage', () => ({
  clearCrazyGamesOfflineResume: vi.fn(async () => {}),
  loadCrazyGamesOfflineResumeToLocal: vi.fn(async () => false)
}));

vi.mock('./EconomyContext', () => ({
  EconomyProvider: ({ children }) => children,
}));

vi.mock('./audio', () => ({
  bindCrazyGamesMuteSetting: vi.fn(async () => undefined),
  dispatchMuteState: vi.fn(),
  getEffectiveMuteState: vi.fn(() => false),
  toggleUserMutePreference: vi.fn(() => false)
}));

vi.mock('./gameLogic', () => ({
  canSpawnPiece: vi.fn(() => false),
  hasAnyPlayableMove: vi.fn(() => false)
}));

vi.mock('./GameContext', () => ({
  GameProvider: ({ gameConfig, children }) => (
    <div data-testid="game-provider" data-config={JSON.stringify(gameConfig)}>
      {children}
    </div>
  ),
  useGame: () => ({
    state: {
      currentPlayer: 'Player1',
      players: {
        Player1: { pieces: [-1, -1, -1, -1] },
        Player2: { pieces: [-1, -1, -1, -1] }
      },
      bots: ['Player2'],
      turnQueue: [],
      hasRolledThisTurn: false,
      rollingPhaseComplete: false,
      isOnline: false,
      isPublic: false
    },
    leaveGame: vi.fn()
  }),
  canLocalClientAct: vi.fn(() => true),
  getActiveTurnPlayerId: vi.fn((state) => state.currentPlayer),
  isGameOverState: vi.fn(() => false)
}));

vi.mock('./UnifiedLobby', () => ({
  default: ({ onStartGame }) => (
    <button type="button" onClick={() => onStartGame(sampleConfig)}>
      start-sample-game
    </button>
  )
}));

vi.mock('./Board', () => ({
  default: ({ onNewGame }) => (
    <button type="button" onClick={onNewGame}>
      start-same-game
    </button>
  )
}));

vi.mock('./DiceTray', () => ({ default: () => <div>dice-tray</div> }));
vi.mock('./RulesScreen', () => ({ default: () => <div>rules</div> }));
vi.mock('./TutorialScreen', () => ({ default: () => <div>tutorial</div> }));
vi.mock('./HistoryScreen', () => ({ default: () => <div>history</div> }));
vi.mock('./AboutScreen', () => ({ default: () => <div>about</div> }));
vi.mock('./VictoryScreen', () => ({ default: () => <div>victory</div> }));

describe('App new game flow', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/');
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query.includes('min-width: 1024px'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn()
    }));
  });

  it('starts a fresh local game with the same configuration', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'start-sample-game' }));
    const firstConfig = JSON.parse(screen.getByTestId('game-provider').dataset.config);

    fireEvent.click(screen.getByRole('button', { name: 'start-same-game' }));

    await waitFor(() => expect(screen.getByTestId('game-provider')).toBeInTheDocument());
    const repeatedConfig = JSON.parse(screen.getByTestId('game-provider').dataset.config);

    expect(repeatedConfig).toMatchObject({
      playerCount: firstConfig.playerCount,
      activeSeats: firstConfig.activeSeats,
      playerColors: firstConfig.playerColors,
      playerAliases: firstConfig.playerAliases,
      bots: firstConfig.bots,
      botDifficulty: firstConfig.botDifficulty,
      isVoidRuleEnabled: firstConfig.isVoidRuleEnabled,
      isQuickGame: firstConfig.isQuickGame,
      isTeamMode: firstConfig.isTeamMode,
      matchType: firstConfig.matchType,
      isOnline: false,
      gameId: null,
      status: 'playing'
    });
    expect(screen.queryByRole('button', { name: 'start-sample-game' })).not.toBeInTheDocument();
  });
});
