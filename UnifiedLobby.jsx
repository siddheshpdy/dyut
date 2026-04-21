import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';
import { doc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebaseSetup.js';
import { findRandomPublicGame } from './matchmaking.js';

const ALL_COLORS = [
  { name: 'ruby', tw: 'bg-ruby' },
  { name: 'sapphire', tw: 'bg-sapphire' },
  { name: 'emerald', tw: 'bg-emerald' },
  { name: 'amber', tw: 'bg-amber' },
];

const SeatCard = ({ id, label, seat, onTypeChange, onColorChange, onNameChange, onClaim, activeColors, isHost, isOnline, userUid, t, hasClaimedSeat, lobbyStatus }) => {
  const isActive = seat.type !== 'closed';
  const isBot = seat.type === 'bot';
  const typeColor = seat.type === 'human' ? 'text-gold bg-gold/10 border-gold/30' : seat.type === 'bot' ? 'text-sapphire bg-sapphire/10 border-sapphire/30' : 'text-white/40 bg-white/5 border-white/10';
  
  const isOwnedByMe = seat.uid === userUid;
  const editable = !isOnline || isOwnedByMe || (isBot && isHost);

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
    <div className={`flex flex-col items-center bg-black/40 p-3 rounded-xl border transition-all ${isActive ? 'border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.5)]' : 'border-transparent opacity-50 hover:opacity-80'}`}>
      <span className="text-[9px] text-white/50 uppercase tracking-widest mb-1.5 whitespace-nowrap">{label}</span>
      
      <div className="relative w-full">
        <select 
          value={seat.type} 
          onChange={(e) => onTypeChange(e.target.value)}
          disabled={isOnline && !isHost}
          className={`w-full py-1.5 px-2 appearance-none rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${isOnline && !isHost ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'} text-center outline-none ${typeColor}`}
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

      <div className={`flex gap-1.5 mt-3 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
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

      {isOnline && !seat.uid && !hasClaimedSeat && lobbyStatus === 'waiting' && (
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
    const newSeats = { ...seats, [playerId]: { ...seats[playerId], type: 'human', uid: user.uid } };
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
      hostUid: overrideData?.hostUid || user?.uid || null, localUid: user?.uid || null
    });
  };

  const handleHostOnlineClick = async (isPublicLobby = false) => {
    const isPublic = typeof isPublicLobby === 'boolean' ? isPublicLobby : false;
    
    const newSeats = { ...seats };
    if (isPublic) {
      Object.keys(newSeats).forEach(k => {
        newSeats[k] = { ...newSeats[k], type: 'human', uid: null };
      });
    }
    
    const currentActiveSeats = Object.values(newSeats).filter(s => s.type !== 'closed');
    const humanCount = currentActiveSeats.filter(s => s.type === 'human').length;
    const botCountLocal = currentActiveSeats.filter(s => s.type === 'bot').length;
    const activeCols = currentActiveSeats.map(s => s.color);

    if (humanCount < 2) return alert(t('onlineHumansRequired', "Online games require at least 2 human players."));
    if (currentActiveSeats.length === 4 && botCountLocal > 1) return alert(t('maxOneBotInFourPlayer', "Maximum 1 bot allowed in a 4-player game."));
    if (new Set(activeCols).size !== activeCols.length) return alert("Each active player must have a unique color.");

    setIsHosting(true);
    const newGameId = Math.random().toString(36).substring(2, 8).toUpperCase();

    const preferredOrder = ['Player1', 'Player2', 'Player3', 'Player4'];
    const firstHuman = preferredOrder.find(id => newSeats[id].type === 'human');
    if (firstHuman) {
      newSeats[firstHuman].uid = user?.uid || null;
    }
    
    const expiresAt = isPublic ? Date.now() + 60000 : null; // 60 second matchmaking timer

    try {
      await setDoc(doc(db, 'lobbies', newGameId), {
        seats: newSeats, botDifficulty, isVoidRuleEnabled, isQuickGame, isTeamMode, hostUid: user?.uid || null, gameStarted: false,
        isPublic, status: 'waiting', expiresAt
      });
  
      setSeats(newSeats);
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
    const availableGameId = await findRandomPublicGame();

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
      
      <h1 className="font-display text-5xl font-bold mb-8 tracking-widest text-glow-gold text-gold">DYUT</h1>
      
      <div className="w-full space-y-8">
        {/* Seat Arrangement */}
        <div className="w-full flex flex-col items-center">
          <h2 className="text-white/70 text-xs uppercase tracking-widest mb-4 text-center font-semibold">{t('seatArrangement', 'Seat Arrangement')}</h2>
          
          <div className="grid grid-cols-2 gap-4 w-full max-w-[280px]">
             {/* Player 4 (Top Left) */}
             <SeatCard id="Player4" label={`${t('player', 'Player')} 4`} seat={seats.Player4} onTypeChange={(type) => handleSeatTypeChange('Player4', type)} onColorChange={(c) => handleSeatColorChange('Player4', c)} onNameChange={(n) => handleSeatNameChange('Player4', n)} onClaim={handleClaimSeat} activeColors={activeColors} isHost={isHost} isOnline={!!activeLobbyId} userUid={user?.uid} t={t} />
             {/* Player 3 (Top Right) */}
             <SeatCard id="Player3" label={`${t('player', 'Player')} 3`} seat={seats.Player3} onTypeChange={(type) => handleSeatTypeChange('Player3', type)} onColorChange={(c) => handleSeatColorChange('Player3', c)} onNameChange={(n) => handleSeatNameChange('Player3', n)} onClaim={handleClaimSeat} activeColors={activeColors} isHost={isHost} isOnline={!!activeLobbyId} userUid={user?.uid} t={t} />
             {/* Player 1 (Bottom Left) */}
             <SeatCard id="Player1" label={`${t('player', 'Player')} 1`} seat={seats.Player1} onTypeChange={(type) => handleSeatTypeChange('Player1', type)} onColorChange={(c) => handleSeatColorChange('Player1', c)} onNameChange={(n) => handleSeatNameChange('Player1', n)} onClaim={handleClaimSeat} activeColors={activeColors} isHost={isHost} isOnline={!!activeLobbyId} userUid={user?.uid} t={t} />
             {/* Player 2 (Bottom Right) */}
             <SeatCard id="Player2" label={`${t('player', 'Player')} 2`} seat={seats.Player2} onTypeChange={(type) => handleSeatTypeChange('Player2', type)} onColorChange={(c) => handleSeatColorChange('Player2', c)} onNameChange={(n) => handleSeatNameChange('Player2', n)} onClaim={handleClaimSeat} activeColors={activeColors} isHost={isHost} isOnline={!!activeLobbyId} userUid={user?.uid} t={t} />
          </div>
        </div>

        {/* Bot Difficulty (Only show if bots are enabled) */}
        {botCount > 0 && (
          <div className="animate-fade-in">
            <h2 className="text-white/70 text-xs uppercase tracking-widest mb-3 text-center font-semibold">{t('botDifficulty')}</h2>
            <div className="flex justify-center gap-4">
              <button disabled={!!activeLobbyId && !isHost} onClick={() => {
                setBotDifficulty('easy'); pushUpdate('botDifficulty', 'easy');
              }} className={`px-6 py-2 rounded-xl font-sans text-sm font-bold transition-all duration-300 ${botDifficulty === 'easy' ? 'bg-emerald text-charcoal scale-110 shadow-[0_0_15px_rgba(74,222,128,0.4)]' : 'bg-white/10 text-white hover:bg-white/20'} disabled:opacity-70 disabled:cursor-not-allowed`}>
                {t('easy')}
              </button>
              <button disabled={!!activeLobbyId && !isHost} onClick={() => {
                setBotDifficulty('hard'); pushUpdate('botDifficulty', 'hard');
              }} className={`px-6 py-2 rounded-xl font-sans text-sm font-bold transition-all duration-300 ${botDifficulty === 'hard' ? 'bg-ruby text-white scale-110 shadow-[0_0_15px_rgba(244,63,94,0.4)]' : 'bg-white/10 text-white hover:bg-white/20'} disabled:opacity-70 disabled:cursor-not-allowed`}>
                {t('hard')}
              </button>
            </div>
          </div>
        )}

        {/* Rules Toggle */}
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="flex items-center gap-3">
            <input type="checkbox" id="void-rule" disabled={!!activeLobbyId && !isHost} checked={isVoidRuleEnabled} onChange={(e) => {
              setIsVoidRuleEnabled(e.target.checked);
              pushUpdate('isVoidRuleEnabled', e.target.checked);
            }} className="w-5 h-5 accent-gold cursor-pointer" />
            <label htmlFor="void-rule" className="text-white/80 font-sans text-sm cursor-pointer hover:text-white transition-colors">{t('enableVoidRule')}</label>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="quick-game" disabled={!!activeLobbyId && !isHost} checked={isQuickGame} onChange={(e) => {
              setIsQuickGame(e.target.checked);
              pushUpdate('isQuickGame', e.target.checked);
              if (e.target.checked) {
                setIsTeamMode(false);
                pushUpdate('isTeamMode', false);
              }
            }} className="w-5 h-5 accent-gold cursor-pointer" />
            <label htmlFor="quick-game" className="text-white/80 font-sans text-sm cursor-pointer hover:text-white transition-colors">{t('quickGame')}</label>
          </div>
          {playerCount === 4 && (
            <div className="flex items-center gap-3">
              <input type="checkbox" id="team-mode" disabled={!!activeLobbyId && !isHost} checked={isTeamMode} onChange={(e) => {
                setIsTeamMode(e.target.checked);
                pushUpdate('isTeamMode', e.target.checked);
                if (e.target.checked) {
                  setIsQuickGame(false);
                  pushUpdate('isQuickGame', false);
                }
              }} className="w-5 h-5 accent-gold cursor-pointer" />
              <label htmlFor="team-mode" className="text-white/80 font-sans text-sm cursor-pointer hover:text-white transition-colors">{t('teamMode')}</label>
            </div>
          )}
        </div>
      </div>

      <div className="mt-10 w-full flex flex-col gap-3">
        {!activeLobbyId ? (
          <>
            <button onClick={() => executeStart(false)} className="w-full py-3 bg-gold text-charcoal font-display font-bold text-lg rounded-xl shadow-[0_0_15px_rgba(251,191,36,0.4)] hover:bg-yellow-400 hover:scale-[1.02] transition-all">{t('startNewGame')}</button>
            
            <button onClick={handleFindMatch} disabled={isSearching || isHosting} className="w-full py-3 flex items-center justify-center gap-2 bg-emerald text-charcoal font-display font-bold text-lg rounded-xl shadow-[0_0_15px_rgba(52,211,153,0.4)] hover:bg-emerald-400 hover:scale-[1.02] disabled:opacity-70 disabled:scale-100 disabled:cursor-not-allowed transition-all">
              {isSearching ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-charcoal" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('searching', 'SEARCHING...')}
                </>
              ) : (
                t('findRandomMatch', 'FIND RANDOM MATCH')
              )}
            </button>

            <button onClick={() => handleHostOnlineClick(false)} disabled={isHosting || isSearching} className="w-full py-3 flex items-center justify-center gap-2 bg-sapphire text-white font-display font-bold text-lg rounded-xl shadow-[0_0_15px_rgba(56,189,248,0.4)] hover:bg-blue-400 hover:scale-[1.02] disabled:opacity-70 disabled:scale-100 disabled:cursor-not-allowed transition-all">
              {isHosting ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('hostingMatch', 'HOSTING...')}
                </>
              ) : (
                t('hostOnlineMatch', 'HOST PRIVATE MATCH')
              )}
            </button>
          {hasCachedGame && <button onClick={onResumeGame} className="w-full py-3 bg-white/5 text-white font-sans text-sm font-semibold rounded-xl border border-white/10 hover:bg-white/10 transition-colors">{t('resumeOffline', 'Resume Offline Match')}</button>}
          {lastOnlineGameId && <button onClick={() => onReconnectOnline(lastOnlineGameId)} className="w-full py-3 bg-white/5 text-sapphire font-sans text-sm font-semibold rounded-xl border border-white/10 hover:bg-white/10 transition-colors">{t('reconnectOnline', 'Reconnect Online')} ({lastOnlineGameId})</button>}
          </>
        ) : (
          <>
            {isHost ? (
              <button onClick={handleStartOnlineMatch} className="w-full py-3 bg-gold text-charcoal font-display font-bold text-lg rounded-xl shadow-[0_0_15px_rgba(251,191,36,0.4)] hover:bg-yellow-400 hover:scale-[1.02] transition-all">{t('enterMatch', 'Start Match')}</button>
            ) : (
              <div className="w-full py-3 bg-white/10 text-white/60 text-center font-sans font-bold text-sm tracking-widest uppercase rounded-xl border border-white/5">Waiting for Host...</div>
            )}
            <button onClick={() => window.location.href = '/'} className="w-full py-3 bg-transparent text-white/50 hover:text-white font-sans text-sm font-semibold rounded-xl transition-colors">Leave Lobby</button>
          </>
        )}
      </div>
    </div>
  );
};
export default UnifiedLobby;