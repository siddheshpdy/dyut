import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';
import { doc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db, signInWithGoogle, logoutUser, updateUserName } from './firebaseSetup.js';
import { findRandomPublicGame } from './matchmaking.js';

const ALL_COLORS = [
  { name: 'ruby', tw: 'bg-ruby' },
  { name: 'sapphire', tw: 'bg-sapphire' },
  { name: 'emerald', tw: 'bg-emerald' },
  { name: 'amber', tw: 'bg-amber' },
];

const SeatCard = ({ id, label, seat, onTypeChange, onColorChange, onNameChange, onClaim, activeColors, isHost, isOnline, userUid, t, hasClaimedSeat, lobbyStatus, isLobbyPublic }) => {
  const isActive = seat.type !== 'closed';
  const isBot = seat.type === 'bot';
  const typeColor = seat.type === 'human' ? 'text-gold bg-gold/10 border-gold/30' : seat.type === 'bot' ? 'text-sapphire bg-sapphire/10 border-sapphire/30' : 'text-white/40 bg-white/5 border-white/10';
  
  const isOwnedByMe = seat.uid === userUid;
  const editable = !isOnline || isOwnedByMe || (isBot && isHost);
  const isUnclaimedHuman = isOnline && seat.type === 'human' && !seat.uid;

  // Local state to prevent rapid keystrokes from causing Firebase race conditions
  const [localName, setLocalName] = useState(seat.name || '');

  // Sync local state when external data changes, but only when necessary
  useEffect(() => {
    setLocalName(seat.name || '');
  }, [seat.name]);

  const handleBlur = () => {
    if (localName !== seat.name) onNameChange(localName);
  };

  return (
    <div className={`flex flex-col items-center p-3 rounded-xl border transition-all ${isActive ? (isOwnedByMe ? 'bg-black/60 border-gold shadow-[0_0_15px_rgba(251,191,36,0.4)] scale-[1.02]' : 'bg-black/40 border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.5)]') : 'bg-black/40 border-transparent opacity-50 hover:opacity-80'}`}>
      <span className={`text-[9px] uppercase tracking-widest mb-1.5 whitespace-nowrap font-bold ${isOwnedByMe ? 'text-gold drop-shadow-md' : 'text-white/50'}`}>
        {label} {isOwnedByMe && <span className="opacity-80">({t('you', 'YOU')})</span>}
      </span>
      
      <div className="relative w-full">
        <select 
          value={seat.type} 
          onChange={(e) => onTypeChange(e.target.value)}
          disabled={(isOnline && !isHost) || isLobbyPublic}
          className={`w-full py-1.5 px-2 appearance-none rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${(isOnline && !isHost) || isLobbyPublic ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'} text-center outline-none ${typeColor}`}
        >
          <option value="human" className="bg-charcoal text-gold">{t('human', 'Human')}</option>
          <option value="bot" className="bg-charcoal text-sapphire">{t('bot', 'Bot')}</option>
          <option value="closed" className="bg-charcoal text-white/50">{t('closed', 'Closed')}</option>
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-1 flex items-center px-1">
          <svg className={`h-3 w-3 ${seat.type === 'closed' ? 'text-white/40' : seat.type === 'human' ? 'text-gold/70' : 'text-sapphire/70'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      
      {isUnclaimedHuman ? (
        <div className="w-full mt-2 py-1.5 text-white/50 text-[10px] uppercase font-bold tracking-widest text-center border border-dashed border-white/20 rounded animate-pulse">
          {t('waiting', 'WAITING...')}
        </div>
      ) : (
        <input
          type="text"
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          onBlur={handleBlur}
          disabled={!editable}
          placeholder={t('playerNamePlaceholder', 'Enter Name')}
          maxLength={12}
          spellCheck="false"
          className={`w-full mt-2 py-1 bg-transparent text-white/90 text-xs font-sans text-center border border-white/10 rounded focus:outline-none focus:border-gold/50 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        />
      )}

      <div className={`flex gap-1.5 mt-3 transition-opacity ${isActive && !isUnclaimedHuman ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {ALL_COLORS.map(color => {
          const isTaken = activeColors.includes(color.name) && seat.color !== color.name;
          return (
            <button
              key={color.name}
              disabled={!editable || isTaken}
              onClick={() => !isTaken && onColorChange(color.name)}
              className={`w-5 h-5 rounded-full ${color.tw} jewel-shadow transition-all ${seat.color === color.name ? 'ring-2 ring-white ring-offset-2 ring-offset-charcoal scale-125 z-10' : isTaken ? 'opacity-20 cursor-not-allowed' : 'opacity-60 hover:opacity-100 hover:scale-110'}`}
              title={color.name}
            />
          );
        })}
      </div>

      {isOnline && !seat.uid && !hasClaimedSeat && lobbyStatus === 'waiting' && !isLobbyPublic && (
        <button onClick={() => onClaim(id)} className="w-full mt-2 py-1 bg-emerald/20 text-emerald border border-emerald/30 rounded text-[10px] uppercase font-bold tracking-widest hover:bg-emerald/30 transition-colors">
          {t('claimSeat', 'Claim Seat')}
        </button>
      )}
      {isOnline && seat.type === 'human' && seat.uid && !isOwnedByMe && (
        <div className="w-full mt-2 py-1 bg-ruby/20 text-ruby border border-ruby/30 rounded text-[10px] uppercase font-bold tracking-widest text-center cursor-not-allowed">
          {t('taken', 'Taken')}
        </div>
      )}
    </div>
  );
};

const PlayerProfile = ({ user }) => {
  const [stats, setStats] = useState(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const { t } = useTranslation();

  useEffect(() => {
    if (user && !user.isAnonymous) {
      const unsub = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
        if (docSnap.exists()) {
          setStats(docSnap.data());
        }
      });
      return () => unsub();
    }
  }, [user]);

  if (!user) return <div className="h-10 mb-4"></div>;

  if (user.isAnonymous) {
    const handleSignIn = async () => {
      setIsSigningIn(true);
      try {
        await signInWithGoogle();
      } finally {
        setIsSigningIn(false);
      }
    };

    return (
      <button type="button" onClick={handleSignIn} disabled={isSigningIn} className={`mb-4 flex items-center gap-2 bg-white/5 transition-colors border border-white/10 px-4 py-2 rounded-full z-20 shadow-sm animate-fade-in ${isSigningIn ? 'opacity-70 cursor-wait' : 'hover:bg-white/10'}`}>
        {isSigningIn ? (
          <svg className="animate-spin w-3.5 h-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 15.02 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
        )}
        <span className="text-[10px] font-bold text-white uppercase tracking-wider">{isSigningIn ? t('signingIn', 'Signing In...') : t('signInGoogle', 'Sign in to save stats')}</span>
      </button>
    );
  }

  const displayName = stats?.displayName || user.displayName || 'Player';

  const handleEditSave = async () => {
    if (editName.trim() && editName.trim() !== displayName) {
      await updateUserName(editName.trim());
    }
    setIsEditing(false);
  };
  
  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleEditSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  return (
    <div className="mb-4 flex items-center justify-between gap-4 bg-black/20 border border-white/5 pl-4 pr-3 py-2 rounded-full z-20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] animate-fade-in">
      <div className="flex items-center gap-3">
        {user.photoURL || stats?.photoURL ? (
          <img src={user.photoURL || stats?.photoURL} alt="Profile" className="w-8 h-8 rounded-full border border-white/20 shadow-md" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gold flex items-center justify-center text-charcoal font-bold text-sm shadow-md">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex flex-col">
          {isEditing ? (
            <input 
              type="text" 
              value={editName} 
              onChange={(e) => setEditName(e.target.value)} 
              onKeyDown={handleEditKeyDown}
              onBlur={handleEditSave}
              autoFocus
              maxLength={15}
              className="w-24 bg-black/40 border border-gold/50 rounded px-1 py-0.5 text-xs font-bold text-white/90 focus:outline-none"
            />
          ) : (
            <div className="flex items-center gap-1.5 group cursor-pointer" onClick={() => { setEditName(displayName); setIsEditing(true); }} title={t('editName', 'Edit Name')}>
              <span className="text-xs font-bold text-white/90 leading-none truncate max-w-[120px]">{displayName}</span>
              <svg className="w-3 h-3 text-white/30 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
          )}
          {stats && (
            <span className="text-[10px] font-bold text-gold tracking-widest mt-1.5 leading-none drop-shadow-md">
              {stats.wins}W / {stats.gamesPlayed}P
            </span>
          )}
        </div>
      </div>
      <button 
        onClick={logoutUser} 
        className="text-white/30 hover:text-ruby transition-colors ml-1 p-1.5 rounded-full hover:bg-white/5"
        title={t('signOut', 'Sign Out')}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      </button>
    </div>
  );
};

const UnifiedLobby = ({ onStartGame, onResumeGame, onShowRules, hasCachedGame, joinGameId, user, lastOnlineGameId, onReconnectOnline }) => {
  const [seats, setSeats] = useState({
    Player4: { type: 'closed', color: 'amber', name: '', uid: null },
    Player3: { type: 'closed', color: 'emerald', name: '', uid: null },
    Player1: { type: 'human', color: 'ruby', name: '', uid: null },
    Player2: { type: 'bot', color: 'sapphire', name: '', uid: null }
  });
  const [botDifficulty, setBotDifficulty] = useState('hard');
  const [isVoidRuleEnabled, setIsVoidRuleEnabled] = useState(true);
  const [isQuickGame, setIsQuickGame] = useState(false);
  const [isTeamMode, setIsTeamMode] = useState(false);
  const [pendingGameId, setPendingGameId] = useState(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isHosting, setIsHosting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isLobbyPublic, setIsLobbyPublic] = useState(false);
  const [setupMode, setSetupMode] = useState(null);
  const [setupStep, setSetupStep] = useState('config');
  const [matchType, setMatchType] = useState('1v1');
  const [lobbyStatus, setLobbyStatus] = useState('waiting');
  const [lobbyHostUid, setLobbyHostUid] = useState(null);
  const [lobbyExpiresAt, setLobbyExpiresAt] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Waiting...');

  const { t } = useTranslation();

  const activeLobbyId = joinGameId || pendingGameId;
  const isHost = (activeLobbyId && pendingGameId !== null) || (user && lobbyHostUid === user.uid);
  const hasClaimedSeat = Object.values(seats).some(s => s.uid === user?.uid);

  const activeSeats = Object.entries(seats).filter(([_, s]) => s.type !== 'closed');
  const playerCount = activeSeats.length;
  const botCount = activeSeats.filter(([_, s]) => s.type === 'bot').length;
  const activeColors = activeSeats.map(([_, s]) => s.color);

  useEffect(() => {
    // Wait until the anonymous authentication completes before attempting to listen to the secure database
    if (!activeLobbyId || !user) return; 
    
    setConnectionStatus('Connecting...');

    const unsub = onSnapshot(doc(db, 'lobbies', activeLobbyId), (docSnap) => {
      if (docSnap.exists()) {
        setConnectionStatus('Connected');
        const data = docSnap.data();
        if (data.seats) setSeats(data.seats);
        if (data.botDifficulty !== undefined) setBotDifficulty(data.botDifficulty);
        if (data.isVoidRuleEnabled !== undefined) setIsVoidRuleEnabled(data.isVoidRuleEnabled);
        if (data.isQuickGame !== undefined) setIsQuickGame(data.isQuickGame);
        if (data.isTeamMode !== undefined) setIsTeamMode(data.isTeamMode);
        if (data.isPublic !== undefined) setIsLobbyPublic(data.isPublic);
        if (data.status !== undefined) setLobbyStatus(data.status);
        if (data.hostUid !== undefined) setLobbyHostUid(data.hostUid);
        if (data.expiresAt !== undefined) setLobbyExpiresAt(data.expiresAt);

        // If the host starts the game, instantly pull joiners into the match
        if (data.gameStarted && joinGameId) {
          executeStart(true, activeLobbyId, data);
        }
      } else {
        setConnectionStatus('Lobby not found');
      }
    }, (error) => {
      console.error("Lobby listener error:", error);
      setConnectionStatus('Error: ' + error.message);
    });
    return () => unsub();
  }, [activeLobbyId, joinGameId, user]);

  useEffect(() => {
    if (!lobbyExpiresAt || !activeLobbyId || lobbyStatus !== 'waiting') {
      setTimeLeft(null);
      return;
    }
    const interval = setInterval(() => {
      const remaining = Math.floor((lobbyExpiresAt - Date.now()) / 1000);
      if (remaining <= 0) {
        setTimeLeft(0);
        clearInterval(interval);
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lobbyExpiresAt, activeLobbyId, lobbyStatus]);

  const isStartingRef = useRef(false);

  useEffect(() => {
    if (!isHost || lobbyStatus !== 'waiting' || !isLobbyPublic) return;

    const humanSeats = Object.values(seats).filter(s => s.type === 'human');
    const claimedSeats = humanSeats.filter(s => s.uid);
    const isFull = humanSeats.length > 0 && humanSeats.length === claimedSeats.length;

    if (isFull || (timeLeft === 0 && claimedSeats.length >= 2)) {
      if (isStartingRef.current) return;
      isStartingRef.current = true;

      const autoStart = async () => {
        setLobbyStatus('playing'); // Prevent multiple triggers
        const finalSeats = { ...seats };
        Object.keys(finalSeats).forEach(k => {
          if (finalSeats[k].type === 'human' && !finalSeats[k].uid) {
            finalSeats[k] = { ...finalSeats[k], type: 'closed' };
          }
        });
        try {
          await updateDoc(doc(db, 'lobbies', activeLobbyId), { status: 'playing', gameStarted: true, seats: finalSeats });
        } catch (e) {
          console.error("AutoStart sync error:", e);
        }
        executeStart(true, activeLobbyId, { seats: finalSeats });
      };
      autoStart();
    }
  }, [seats, timeLeft, isHost, lobbyStatus, isLobbyPublic, activeLobbyId]);

  const pushUpdate = async (field, value) => {
    if (activeLobbyId) {
      try { 
        await updateDoc(doc(db, 'lobbies', activeLobbyId), { [field]: value }); 
      } catch (e) { 
        console.error("Sync error:", e); 
        alert(`Failed to sync ${field}. Check console for details.`);
      }
    }
  };

  const handleSeatTypeChange = (playerId, newType) => {
    const newSeats = { ...seats, [playerId]: { ...seats[playerId], type: newType } };
    setSeats(newSeats); pushUpdate('seats', newSeats);
  };

  const handleSeatColorChange = (playerId, colorName) => {
    const newSeats = { ...seats, [playerId]: { ...seats[playerId], color: colorName } };
    setSeats(newSeats); pushUpdate('seats', newSeats);
  };

  const handleSeatNameChange = (playerId, newName) => {
    const newSeats = { ...seats, [playerId]: { ...seats[playerId], name: newName } };
    setSeats(newSeats); pushUpdate('seats', newSeats);
  };

  const handleClaimSeat = (playerId) => {
    // Forcing type to 'human' allows joiners to overtake bot/closed slots
    const newSeats = { ...seats, [playerId]: { ...seats[playerId], type: 'human', uid: user.uid, name: user?.displayName || '' } };
    setSeats(newSeats); pushUpdate('seats', newSeats);
  };

  useEffect(() => {
    // Auto-assign random matchmaking players to an open seat without needing to click
    if (isLobbyPublic && activeLobbyId && user && lobbyStatus === 'waiting' && !hasClaimedSeat) {
      const preferredOrder = ['Player1', 'Player2', 'Player3', 'Player4'];
      let targetSeat = preferredOrder.find(id => seats[id].type === 'human' && !seats[id].uid);
      if (!targetSeat) targetSeat = preferredOrder.find(id => seats[id].type === 'bot' && !seats[id].uid);
      if (!targetSeat) targetSeat = preferredOrder.find(id => seats[id].type === 'closed' && !seats[id].uid);
      
      if (targetSeat) handleClaimSeat(targetSeat);
    }
  }, [isLobbyPublic, activeLobbyId, user, seats, lobbyStatus, hasClaimedSeat]);

  useEffect(() => {
    if (playerCount !== 4) setIsTeamMode(false); // Team mode strictly 2v2
  }, [playerCount]);

  const executeStart = (isOnline = false, targetGameId = null, overrideData = null) => {
    const currentSeats = overrideData?.seats || seats;
    const currentActiveSeats = Object.entries(currentSeats).filter(([_, s]) => s.type !== 'closed');
    const currentActiveColors = currentActiveSeats.map(([_, s]) => s.color);
    const bots = currentActiveSeats.filter(([_, s]) => s.type === 'bot').map(([id]) => id);
    
    if (!overrideData) { // Only validate if we are initiating the start locally
      if (currentActiveSeats.length < 2) return alert("Need at least 2 players.");
      if (isOnline) {
        const humanCount = currentActiveSeats.filter(([_, s]) => s.type === 'human').length;
        if (humanCount < 2) return alert(t('onlineHumansRequired', "Online games require at least 2 human players."));
        if (currentActiveSeats.length === 4 && bots.length > 1) return alert(t('maxOneBotInFourPlayer', "Maximum 1 bot allowed in a 4-player game."));
        const unclaimedHumans = currentActiveSeats.filter(([_, s]) => s.type === 'human' && !s.uid).length;
        if (unclaimedHumans > 0) return alert(t('allHumansMustBeClaimed', "All human seats must be claimed before starting."));
      } else {
        if (currentActiveSeats.filter(([_, s]) => s.type === 'human').length === 0) return alert("Need at least 1 human player.");
      }
      if (new Set(currentActiveColors).size !== currentActiveColors.length) return alert("Each active player must have a unique color.");
    }

    const activeSeatIds = currentActiveSeats.map(([id]) => id).sort();
    const playerColors = activeSeatIds.map(id => currentSeats[id].color);
    
    const playerAliases = {};
    const playerUids = {};
    activeSeatIds.forEach(id => {
      playerAliases[id] = currentSeats[id].name.trim() || (currentSeats[id].type === 'bot' ? `${t('bot', 'Bot')} ${id.replace('Player', '')}` : `${t('player', 'Player')} ${id.replace('Player', '')}`);
      playerUids[id] = currentSeats[id].uid || null;
    });

    onStartGame({ 
      playerCount: activeSeatIds.length, activeSeats: activeSeatIds, playerColors, playerAliases, playerUids,
      isVoidRuleEnabled: overrideData?.isVoidRuleEnabled ?? isVoidRuleEnabled, bots, botDifficulty: overrideData?.botDifficulty ?? botDifficulty, 
      isQuickGame: overrideData?.isQuickGame ?? isQuickGame, isTeamMode: overrideData?.isTeamMode ?? isTeamMode, isOnline, gameId: targetGameId,
      hostUid: overrideData?.hostUid || user?.uid || null, localUid: user?.uid || null,
      isPublic: overrideData?.isPublic ?? isLobbyPublic
    });
  };

  const handleHostOnlineClick = async (isPublicLobby = false) => {
    const isPublic = typeof isPublicLobby === 'boolean' ? isPublicLobby : false;
    
    let newSeats = {};
    if (matchType === '1v1') {
      newSeats = {
        Player4: { type: 'closed', color: 'amber', name: '', uid: null },
        Player3: { type: 'human', color: 'emerald', name: '', uid: null },
        Player1: { type: 'human', color: 'ruby', name: '', uid: null },
        Player2: { type: 'closed', color: 'sapphire', name: '', uid: null }
      };
    } else {
      newSeats = {
        Player4: { type: 'human', color: 'amber', name: '', uid: null },
        Player3: { type: 'human', color: 'emerald', name: '', uid: null },
        Player1: { type: 'human', color: 'ruby', name: '', uid: null },
        Player2: { type: 'human', color: 'sapphire', name: '', uid: null }
      };
    }
    
    const currentActiveSeats = Object.values(newSeats).filter(s => s.type !== 'closed');

    setIsHosting(true);
    const newGameId = Math.random().toString(36).substring(2, 8).toUpperCase();

    const preferredOrder = ['Player1', 'Player2', 'Player3', 'Player4'];
    const firstHuman = preferredOrder.find(id => newSeats[id].type === 'human');
    if (firstHuman) {
      newSeats[firstHuman].uid = user?.uid || null;
      newSeats[firstHuman].name = user?.displayName || '';
    }
    
    const expiresAt = isPublic ? Date.now() + 60000 : null; // 60 second matchmaking timer
    const isTeamModeLocal = (matchType === '2v2');

    try {
      await setDoc(doc(db, 'lobbies', newGameId), {
        seats: newSeats, botDifficulty, isVoidRuleEnabled, isQuickGame, isTeamMode: isTeamModeLocal, hostUid: user?.uid || null, gameStarted: false,
        isPublic, status: 'waiting', expiresAt, matchType
      });
  
      setSeats(newSeats);
      setIsTeamMode(isTeamModeLocal);
      setPendingGameId(newGameId);
    } catch (error) {
      console.error("Firebase Error:", error);
      alert("Failed to create online lobby. Please check your Firestore Security Rules in the Firebase Console!");
    } finally {
      setIsHosting(false);
    }
  };

  const handleFindMatch = async () => {
    setIsSearching(true);
    const availableGameId = await findRandomPublicGame({
      matchType,
      isQuickGame,
      isTeamMode: matchType === '2v2',
      isVoidRuleEnabled
    });

    if (availableGameId) {
      window.history.pushState({}, '', `?join=${availableGameId}`);
      onReconnectOnline(availableGameId);
    } else {
      // No games found. Host a new public game!
      await handleHostOnlineClick(true);
    }
    setIsSearching(false);
  };

  const handleStartOnlineMatch = async () => {
    let finalSeats = null;
    if (isLobbyPublic) {
      const claimedCount = Object.values(seats).filter(s => s.type === 'human' && s.uid).length;
      if (claimedCount < 2) return alert(t('onlineHumansRequired', "Online games require at least 2 human players."));

      finalSeats = { ...seats };
      Object.keys(finalSeats).forEach(k => {
        if (finalSeats[k].type === 'human' && !finalSeats[k].uid) {
          finalSeats[k] = { ...finalSeats[k], type: 'closed' };
        }
      });
    }

    setLobbyStatus('playing');
    const updates = { status: 'playing', gameStarted: true };
    if (finalSeats) updates.seats = finalSeats;
    try {
      await updateDoc(doc(db, 'lobbies', activeLobbyId), updates);
    } catch (e) { console.error(e); }
    executeStart(true, activeLobbyId, finalSeats ? { seats: finalSeats } : null);
  };

  return (
    <div className="glass-panel p-8 rounded-3xl w-full max-w-lg flex flex-col items-center relative z-10">
      <LanguageSwitcher />

      {activeLobbyId && (
        <div className="w-full bg-black/40 border border-white/10 rounded-xl p-4 mb-8 flex flex-col items-center animate-fade-in">
          <div className="flex items-center gap-3 mb-3">
            {isLobbyPublic ? (
              <div className="flex flex-col items-start gap-1" title="Public Lobby">
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2h1a2 2 0 002-2v-1a2 2 0 012-2h1.945M7.75 4.09l.242.59a2 2 0 001.98 1.42h.02a2 2 0 001.98-1.42l.242-.59M12 15.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
                  </svg>
                  <span className="text-gold font-bold text-sm tracking-widest uppercase">{t('publicLobby', 'PUBLIC LOBBY')} - ID: {activeLobbyId}</span>
                </div>
                {lobbyStatus === 'waiting' && timeLeft !== null && (
                  <span className="text-[10px] text-emerald font-bold uppercase tracking-widest animate-pulse ml-6">
                    {timeLeft > 0 ? `${t('startingIn', 'STARTING IN')} ${timeLeft}s` : t('waitingForPlayers', 'WAITING FOR PLAYERS...')}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2" title="Private Lobby">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-ruby" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="text-gold font-bold text-sm tracking-widest uppercase">{t('privateLobby', 'PRIVATE LOBBY')} - ID: {activeLobbyId}</span>
              </div>
            )}
            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider self-start ${connectionStatus === 'Connected' ? 'bg-emerald/20 text-emerald' : 'bg-ruby/20 text-white'}`}>{connectionStatus}</span>
          </div>
          <div className="flex w-full gap-2">
            <input type="text" readOnly value={`${window.location.origin}${window.location.pathname}?join=${activeLobbyId}`} className="flex-1 bg-black/60 border border-white/5 text-white/80 font-sans text-xs px-3 py-2 rounded-lg focus:outline-none" />
            <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?join=${activeLobbyId}`); setIsCopied(true); setTimeout(() => setIsCopied(false), 2000); }} className="bg-white/10 px-4 py-2 rounded-lg text-xs font-bold text-white hover:bg-white/20 transition-colors">{isCopied ? t('copied', 'Copied!') : t('copy', 'Copy')}</button>
          </div>
        </div>
      )}
      
      <button onClick={onShowRules} className="absolute top-6 right-6 text-white/60 hover:text-gold transition-colors" title="Rules">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      </button>
      
      <PlayerProfile user={user} />

      <h1 className="font-display text-5xl font-bold mb-8 tracking-widest text-glow-gold text-gold">DYUT</h1>
      
      <div className="w-full">
        {/* --- STATE 1: MAIN MENU --- */}
        {!activeLobbyId && !setupMode && (
          <div className="w-full flex flex-col gap-3 animate-fade-in">
            <button onClick={() => { setSetupMode('local'); setSetupStep('config'); }} className="w-full py-4 flex flex-col items-center justify-center gap-1 bg-gold text-charcoal font-display font-bold rounded-xl shadow-[0_0_15px_rgba(251,191,36,0.4)] hover:bg-yellow-400 hover:scale-[1.02] transition-all" title={t('startNewGame', 'Local Play')}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span className="text-xs leading-none uppercase tracking-widest mt-1">{t('local', 'LOCAL PLAY')}</span>
            </button>

            <button onClick={() => { setSetupMode('public'); setSetupStep('config'); }} className="w-full py-4 flex flex-col items-center justify-center gap-1 bg-emerald text-charcoal font-display font-bold rounded-xl shadow-[0_0_15px_rgba(52,211,153,0.4)] hover:bg-emerald-400 hover:scale-[1.02] transition-all" title={t('findRandomMatch', 'Find Public Match')}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
              <span className="text-xs leading-none uppercase tracking-widest mt-1">{t('public', 'PUBLIC MATCH')}</span>
            </button>

            <button onClick={() => { setSetupMode('private'); setSetupStep('config'); }} className="w-full py-4 flex flex-col items-center justify-center gap-1 bg-sapphire text-white font-display font-bold rounded-xl shadow-[0_0_15px_rgba(56,189,248,0.4)] hover:bg-blue-400 hover:scale-[1.02] transition-all" title={t('hostOnlineMatch', 'Host Private Match')}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              <span className="text-xs leading-none uppercase tracking-widest mt-1">{t('private', 'PRIVATE MATCH')}</span>
            </button>

            {(hasCachedGame || lastOnlineGameId) && (
              <div className="flex gap-2 w-full mt-2">
                {hasCachedGame && (
                  <button onClick={onResumeGame} className="flex-1 py-3 bg-white/5 text-white font-sans text-xs font-semibold rounded-xl border border-white/10 hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    {t('resumeOffline', 'Resume Offline')}
                  </button>
                )}
                {lastOnlineGameId && (
                  <button onClick={() => onReconnectOnline(lastOnlineGameId)} className="flex-1 py-3 bg-white/5 text-sapphire font-sans text-xs font-semibold rounded-xl border border-white/10 hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                    {t('reconnectOnline', 'Reconnect')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* --- STATE 2: INTERMEDIATE CONFIG SCREEN --- */}
        {!activeLobbyId && setupMode && setupStep === 'config' && (
          <div className="w-full flex flex-col items-center animate-fade-in space-y-6">
            <div className="w-full flex justify-between items-center bg-black/20 p-2 rounded-xl border border-white/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]">
              <button onClick={() => setSetupMode(null)} className="px-3 py-1.5 bg-white/5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg> {t('back', 'BACK')}</button>
              <h2 className="text-white/80 font-bold tracking-widest uppercase text-sm">{setupMode === 'public' ? t('publicMatch', 'PUBLIC MATCH') : setupMode === 'private' ? t('privateMatch', 'PRIVATE MATCH') : t('localPlay', 'LOCAL PLAY')}</h2>
              <div className="w-[72px]"></div>
            </div>

            <div className="w-full flex flex-col items-center">
              <h3 className="text-white/70 text-[10px] uppercase tracking-widest mb-3 text-center font-semibold">{t('matchType', 'Match Type')}</h3>
              <div className="flex gap-2 w-full max-w-[340px]">
                <button onClick={() => setMatchType('1v1')} className={`flex-1 py-4 flex flex-col items-center justify-center gap-1.5 rounded-xl border font-display font-bold text-sm sm:text-base transition-all ${matchType === '1v1' ? 'bg-sapphire/20 border-sapphire text-sapphire shadow-[0_0_15px_rgba(56,189,248,0.3)] scale-105 z-10' : 'bg-black/40 border-white/10 text-white/50 hover:text-white hover:border-white/30'}`}>
                  <div className="flex gap-1"><div className="w-2.5 h-2.5 rounded-full bg-sapphire"></div><div className="w-2.5 h-2.5 rounded-full bg-ruby"></div></div>
                  1 vs 1
                </button>
                <button onClick={() => setMatchType('2v2')} className={`flex-1 py-4 flex flex-col items-center justify-center gap-1.5 rounded-xl border font-display font-bold text-sm sm:text-base transition-all ${matchType === '2v2' ? 'bg-emerald/20 border-emerald text-emerald shadow-[0_0_15px_rgba(52,211,153,0.3)] scale-105 z-10' : 'bg-black/40 border-white/10 text-white/50 hover:text-white hover:border-white/30'}`}>
                  <div className="flex gap-1"><div className="w-2.5 h-2.5 rounded-full bg-emerald"></div><div className="w-2.5 h-2.5 rounded-full bg-amber"></div></div>
                  2 vs 2
                </button>
                <button onClick={() => setMatchType('ffa')} className={`flex-1 py-4 flex flex-col items-center justify-center gap-1.5 rounded-xl border font-display font-bold text-sm sm:text-base transition-all ${matchType === 'ffa' ? 'bg-ruby/20 border-ruby text-ruby shadow-[0_0_15px_rgba(244,63,94,0.3)] scale-105 z-10' : 'bg-black/40 border-white/10 text-white/50 hover:text-white hover:border-white/30'}`}>
                  <div className="flex gap-1"><div className="w-2.5 h-2.5 rounded-full bg-ruby"></div><div className="w-2.5 h-2.5 rounded-full bg-sapphire"></div><div className="w-2.5 h-2.5 rounded-full bg-emerald"></div></div>
                  FFA 4P
                </button>
              </div>
            </div>

            <div className="w-full flex flex-col items-center">
              <h3 className="text-white/70 text-[10px] uppercase tracking-widest mb-3 text-center font-semibold">{t('gameRules', 'Game Rules')}</h3>
              <div className="flex justify-center gap-3 w-full max-w-[340px]">
                <button onClick={() => setIsVoidRuleEnabled(!isVoidRuleEnabled)} className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border transition-all ${isVoidRuleEnabled ? 'bg-gold/20 border-gold/40 text-gold shadow-[0_0_10px_rgba(251,191,36,0.2)]' : 'bg-black/30 border-white/5 text-white/40 hover:text-white/80'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                  <span className="text-[10px] font-bold uppercase tracking-wider">1+3 Void</span>
                </button>
                <button onClick={() => setIsQuickGame(!isQuickGame)} className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border transition-all ${isQuickGame ? 'bg-sapphire/20 border-sapphire/40 text-sapphire shadow-[0_0_10px_rgba(56,189,248,0.2)]' : 'bg-black/30 border-white/5 text-white/40 hover:text-white/80'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  <span className="text-[10px] font-bold uppercase tracking-wider">{t('quickGame', 'Quick')}</span>
                </button>
              </div>
            </div>

            {setupMode !== 'public' && (
              <div className="w-full flex flex-col items-center">
                <h3 className="text-white/70 text-[10px] uppercase tracking-widest mb-3 text-center font-semibold">{t('botDifficulty', 'Bot Difficulty')}</h3>
                <div className="flex justify-center gap-3 w-full max-w-[340px]">
                  <button onClick={() => setBotDifficulty('easy')} className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border transition-all ${botDifficulty === 'easy' ? 'bg-emerald/20 border-emerald/40 text-emerald shadow-[0_0_10px_rgba(52,211,153,0.2)]' : 'bg-black/30 border-white/5 text-white/40 hover:text-white/80'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 100-2 1 1 0 000 2zm7-1a1 1 0 11-2 0 1 1 0 012 0zm-.464 5.535a1 1 0 10-1.415-1.414 3 3 0 01-4.242 0 1 1 0 00-1.415 1.414 5 5 0 007.072 0z" clipRule="evenodd" /></svg>
                    <span className="text-[10px] font-bold uppercase tracking-wider">{t('easy', 'EASY')}</span>
                  </button>
                  <button onClick={() => setBotDifficulty('hard')} className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border transition-all ${botDifficulty === 'hard' ? 'bg-ruby/20 border-ruby/40 text-ruby shadow-[0_0_10px_rgba(244,63,94,0.2)]' : 'bg-black/30 border-white/5 text-white/40 hover:text-white/80'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 100-2 1 1 0 000 2zm7-1a1 1 0 11-2 0 1 1 0 012 0zm-1.5 5.5a1 1 0 00-1 1h-3a1 1 0 100 2h7a1 1 0 100-2h-3a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                    <span className="text-[10px] font-bold uppercase tracking-wider">{t('hard', 'HARD')}</span>
                  </button>
                </div>
              </div>
            )}

            <div className="w-full mt-4">
              {setupMode === 'local' && (
                <button onClick={() => {
                  let newSeats = {};
                  if (matchType === '1v1') {
                    newSeats = { Player4: { type: 'closed', color: 'amber', name: '', uid: null }, Player3: { type: 'human', color: 'emerald', name: '', uid: null }, Player1: { type: 'human', color: 'ruby', name: user?.displayName || '', uid: null }, Player2: { type: 'closed', color: 'sapphire', name: '', uid: null } };
                  } else {
                    newSeats = { Player4: { type: 'human', color: 'amber', name: '', uid: null }, Player3: { type: 'human', color: 'emerald', name: '', uid: null }, Player1: { type: 'human', color: 'ruby', name: user?.displayName || '', uid: null }, Player2: { type: 'human', color: 'sapphire', name: '', uid: null } };
                  }
                  setSeats(newSeats);
                  setIsTeamMode(matchType === '2v2');
                  setSetupStep('seats');
                }} className="w-full py-4 flex items-center justify-center gap-2 bg-gold text-charcoal font-display font-bold text-lg rounded-xl shadow-[0_0_15px_rgba(251,191,36,0.4)] hover:bg-yellow-400 hover:scale-[1.02] transition-all">
                  NEXT
                </button>
              )}
              {setupMode === 'public' && (
                <button onClick={handleFindMatch} disabled={isSearching || isHosting} className="w-full py-4 flex items-center justify-center gap-2 bg-emerald text-charcoal font-display font-bold text-lg rounded-xl shadow-[0_0_15px_rgba(52,211,153,0.4)] hover:bg-emerald-400 hover:scale-[1.02] disabled:opacity-70 disabled:scale-100 disabled:cursor-not-allowed transition-all">
                  {isSearching ? t('searching', 'SEARCHING...') : t('findMatch', 'FIND MATCH')}
                </button>
              )}
              {setupMode === 'private' && (
                <button onClick={() => handleHostOnlineClick(false)} disabled={isHosting || isSearching} className="w-full py-4 flex items-center justify-center gap-2 bg-sapphire text-white font-display font-bold text-lg rounded-xl shadow-[0_0_15px_rgba(56,189,248,0.4)] hover:bg-blue-400 hover:scale-[1.02] disabled:opacity-70 disabled:scale-100 disabled:cursor-not-allowed transition-all">
                  {isHosting ? t('hostingMatch', 'CREATING LOBBY...') : t('createLobby', 'CREATE LOBBY')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* --- STATE 3: LOCAL PLAY SETUP --- */}
        {!activeLobbyId && setupMode === 'local' && setupStep === 'seats' && (
          <div className="w-full space-y-6 animate-fade-in">
            <div className="w-full flex justify-between items-center bg-black/20 p-2 rounded-xl border border-white/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] mb-4">
              <button onClick={() => setSetupStep('config')} className="px-3 py-1.5 bg-white/5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg> {t('back', 'BACK')}</button>
              <h2 className="text-white/80 font-bold tracking-widest uppercase text-sm">{t('localPlay', 'LOCAL PLAY')}</h2>
              <div className="w-[72px]"></div>
            </div>

            <div className="w-full flex flex-col items-center">
              <h2 className="text-white/70 text-[10px] uppercase tracking-widest mb-4 text-center font-semibold">{t('seatArrangement', 'Seat Arrangement')}</h2>
              <div className="grid grid-cols-2 gap-4 w-full max-w-[280px]">
                 <SeatCard id="Player4" label={`${t('player', 'Player')} 4`} seat={seats.Player4} onTypeChange={(type) => handleSeatTypeChange('Player4', type)} onColorChange={(c) => handleSeatColorChange('Player4', c)} onNameChange={(n) => handleSeatNameChange('Player4', n)} onClaim={handleClaimSeat} activeColors={activeColors} isHost={isHost} isOnline={!!activeLobbyId} userUid={user?.uid} t={t} hasClaimedSeat={hasClaimedSeat} lobbyStatus={lobbyStatus} isLobbyPublic={isLobbyPublic} />
                 <SeatCard id="Player3" label={`${t('player', 'Player')} 3`} seat={seats.Player3} onTypeChange={(type) => handleSeatTypeChange('Player3', type)} onColorChange={(c) => handleSeatColorChange('Player3', c)} onNameChange={(n) => handleSeatNameChange('Player3', n)} onClaim={handleClaimSeat} activeColors={activeColors} isHost={isHost} isOnline={!!activeLobbyId} userUid={user?.uid} t={t} hasClaimedSeat={hasClaimedSeat} lobbyStatus={lobbyStatus} isLobbyPublic={isLobbyPublic} />
                 <SeatCard id="Player1" label={`${t('player', 'Player')} 1`} seat={seats.Player1} onTypeChange={(type) => handleSeatTypeChange('Player1', type)} onColorChange={(c) => handleSeatColorChange('Player1', c)} onNameChange={(n) => handleSeatNameChange('Player1', n)} onClaim={handleClaimSeat} activeColors={activeColors} isHost={isHost} isOnline={!!activeLobbyId} userUid={user?.uid} t={t} hasClaimedSeat={hasClaimedSeat} lobbyStatus={lobbyStatus} isLobbyPublic={isLobbyPublic} />
                 <SeatCard id="Player2" label={`${t('player', 'Player')} 2`} seat={seats.Player2} onTypeChange={(type) => handleSeatTypeChange('Player2', type)} onColorChange={(c) => handleSeatColorChange('Player2', c)} onNameChange={(n) => handleSeatNameChange('Player2', n)} onClaim={handleClaimSeat} activeColors={activeColors} isHost={isHost} isOnline={!!activeLobbyId} userUid={user?.uid} t={t} hasClaimedSeat={hasClaimedSeat} lobbyStatus={lobbyStatus} isLobbyPublic={isLobbyPublic} />
              </div>
            </div>

            <button onClick={() => executeStart(false)} className="w-full py-4 bg-gold text-charcoal font-display font-bold text-lg rounded-xl shadow-[0_0_15px_rgba(251,191,36,0.4)] hover:bg-yellow-400 hover:scale-[1.02] transition-all">
              {t('startMatch', 'START MATCH')}
            </button>
          </div>
        )}

        {/* --- STATE 4: ACTIVE LOBBY (PUBLIC OR PRIVATE) --- */}
        {activeLobbyId && (
          <div className="w-full space-y-6 animate-fade-in">
            <div className="w-full flex flex-col items-center">
              <h2 className="text-white/70 text-[10px] uppercase tracking-widest mb-4 text-center font-semibold">{t('seatArrangement', 'Seat Arrangement')}</h2>
              <div className="grid grid-cols-2 gap-4 w-full max-w-[280px]">
                 <SeatCard id="Player4" label={`${t('player', 'Player')} 4`} seat={seats.Player4} onTypeChange={(type) => handleSeatTypeChange('Player4', type)} onColorChange={(c) => handleSeatColorChange('Player4', c)} onNameChange={(n) => handleSeatNameChange('Player4', n)} onClaim={handleClaimSeat} activeColors={activeColors} isHost={isHost} isOnline={!!activeLobbyId} userUid={user?.uid} t={t} hasClaimedSeat={hasClaimedSeat} lobbyStatus={lobbyStatus} isLobbyPublic={isLobbyPublic} />
                 <SeatCard id="Player3" label={`${t('player', 'Player')} 3`} seat={seats.Player3} onTypeChange={(type) => handleSeatTypeChange('Player3', type)} onColorChange={(c) => handleSeatColorChange('Player3', c)} onNameChange={(n) => handleSeatNameChange('Player3', n)} onClaim={handleClaimSeat} activeColors={activeColors} isHost={isHost} isOnline={!!activeLobbyId} userUid={user?.uid} t={t} hasClaimedSeat={hasClaimedSeat} lobbyStatus={lobbyStatus} isLobbyPublic={isLobbyPublic} />
                 <SeatCard id="Player1" label={`${t('player', 'Player')} 1`} seat={seats.Player1} onTypeChange={(type) => handleSeatTypeChange('Player1', type)} onColorChange={(c) => handleSeatColorChange('Player1', c)} onNameChange={(n) => handleSeatNameChange('Player1', n)} onClaim={handleClaimSeat} activeColors={activeColors} isHost={isHost} isOnline={!!activeLobbyId} userUid={user?.uid} t={t} hasClaimedSeat={hasClaimedSeat} lobbyStatus={lobbyStatus} isLobbyPublic={isLobbyPublic} />
                 <SeatCard id="Player2" label={`${t('player', 'Player')} 2`} seat={seats.Player2} onTypeChange={(type) => handleSeatTypeChange('Player2', type)} onColorChange={(c) => handleSeatColorChange('Player2', c)} onNameChange={(n) => handleSeatNameChange('Player2', n)} onClaim={handleClaimSeat} activeColors={activeColors} isHost={isHost} isOnline={!!activeLobbyId} userUid={user?.uid} t={t} hasClaimedSeat={hasClaimedSeat} lobbyStatus={lobbyStatus} isLobbyPublic={isLobbyPublic} />
              </div>
            </div>

            <div className="flex flex-col gap-2 w-full mt-4">
            {isHost ? (
                <button onClick={handleStartOnlineMatch} className="w-full py-4 flex items-center justify-center gap-2 bg-gold text-charcoal font-display font-bold text-lg rounded-xl shadow-[0_0_15px_rgba(251,191,36,0.4)] hover:bg-yellow-400 hover:scale-[1.02] transition-all">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {t('enterMatch', 'START MATCH')}
                </button>
            ) : (
                <div className="w-full py-4 bg-white/5 text-white/60 flex items-center justify-center gap-2 font-sans font-bold text-sm tracking-widest uppercase rounded-xl border border-white/5">
                  <svg className="animate-spin h-5 w-5 text-white/60" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Waiting for Host...
                </div>
            )}
              <button onClick={() => window.location.href = '/'} className="w-full py-3 bg-transparent text-white/40 hover:text-white flex items-center justify-center gap-2 font-sans text-xs font-semibold rounded-xl transition-colors uppercase tracking-widest">
                Leave Lobby
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default UnifiedLobby;