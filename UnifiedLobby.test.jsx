import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const databaseMocks = vi.hoisted(() => ({
  set: vi.fn(),
  update: vi.fn(),
  get: vi.fn(),
  remove: vi.fn()
}));

const economyMocks = vi.hoisted(() => ({
  balance: 500,
  status: 'ready',
  dailyReward: null,
  dailyRewardAvailable: false,
  isClaimingDailyReward: false,
  claimDailyReward: vi.fn(async () => ({ applied: true })),
  reservePublicEntry: vi.fn(async () => ({ applied: true })),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() }
  })
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  onSnapshot: vi.fn(() => () => {})
}));

vi.mock('firebase/database', () => ({
  ref: vi.fn((_database, path) => path),
  onValue: vi.fn(() => () => {}),
  set: databaseMocks.set,
  update: databaseMocks.update,
  get: databaseMocks.get,
  remove: databaseMocks.remove
}));

vi.mock('./firebaseSetup.js', () => ({
  db: {},
  rtdb: {},
  signInWithGoogle: vi.fn(),
  logoutUser: vi.fn(),
  updateUserName: vi.fn()
}));

vi.mock('./matchmaking.js', () => ({
  findRandomPublicGame: vi.fn()
}));

vi.mock('./audio', () => ({
  getEffectiveMuteState: vi.fn(() => false),
  toggleUserMutePreference: vi.fn(() => false)
}));

vi.mock('./EconomyContext', () => ({
  useEconomy: () => ({
    balance: economyMocks.balance,
    status: economyMocks.status,
    dailyReward: economyMocks.dailyReward,
    dailyRewardAvailable: economyMocks.dailyRewardAvailable,
    isClaimingDailyReward: economyMocks.isClaimingDailyReward,
    claimDailyReward: economyMocks.claimDailyReward,
    reservePublicEntry: economyMocks.reservePublicEntry,
  }),
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

beforeEach(() => {
  databaseMocks.set.mockReset().mockResolvedValue(undefined);
  databaseMocks.update.mockReset().mockResolvedValue(undefined);
  databaseMocks.get.mockReset().mockResolvedValue({ exists: () => false });
  databaseMocks.remove.mockReset().mockResolvedValue(undefined);
  economyMocks.balance = 500;
  economyMocks.status = 'ready';
  economyMocks.dailyReward = null;
  economyMocks.dailyRewardAvailable = false;
  economyMocks.isClaimingDailyReward = false;
  economyMocks.claimDailyReward.mockReset().mockResolvedValue({ applied: true });
  economyMocks.reservePublicEntry.mockReset().mockResolvedValue({ applied: true });
  delete window.CrazyGames;
  delete window.cgInitPromise;
  localStorage.clear();
});

describe('UnifiedLobby CrazyGames menu', () => {
  it('replaces Custom Game with an invite-only Play with Friends lobby', async () => {
    vi.stubEnv('VITE_IS_PORTAL', 'true');
    vi.resetModules();
    const { default: UnifiedLobby } = await import('./UnifiedLobby');

    render(
      <UnifiedLobby
        onStartGame={vi.fn()}
        onResumeGame={vi.fn()}
        onClearOfflineResume={vi.fn()}
        onShowRules={vi.fn()}
        onShowTutorial={vi.fn()}
        onShowHistory={vi.fn()}
        onShowAbout={vi.fn()}
        hasCachedGame={false}
        joinGameId={null}
        user={{ uid: 'host-user', displayName: 'Host' }}
        onReconnectOnline={vi.fn()}
      />
    );

    expect(screen.queryByText('customGame')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /playWithFriends/i }));

    await waitFor(() => expect(databaseMocks.set).toHaveBeenCalledOnce());
    const [, lobby] = databaseMocks.set.mock.calls[0];

    expect(lobby).toMatchObject({
      isPublic: false,
      status: 'waiting',
      matchType: 'ffa',
      hostUid: 'host-user',
      openSeats: 3
    });
    expect(Object.values(lobby.seats)).toHaveLength(4);
    expect(Object.values(lobby.seats).every((seat) => seat.type === 'human')).toBe(true);
    expect(lobby.expiresAt).toBeNull();
  });

  it('creates three invite slots for an instant multiplayer launch', async () => {
    vi.stubEnv('VITE_IS_PORTAL', 'true');
    vi.resetModules();
    const { default: UnifiedLobby } = await import('./UnifiedLobby');
    const updateRoom = vi.fn();
    window.CrazyGames = {
      SDK: {
        game: { updateRoom },
        user: {
          getUser: vi.fn(async () => null),
          addAuthListener: vi.fn(),
          removeAuthListener: vi.fn()
        },
        data: {
          getItem: vi.fn(async () => null)
        }
      }
    };

    const InstantMultiplayerHarness = () => {
      const [shouldAutoStart, setShouldAutoStart] = React.useState(true);

      return (
        <UnifiedLobby
          onStartGame={vi.fn()}
          onResumeGame={vi.fn()}
          onClearOfflineResume={vi.fn()}
          onShowRules={vi.fn()}
          onShowTutorial={vi.fn()}
          onShowHistory={vi.fn()}
          onShowAbout={vi.fn()}
          hasCachedGame={false}
          joinGameId={null}
          user={{ uid: 'host-user', displayName: 'Host' }}
          autoStartInstantMultiplayer={shouldAutoStart}
          onInstantMultiplayerConsumed={() => setShouldAutoStart(false)}
          onReconnectOnline={vi.fn()}
        />
      );
    };

    render(<InstantMultiplayerHarness />);

    await waitFor(() => expect(databaseMocks.set).toHaveBeenCalledOnce());
    const [, lobby] = databaseMocks.set.mock.calls[0];

    expect(lobby).toMatchObject({
      isPublic: false,
      status: 'waiting',
      matchType: 'ffa',
      hostUid: 'host-user',
      openSeats: 3
    });
    expect(Object.values(lobby.seats).filter((seat) => seat.uid === null)).toHaveLength(3);
    await waitFor(() => expect(updateRoom).toHaveBeenCalledOnce());
    expect(updateRoom).toHaveBeenCalledWith(expect.objectContaining({
      roomId: expect.any(String),
      playerCount: 1,
      maxPlayerCount: 4,
      isJoinable: true,
      inviteParams: { roomId: expect.any(String) }
    }));
    expect(economyMocks.reservePublicEntry).not.toHaveBeenCalled();
  });
});

describe('UnifiedLobby standalone menu', () => {
  it('opens the rewards dialog from an icon and claims the available daily reward', async () => {
    economyMocks.dailyRewardAvailable = true;
    vi.stubEnv('VITE_IS_PORTAL', 'false');
    vi.resetModules();
    const { default: UnifiedLobby } = await import('./UnifiedLobby');

    render(
      <UnifiedLobby
        onStartGame={vi.fn()}
        onResumeGame={vi.fn()}
        onClearOfflineResume={vi.fn()}
        onShowRules={vi.fn()}
        onShowTutorial={vi.fn()}
        onShowHistory={vi.fn()}
        onShowAbout={vi.fn()}
        hasCachedGame={false}
        joinGameId={null}
        user={{ uid: 'host-user', displayName: 'Host' }}
        onReconnectOnline={vi.fn()}
      />
    );

    expect(screen.queryByTestId('daily-reward-dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('daily-reward-button'));

    expect(screen.getByRole('dialog', { name: 'dailyRewardTitle' })).toBeInTheDocument();
    expect(screen.getByText('watchAdForCoins')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('daily-reward-claim'));

    await waitFor(() => expect(economyMocks.claimDailyReward).toHaveBeenCalledOnce());
  });

  it('starts local players with the same piece design and unique seat colors', async () => {
    vi.stubEnv('VITE_IS_PORTAL', 'false');
    vi.resetModules();
    const { default: UnifiedLobby } = await import('./UnifiedLobby');
    const onStartGame = vi.fn();

    render(
      <UnifiedLobby
        onStartGame={onStartGame}
        onResumeGame={vi.fn()}
        onClearOfflineResume={vi.fn()}
        onShowRules={vi.fn()}
        onShowTutorial={vi.fn()}
        onShowHistory={vi.fn()}
        onShowAbout={vi.fn()}
        hasCachedGame={false}
        joinGameId={null}
        user={{ uid: 'host-user', displayName: 'Host' }}
        onReconnectOnline={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /localPlay/i }));
    const enabledDesignSelectors = screen.getAllByLabelText('pieceDesignForPlayer')
      .filter((selector) => !selector.disabled);
    expect(enabledDesignSelectors).toHaveLength(2);

    enabledDesignSelectors.forEach((selector) => fireEvent.change(selector, { target: { value: 'lotus' } }));
    fireEvent.click(screen.getByRole('button', { name: /startMatch/i }));

    await waitFor(() => expect(onStartGame).toHaveBeenCalledOnce());
    const gameConfig = onStartGame.mock.calls[0][0];
    expect(gameConfig.playerSkins).toEqual({
      Player1: 'lotus',
      Player2: 'lotus',
    });
    expect(new Set(gameConfig.playerColors).size).toBe(gameConfig.playerColors.length);
  });

  it('labels the existing private setup flow as Play with Friends', async () => {
    vi.stubEnv('VITE_IS_PORTAL', 'false');
    vi.resetModules();
    const { default: UnifiedLobby } = await import('./UnifiedLobby');

    render(
      <UnifiedLobby
        onStartGame={vi.fn()}
        onResumeGame={vi.fn()}
        onClearOfflineResume={vi.fn()}
        onShowRules={vi.fn()}
        onShowTutorial={vi.fn()}
        onShowHistory={vi.fn()}
        onShowAbout={vi.fn()}
        hasCachedGame={false}
        joinGameId={null}
        user={{ uid: 'host-user', displayName: 'Host' }}
        onReconnectOnline={vi.fn()}
      />
    );

    expect(screen.queryByText('privateMatch')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /playWithFriends/i }));

    expect(screen.getByRole('heading', { name: 'playWithFriends' })).toBeInTheDocument();
    expect(databaseMocks.set).not.toHaveBeenCalled();
    expect(economyMocks.reservePublicEntry).not.toHaveBeenCalled();
  });

  it('shows the public entry disclosure and stores economy metadata on the lobby', async () => {
    vi.stubEnv('VITE_IS_PORTAL', 'false');
    vi.resetModules();
    const { findRandomPublicGame } = await import('./matchmaking.js');
    findRandomPublicGame.mockResolvedValueOnce(null);
    const { default: UnifiedLobby } = await import('./UnifiedLobby');

    render(
      <UnifiedLobby
        onStartGame={vi.fn()}
        onResumeGame={vi.fn()}
        onClearOfflineResume={vi.fn()}
        onShowRules={vi.fn()}
        onShowTutorial={vi.fn()}
        onShowHistory={vi.fn()}
        onShowAbout={vi.fn()}
        hasCachedGame={false}
        joinGameId={null}
        user={{ uid: 'host-user', displayName: 'Host' }}
        onReconnectOnline={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /onlineMatch/i }));
    expect(screen.getByTestId('public-match-fee')).toHaveTextContent('publicMatchFeeDisclosure');
    fireEvent.click(screen.getByRole('button', { name: /findMatch/i }));

    await waitFor(() => expect(databaseMocks.set).toHaveBeenCalledOnce());
    expect(databaseMocks.set.mock.calls[0][1]).toMatchObject({
      isPublic: true,
      economy: {
        entryPerPlayer: 500,
        matchFeeBps: 1000,
        prizeSplit: 'winner_take_pool',
        winnerEligibility: 'paid_humans',
      },
    });
  });

  it('enables public 2v2 and stores the equal team prize split', async () => {
    vi.stubEnv('VITE_IS_PORTAL', 'false');
    vi.resetModules();
    const { findRandomPublicGame } = await import('./matchmaking.js');
    findRandomPublicGame.mockResolvedValueOnce(null);
    const { default: UnifiedLobby } = await import('./UnifiedLobby');

    render(
      <UnifiedLobby
        onStartGame={vi.fn()}
        onResumeGame={vi.fn()}
        onClearOfflineResume={vi.fn()}
        onShowRules={vi.fn()}
        onShowTutorial={vi.fn()}
        onShowHistory={vi.fn()}
        onShowAbout={vi.fn()}
        hasCachedGame={false}
        joinGameId={null}
        user={{ uid: 'host-user', displayName: 'Host' }}
        onReconnectOnline={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /onlineMatch/i }));
    const twoVsTwo = screen.getByRole('button', { name: /2v2/i });
    expect(twoVsTwo).toBeEnabled();

    fireEvent.click(twoVsTwo);
    expect(twoVsTwo).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('public-match-fee')).toHaveTextContent('publicTeamFeeDisclosure');
    fireEvent.click(screen.getByRole('button', { name: /findMatch/i }));

    await waitFor(() => expect(databaseMocks.set).toHaveBeenCalledOnce());
    expect(databaseMocks.set.mock.calls[0][1]).toMatchObject({
      isPublic: true,
      matchType: '2v2',
      isTeamMode: true,
      openSeats: 3,
      economy: {
        entryPerPlayer: 500,
        matchFeeBps: 1000,
        prizeSplit: 'equal_winning_humans',
        winnerEligibility: 'paid_humans',
      },
    });
  });

  it('blocks public setup below 500 coins while keeping free modes enabled', async () => {
    economyMocks.balance = 499;
    vi.stubEnv('VITE_IS_PORTAL', 'false');
    vi.resetModules();
    const { default: UnifiedLobby } = await import('./UnifiedLobby');

    render(
      <UnifiedLobby
        onStartGame={vi.fn()}
        onResumeGame={vi.fn()}
        onClearOfflineResume={vi.fn()}
        onShowRules={vi.fn()}
        onShowTutorial={vi.fn()}
        onShowHistory={vi.fn()}
        onShowAbout={vi.fn()}
        hasCachedGame={false}
        joinGameId={null}
        user={{ uid: 'host-user', displayName: 'Host' }}
        onReconnectOnline={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /onlineMatch/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('publicMatchInsufficientCoins');
    expect(screen.getByRole('button', { name: /localPlay/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /playWithFriends/i })).toBeEnabled();
    expect(databaseMocks.set).not.toHaveBeenCalled();
  });
});
