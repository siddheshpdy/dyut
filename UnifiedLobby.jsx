import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';
import { doc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

const ALL_COLORS = [
  { name: 'ruby', tw: 'bg-ruby' },
  { name: 'sapphire', tw: 'bg-sapphire' },
  { name: 'emerald', tw: 'bg-emerald' },
  { name: 'amber', tw: 'bg-amber' },
];

const SeatCard = ({ id, label, seat, onTypeChange, onColorChange, onNameChange, activeColors, t }) => {
  const isActive = seat.type !== 'closed';
  const typeColor = seat.type === 'human' ? 'text-gold bg-gold/10 border-gold/30' : seat.type === 'bot' ? 'text-sapphire bg-sapphire/10 border-sapphire/30' : 'text-white/40 bg-white/5 border-white/10';

  return (
    <div className={`flex flex-col items-center bg-black/40 p-3 rounded-xl border transition-all ${isActive ? 'border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.5)]' : 'border-transparent opacity-50 hover:opacity-80'}`}>
      <span className="text-[9px] text-white/50 uppercase tracking-widest mb-1.5 whitespace-nowrap">{label}</span>
      
      <div className="relative w-full">
        <select 
          value={seat.type} 
          onChange={(e) => onTypeChange(e.target.value)}
          className={`w-full py-1.5 px-2 appearance-none rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors cursor-pointer text-center outline-none ${typeColor}`}
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
        value={seat.name || ''}
        onChange={(e) => onNameChange(e.target.value)}
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
              onClick={() => !isTaken && onColorChange(color.name)}
              className={`w-5 h-5 rounded-full ${color.tw} jewel-shadow transition-all ${seat.color === color.name ? 'ring-2 ring-white ring-offset-2 ring-offset-charcoal scale-125 z-10' : isTaken ? 'opacity-20 cursor-not-allowed' : 'opacity-60 hover:opacity-100 hover:scale-110'}`}
              title={color.name}
            />
          );
        })}
      </div>
    </div>
  );
};

const UnifiedLobby = ({ onStartGame, onResumeGame, onShowRules, hasCachedGame, joinGameId, user }) => {
  const [seats, setSeats] = useState({
    Player4: { type: 'closed', color: 'amber', name: '' },
    Player3: { type: 'closed', color: 'emerald', name: '' },
    Player1: { type: 'human', color: 'ruby', name: '' },
    Player2: { type: 'bot', color: 'sapphire', name: '' }
  });
  const [botDifficulty, setBotDifficulty] = useState('hard');
  const [isVoidRuleEnabled, setIsVoidRuleEnabled] = useState(true);
  const [isQuickGame, setIsQuickGame] = useState(false);
  const [isTeamMode, setIsTeamMode] = useState(false);
  const [pendingGameId, setPendingGameId] = useState(null);
  const [isCopied, setIsCopied] = useState(false);

  const { t } = useTranslation();

  const activeLobbyId = joinGameId || pendingGameId;
  const isHost = activeLobbyId && pendingGameId !== null;

  const activeSeats = Object.entries(seats).filter(([_, s]) => s.type !== 'closed');
  const playerCount = activeSeats.length;
  const botCount = activeSeats.filter(([_, s]) => s.type === 'bot').length;
  const activeColors = activeSeats.map(([_, s]) => s.color);

  useEffect(() => {
    if (!activeLobbyId) return;
    const unsub = onSnapshot(doc(db, 'lobbies', activeLobbyId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.seats) setSeats(data.seats);
        if (data.botDifficulty !== undefined) setBotDifficulty(data.botDifficulty);
        if (data.isVoidRuleEnabled !== undefined) setIsVoidRuleEnabled(data.isVoidRuleEnabled);
        if (data.isQuickGame !== undefined) setIsQuickGame(data.isQuickGame);
        if (data.isTeamMode !== undefined) setIsTeamMode(data.isTeamMode);

        // If the host starts the game, instantly pull joiners into the match
        if (data.gameStarted && joinGameId) {
          executeStart(true, activeLobbyId, data);
        }
      }
    });
    return () => unsub();
  }, [activeLobbyId, joinGameId]);

  const pushUpdate = async (field, value) => {
    if (activeLobbyId) {
      try { await updateDoc(doc(db, 'lobbies', activeLobbyId), { [field]: value }); } 
      catch (e) { console.error("Sync error:", e); }
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

  useEffect(() => {
    if (playerCount !== 4) setIsTeamMode(false); // Team mode strictly 2v2
  }, [playerCount]);

  const executeStart = (isOnline = false, targetGameId = null, overrideData = null) => {
    const currentSeats = overrideData?.seats || seats;
    const currentActiveSeats = Object.entries(currentSeats).filter(([_, s]) => s.type !== 'closed');
    const currentActiveColors = currentActiveSeats.map(([_, s]) => s.color);
    
    if (!overrideData) { // Only validate if we are initiating the start locally
      if (currentActiveSeats.length < 2) return alert("Need at least 2 players.");
      if (currentActiveSeats.filter(([_, s]) => s.type === 'human').length === 0) return alert("Need at least 1 human player.");
      if (new Set(currentActiveColors).size !== currentActiveColors.length) return alert("Each active player must have a unique color.");
    }

    const activeSeatIds = currentActiveSeats.map(([id]) => id).sort();
    const bots = currentActiveSeats.filter(([_, s]) => s.type === 'bot').map(([id]) => id);
    const playerColors = activeSeatIds.map(id => currentSeats[id].color);
    
    const playerAliases = {};
    activeSeatIds.forEach(id => {
      playerAliases[id] = currentSeats[id].name.trim() || (currentSeats[id].type === 'bot' ? `${t('bot', 'Bot')} ${id.replace('Player', '')}` : `${t('player', 'Player')} ${id.replace('Player', '')}`);
    });

    onStartGame({ 
      playerCount: activeSeatIds.length, activeSeats: activeSeatIds, playerColors, playerAliases, 
      isVoidRuleEnabled: overrideData?.isVoidRuleEnabled ?? isVoidRuleEnabled, bots, botDifficulty: overrideData?.botDifficulty ?? botDifficulty, 
      isQuickGame: overrideData?.isQuickGame ?? isQuickGame, isTeamMode: overrideData?.isTeamMode ?? isTeamMode, isOnline, gameId: targetGameId,
      hostUid: overrideData?.hostUid || user?.uid, localUid: user?.uid
    });
  };

  const handleHostOnlineClick = async () => {
    if (playerCount < 2) return alert("Need at least 2 players.");
    if (activeSeats.filter(([_, s]) => s.type === 'human').length === 0) return alert("Need at least 1 human player.");
    if (new Set(activeColors).size !== activeColors.length) return alert("Each active player must have a unique color.");

    const newGameId = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    await setDoc(doc(db, 'lobbies', newGameId), {
      seats, botDifficulty, isVoidRuleEnabled, isQuickGame, isTeamMode, hostUid: user?.uid, gameStarted: false
    });

    setPendingGameId(newGameId);
  };

  const handleStartOnlineMatch = async () => {
    await pushUpdate('gameStarted', true);
    executeStart(true, activeLobbyId);
  };

  return (
    <div className="glass-panel p-8 rounded-3xl w-full max-w-lg flex flex-col items-center relative z-10">
      <LanguageSwitcher />

      {activeLobbyId && (
        <div className="w-full bg-black/40 border border-white/10 rounded-xl p-4 mb-8 flex flex-col items-center animate-fade-in">
          <span className="text-gold font-bold text-sm tracking-widest uppercase mb-3">{t('onlineLobby', 'Online Lobby')} - ID: {activeLobbyId}</span>
          <div className="flex w-full gap-2">
            <input type="text" readOnly value={`${window.location.origin}?join=${activeLobbyId}`} className="flex-1 bg-black/60 border border-white/5 text-white/80 font-sans text-xs px-3 py-2 rounded-lg focus:outline-none" />
            <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}?join=${activeLobbyId}`); setIsCopied(true); setTimeout(() => setIsCopied(false), 2000); }} className="bg-white/10 px-4 py-2 rounded-lg text-xs font-bold text-white hover:bg-white/20 transition-colors">{isCopied ? t('copied', 'Copied!') : t('copy', 'Copy')}</button>
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
             <SeatCard id="Player4" label={`${t('player', 'Player')} 4`} seat={seats.Player4} onTypeChange={(type) => handleSeatTypeChange('Player4', type)} onColorChange={(c) => handleSeatColorChange('Player4', c)} onNameChange={(n) => handleSeatNameChange('Player4', n)} activeColors={activeColors} t={t} />
             {/* Player 3 (Top Right) */}
             <SeatCard id="Player3" label={`${t('player', 'Player')} 3`} seat={seats.Player3} onTypeChange={(type) => handleSeatTypeChange('Player3', type)} onColorChange={(c) => handleSeatColorChange('Player3', c)} onNameChange={(n) => handleSeatNameChange('Player3', n)} activeColors={activeColors} t={t} />
             {/* Player 1 (Bottom Left) */}
             <SeatCard id="Player1" label={`${t('player', 'Player')} 1`} seat={seats.Player1} onTypeChange={(type) => handleSeatTypeChange('Player1', type)} onColorChange={(c) => handleSeatColorChange('Player1', c)} onNameChange={(n) => handleSeatNameChange('Player1', n)} activeColors={activeColors} t={t} />
             {/* Player 2 (Bottom Right) */}
             <SeatCard id="Player2" label={`${t('player', 'Player')} 2`} seat={seats.Player2} onTypeChange={(type) => handleSeatTypeChange('Player2', type)} onColorChange={(c) => handleSeatColorChange('Player2', c)} onNameChange={(n) => handleSeatNameChange('Player2', n)} activeColors={activeColors} t={t} />
          </div>
        </div>

        {/* Bot Difficulty (Only show if bots are enabled) */}
        {botCount > 0 && (
          <div className="animate-fade-in">
            <h2 className="text-white/70 text-xs uppercase tracking-widest mb-3 text-center font-semibold">{t('botDifficulty')}</h2>
            <div className="flex justify-center gap-4">
              <button onClick={() => {
                setBotDifficulty('easy'); pushUpdate('botDifficulty', 'easy');
              }} className={`px-6 py-2 rounded-xl font-sans text-sm font-bold transition-all duration-300 ${botDifficulty === 'easy' ? 'bg-emerald text-charcoal scale-110 shadow-[0_0_15px_rgba(74,222,128,0.4)]' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                {t('easy')}
              </button>
              <button onClick={() => {
                setBotDifficulty('hard'); pushUpdate('botDifficulty', 'hard');
              }} className={`px-6 py-2 rounded-xl font-sans text-sm font-bold transition-all duration-300 ${botDifficulty === 'hard' ? 'bg-ruby text-white scale-110 shadow-[0_0_15px_rgba(244,63,94,0.4)]' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                {t('hard')}
              </button>
            </div>
          </div>
        )}

        {/* Rules Toggle */}
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="flex items-center gap-3">
            <input type="checkbox" id="void-rule" checked={isVoidRuleEnabled} onChange={(e) => setIsVoidRuleEnabled(e.target.checked)} className="w-5 h-5 accent-gold cursor-pointer" />
            <label htmlFor="void-rule" className="text-white/80 font-sans text-sm cursor-pointer hover:text-white transition-colors">{t('enableVoidRule')}</label>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="quick-game" checked={isQuickGame} onChange={(e) => {
              setIsQuickGame(e.target.checked);
              if (e.target.checked) setIsTeamMode(false);
            }} className="w-5 h-5 accent-gold cursor-pointer" />
            <label htmlFor="quick-game" className="text-white/80 font-sans text-sm cursor-pointer hover:text-white transition-colors">{t('quickGame')}</label>
          </div>
          {playerCount === 4 && (
            <div className="flex items-center gap-3">
              <input type="checkbox" id="team-mode" checked={isTeamMode} onChange={(e) => {
                setIsTeamMode(e.target.checked);
                if (e.target.checked) setIsQuickGame(false);
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
            <button onClick={handleHostOnlineClick} className="w-full py-3 bg-sapphire text-white font-display font-bold text-lg rounded-xl shadow-[0_0_15px_rgba(56,189,248,0.4)] hover:bg-blue-400 hover:scale-[1.02] transition-all">{t('hostOnlineMatch', 'HOST ONLINE MATCH')}</button>
            {hasCachedGame && <button onClick={onResumeGame} className="w-full py-3 bg-white/5 text-white font-sans text-sm font-semibold rounded-xl border border-white/10 hover:bg-white/10 transition-colors">{t('resumeSession')}</button>}
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