import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const databaseMocks = vi.hoisted(() => ({
  set: vi.fn(),
  update: vi.fn(),
  get: vi.fn(),
  remove: vi.fn()
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

afterEach(() => {
  vi.unstubAllEnvs();
});

beforeEach(() => {
  databaseMocks.set.mockReset().mockResolvedValue(undefined);
  databaseMocks.update.mockReset().mockResolvedValue(undefined);
  databaseMocks.get.mockReset().mockResolvedValue({ exists: () => false });
  databaseMocks.remove.mockReset().mockResolvedValue(undefined);
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
    window.CrazyGames = { SDK: { game: { updateRoom } } };

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
  });
});

describe('UnifiedLobby standalone menu', () => {
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
  });
});
