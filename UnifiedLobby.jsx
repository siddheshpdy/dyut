import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';
import { doc, onSnapshot } from 'firebase/firestore';
import { ref as rtdbRef, onValue, set as rtdbSet, update as rtdbUpdate, get as rtdbGet, remove as rtdbRemove } from 'firebase/database';
import { db, rtdb, signInWithGoogle, logoutUser, updateUserName } from './firebaseSetup.js';
import { findRandomPublicGame } from './matchmaking.js';
import { DYUT_ICONS } from './dyut-icons';

const ALL_COLORS = [
  { name: 'ruby', tw: 'bg-ruby' },
  { name: 'sapphire', tw: 'bg-sapphire' },
  { name: 'emerald', tw: 'bg-emerald' },
  { name: 'amber', tw: 'bg-amber' },
];

const CRAZYGAMES_ADS_ENABLED = import.meta.env.VITE_CG_ENABLE_ADS === 'true';

const OrnateDivider = () => (
  <div className="flex items-center justify-center gap-3 text-gold/60">
    <span className="h-px w-16 bg-gradient-to-r from-transparent via-gold/70 to-gold/20"></span>
    <span className="h-2 w-2 rotate-45 border border-gold/70"></span>
    <span className="h-px w-16 bg-gradient-to-l from-transparent via-gold/70 to-gold/20"></span>
  </div>
);

const LobbyModeCard = ({ tone, icon, title, description, onClick, disabled = false }) => {
  const toneStyles = {
    gold: {
      text: 'text-gold',
      border: 'border-gold/55',
      glow: 'shadow-[0_0_28px_rgba(234,179,8,0.18)]',
      wash: 'from-gold/20 via-gold/10 to-transparent',
      icon: 'border-gold/60 bg-gold/15 text-gold shadow-[0_0_22px_rgba(234,179,8,0.22)]',
    },
    ruby: {
      text: 'text-ruby',
      border: 'border-ruby/55',
      glow: 'shadow-[0_0_28px_rgba(220,38,38,0.16)]',
      wash: 'from-ruby/20 via-ruby/10 to-transparent',
      icon: 'border-ruby/60 bg-ruby/15 text-ruby shadow-[0_0_22px_rgba(220,38,38,0.22)]',
    },
    sapphire: {
      text: 'text-sapphire',
      border: 'border-sapphire/55',
      glow: 'shadow-[0_0_28px_rgba(56,189,248,0.14)]',
      wash: 'from-sapphire/20 via-sapphire/10 to-transparent',
      icon: 'border-sapphire/60 bg-sapphire/15 text-sapphire shadow-[0_0_22px_rgba(56,189,248,0.2)]',
    },
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-[18px] border bg-black/45 p-3 text-left transition-all duration-300 sm:gap-5 sm:p-4 lg:gap-4 lg:p-3 ${disabled ? 'cursor-not-allowed opacity-70' : 'hover:-translate-y-0.5 hover:bg-black/65'} ${toneStyles.border} ${toneStyles.glow}`}
    >
      <div className={`absolute inset-0 rounded-[18px] bg-gradient-to-r ${toneStyles.wash} opacity-80 transition-opacity group-hover:opacity-100`}></div>
      <div className="absolute inset-y-3 right-8 hidden w-44 rounded bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.13),transparent_62%)] opacity-35 sm:block"></div>
      <div className={`relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border text-2xl sm:h-20 sm:w-20 sm:text-4xl lg:h-[4.25rem] lg:w-[4.25rem] lg:text-[2rem] ${toneStyles.icon}`}>
        {icon}
      </div>
      <div className="relative z-10 min-w-0 flex-1">
        <div className={`font-display text-lg font-bold uppercase tracking-[0.08em] sm:text-2xl lg:text-[1.85rem] ${toneStyles.text}`}>{title}</div>
        <p className="mt-1 text-sm leading-snug text-white/70 sm:text-base lg:text-[0.88rem]">{description}</p>
      </div>
      <div className={`relative z-10 pr-2 font-display text-4xl transition-transform group-hover:translate-x-1 lg:text-[2.25rem] ${toneStyles.text}`}>{'>'}</div>
    </button>
  );
};

const ConfigSectionTitle = ({ children }) => (
  <div className="flex w-full items-center justify-center gap-3 text-gold/80 lg:gap-2">
    <span className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/40 to-gold/70"></span>
    <span className="h-1.5 w-1.5 rotate-45 border border-gold/70 lg:h-1 lg:w-1"></span>
    <span className="font-display text-xs font-bold uppercase tracking-[0.22em] sm:text-sm lg:text-[0.68rem]">{children}</span>
    <span className="h-1.5 w-1.5 rotate-45 border border-gold/70 lg:h-1 lg:w-1"></span>
    <span className="h-px flex-1 bg-gradient-to-l from-transparent via-gold/40 to-gold/70"></span>
  </div>
);

const ConfigChoiceCard = ({ active, tone = 'gold', icon, title, subtitle, children, onClick, className = '' }) => {
  const toneClasses = {
    gold: active
      ? 'border-gold bg-gold/18 text-gold shadow-[0_0_24px_rgba(234,179,8,0.28),inset_0_0_30px_rgba(234,179,8,0.12)]'
      : 'border-gold/35 bg-black/35 text-gold/65 hover:border-gold/70 hover:text-gold',
    sapphire: active
      ? 'border-sapphire bg-sapphire/18 text-sapphire shadow-[0_0_24px_rgba(56,189,248,0.28),inset_0_0_30px_rgba(56,189,248,0.12)]'
      : 'border-sapphire/35 bg-black/35 text-sapphire/65 hover:border-sapphire/70 hover:text-sapphire',
    emerald: active
      ? 'border-emerald bg-emerald/18 text-emerald shadow-[0_0_24px_rgba(52,211,153,0.24),inset_0_0_30px_rgba(52,211,153,0.1)]'
      : 'border-emerald/35 bg-black/35 text-emerald/65 hover:border-emerald/70 hover:text-emerald',
    ruby: active
      ? 'border-ruby bg-ruby/18 text-ruby shadow-[0_0_24px_rgba(220,38,38,0.28),inset_0_0_30px_rgba(220,38,38,0.12)]'
      : 'border-ruby/35 bg-black/35 text-ruby/65 hover:border-ruby/70 hover:text-ruby',
    violet: active
      ? 'border-purple-400 bg-purple-500/15 text-purple-300 shadow-[0_0_24px_rgba(168,85,247,0.25),inset_0_0_30px_rgba(168,85,247,0.1)]'
      : 'border-purple-400/35 bg-black/35 text-purple-300/65 hover:border-purple-300/70 hover:text-purple-200',
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl border p-3 text-center transition-all duration-300 hover:-translate-y-0.5 sm:p-4 lg:p-2.5 ${toneClasses} ${className}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_10%,rgba(255,255,255,0.12),transparent_38%)] opacity-70"></div>
      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-1.5 lg:gap-1 [&_svg]:lg:h-5 [&_svg]:lg:w-5">
        {children}
        {icon && (
          <span className={`mt-1 flex h-9 w-9 items-center justify-center rounded-full border border-current/30 bg-black/20 sm:h-11 sm:w-11 lg:mt-0.5 lg:h-7 lg:w-7 ${active ? 'opacity-100' : 'opacity-50'}`}>
            {icon}
          </span>
        )}
        <div className="font-display text-lg font-bold uppercase tracking-wider sm:text-xl lg:text-[0.95rem]">{title}</div>
        {subtitle && <div className="hidden text-xs leading-snug text-white/70 sm:block sm:text-sm lg:text-[0.7rem] lg:leading-tight">{subtitle}</div>}
      </div>
    </button>
  );
};

const SeatCard = ({ id, label, seat, onTypeChange, onColorChange, onNameChange, onClaim, activeColors, isHost, isOnline, userUid, t, hasClaimedSeat, lobbyStatus, isLobbyPublic }) => {
  const isActive = seat.type !== 'closed';
  const isBot = seat.type === 'bot';
  const typeColor = seat.type === 'human' ? 'text-gold bg-gold/10 border-gold/30' : seat.type === 'bot' ? 'text-sapphire bg-sapphire/10 border-sapphire/30' : 'text-white/40 bg-white/5 border-white/10';
  const DropdownIcon = DYUT_ICONS.dropdown;
  
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
    <div className={`flex flex-col items-center rounded-xl border p-3 transition-all lg:p-2.5 ${isActive ? (isOwnedByMe ? 'bg-black/60 border-gold shadow-[0_0_15px_rgba(251,191,36,0.4)] scale-[1.02]' : 'bg-black/40 border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.5)]') : 'bg-black/40 border-transparent opacity-50 hover:opacity-80'}`}>
      <span className={`mb-1.5 whitespace-nowrap text-[9px] font-bold uppercase tracking-widest lg:mb-1 lg:text-[8px] ${isOwnedByMe ? 'text-gold drop-shadow-md' : 'text-white/50'}`}>
        {label} {isOwnedByMe && <span className="opacity-80">({t('you', 'YOU')})</span>}
      </span>
      
      <div className="relative w-full">
        <select 
          aria-label={`Select type for ${label}`}
          value={seat.type} 
          onChange={(e) => onTypeChange(e.target.value)}
          disabled={(isOnline && !isHost) || isLobbyPublic}
          className={`w-full appearance-none rounded-lg border px-2 py-1.5 text-center text-xs font-bold uppercase tracking-wider transition-colors outline-none lg:py-1 lg:text-[11px] ${(isOnline && !isHost) || isLobbyPublic ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'} ${typeColor}`}
        >
          <option value="human" className="bg-charcoal text-gold">{t('human', 'Human')}</option>
          <option value="bot" className="bg-charcoal text-sapphire">{t('bot', 'Bot')}</option>
          <option value="closed" className="bg-charcoal text-white/50">{t('closed', 'Closed')}</option>
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-1 flex items-center px-1">
          <DropdownIcon className={`h-3 w-3 ${seat.type === 'closed' ? 'text-white/40' : seat.type === 'human' ? 'text-gold/70' : 'text-sapphire/70'}`} aria-hidden="true" />
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
          className={`mt-2 w-full rounded border border-white/10 bg-transparent py-1 text-center font-sans text-xs text-white/90 transition-opacity focus:outline-none focus:border-gold/50 lg:mt-1.5 lg:text-[11px] ${isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        />
      )}

      <div className={`mt-3 flex gap-1.5 transition-opacity lg:mt-2 ${isActive && !isUnclaimedHuman ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {ALL_COLORS.map(color => {
          const isTaken = activeColors.includes(color.name) && seat.color !== color.name;
          return (
            <button
              key={color.name}
              disabled={!editable || isTaken}
              onClick={() => !isTaken && onColorChange(color.name)}
              className={`h-5 w-5 rounded-full ${color.tw} jewel-shadow transition-all lg:h-4 lg:w-4 ${seat.color === color.name ? 'ring-2 ring-white ring-offset-2 ring-offset-charcoal scale-125 z-10' : isTaken ? 'opacity-20 cursor-not-allowed' : 'opacity-60 hover:opacity-100 hover:scale-110'}`}
              title={color.name}
            />
          );
        })}
      </div>

      {isOnline && !seat.uid && !hasClaimedSeat && lobbyStatus === 'waiting' && !isLobbyPublic && seat.type !== 'closed' && (
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
  const [cgUser, setCgUser] = useState(null);
  const { t } = useTranslation();
  const ExitIcon = DYUT_ICONS.exit;

  useEffect(() => {
    if (import.meta.env.VITE_IS_PORTAL) {
      let authListener = null;

      const fetchPortalStats = async () => {
        if (window.CrazyGames?.SDK) {
          try {
            if (window.cgInitPromise) await window.cgInitPromise;
            try {
              const systemUser = await window.CrazyGames.SDK.user.getUser();
              if (systemUser) setCgUser(systemUser);

              // Listen for users signing in from the portal's native top-bar (outside the iframe)
              authListener = (sysUser) => {
                if (sysUser) setCgUser(sysUser);
              };
              window.CrazyGames.SDK.user.addAuthListener(authListener);
            } catch (e) { console.error("CrazyGames user error:", e); }

            let data = await window.CrazyGames.SDK.data.getItem('dyut_stats');
            if (typeof data === 'string') data = JSON.parse(data);
            if (data) setStats(data);
          } catch (e) { console.error(e); }
        }
      };
      setTimeout(fetchPortalStats, 500); // Give SDK time to init
      return () => {
        if (authListener && window.CrazyGames?.SDK?.user?.removeAuthListener) {
          try { window.CrazyGames.SDK.user.removeAuthListener(authListener); } catch(e) {}
        }
      };
    }

    if (user && !user.isAnonymous) {
      const unsub = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
        if (docSnap.exists()) {
          setStats(docSnap.data());
        }
      });
      return () => unsub();
    }
  }, [user]);

  if (!user && !import.meta.env.VITE_IS_PORTAL) return <div className="h-10"></div>;

  if (import.meta.env.VITE_IS_PORTAL && !cgUser) {
    const handleCgSignIn = async () => {
      if (!window.CrazyGames?.SDK) return;
      setIsSigningIn(true);
      try {
        const systemUser = await window.CrazyGames.SDK.user.showAuthPrompt();
        if (systemUser) setCgUser(systemUser);
      } catch (e) { console.error("CrazyGames Auth error:", e); }
      setIsSigningIn(false);
    };

    return (
      <button type="button" onClick={handleCgSignIn} disabled={isSigningIn} className={`h-9 sm:h-10 flex items-center gap-1.5 sm:gap-2 bg-white/5 transition-colors border border-white/10 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full z-20 shadow-sm animate-fade-in ${isSigningIn ? 'opacity-70 cursor-wait' : 'hover:bg-white/10'}`}>
        {isSigningIn ? (
          <svg className="animate-spin w-3.5 h-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        ) : (
          <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
        )}
        <span className="text-[10px] font-bold text-white uppercase tracking-wider">{isSigningIn ? t('signingIn', 'Signing In...') : t('signInCrazyGames', 'Log in to save')}</span>
      </button>
    );
  } else if (user?.isAnonymous && !import.meta.env.VITE_IS_PORTAL) {
    const handleSignIn = () => {
      setIsSigningIn(true);
      signInWithGoogle().finally(() => {
        setIsSigningIn(false);
      });
    };

    return (
      <button type="button" onClick={handleSignIn} disabled={isSigningIn} className={`h-9 sm:h-10 flex items-center gap-1.5 sm:gap-2 bg-white/5 transition-colors border border-white/10 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full z-20 shadow-sm animate-fade-in ${isSigningIn ? 'opacity-70 cursor-wait' : 'hover:bg-white/10'}`}>
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

  const displayName = cgUser?.username || stats?.displayName || user?.displayName || (import.meta.env.VITE_IS_PORTAL ? 'Portal Player' : 'Player');
  const photoURL = cgUser?.profilePictureUrl || user?.photoURL || stats?.photoURL;

  const handleEditSave = async () => {
    if (editName.trim() && editName.trim() !== displayName) {
      if (import.meta.env.VITE_IS_PORTAL) {
        const newStats = { ...stats, displayName: editName.trim() };
        setStats(newStats);
        if (window.CrazyGames?.SDK) {
          const saveStats = async () => {
            if (window.cgInitPromise) await window.cgInitPromise;
            window.CrazyGames.SDK.data.setItem('dyut_stats', newStats).catch(console.error);
          };
          saveStats();
        }
      } else {
        await updateUserName(editName.trim());
      }
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
    <div className="h-9 sm:h-10 flex items-center justify-between gap-2 sm:gap-4 bg-black/20 border border-white/5 pl-3 pr-2 sm:pl-4 sm:pr-3 py-1.5 sm:py-2 rounded-full z-20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] animate-fade-in">
      <div className="flex items-center gap-2 sm:gap-3">
        {photoURL ? (
          <img src={photoURL} alt="Profile" className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border border-white/20 shadow-md object-cover" />
        ) : (
          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gold flex items-center justify-center text-charcoal font-bold text-xs sm:text-sm shadow-md">
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
            <div className={`flex items-center gap-1.5 ${cgUser ? '' : 'group cursor-pointer'}`} onClick={() => { if (!cgUser) { setEditName(displayName); setIsEditing(true); } }} title={cgUser ? '' : t('editName', 'Edit Name')}>
              <span className="text-[10px] sm:text-xs font-bold text-white/90 leading-none truncate max-w-[80px] sm:max-w-[120px]">{displayName}</span>
              {!cgUser && (
                <svg className="w-3 h-3 text-white/30 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              )}
            </div>
          )}
          {stats && (
            <span className="text-[10px] font-bold text-gold tracking-widest mt-1.5 leading-none drop-shadow-md">
              {stats.wins}W / {stats.gamesPlayed}P
            </span>
          )}
        </div>
      </div>
      {!import.meta.env.VITE_IS_PORTAL && (
        <button 
          onClick={logoutUser} 
          className="text-white/30 hover:text-ruby transition-colors ml-1 p-1.5 rounded-full hover:bg-white/5"
          title={t('signOut', 'Sign Out')}
        >
          <ExitIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

const UnifiedLobby = ({ onStartGame, onResumeGame, onShowRules, onShowTutorial, onShowHistory, onShowAbout, hasCachedGame, joinGameId, user, lastOnlineGameId, onReconnectOnline }) => {
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
  const [connectionStatus, setConnectionStatus] = useState('waiting');
  const [hostLastPing, setHostLastPing] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem('dyut_muted') === 'true');
  const [inviteUrl, setInviteUrl] = useState('');

  const { t } = useTranslation();

  const toggleMute = () => {
    const next = !isMuted;
    localStorage.setItem('dyut_muted', next);
    window.dispatchEvent(new CustomEvent('dyut-mute-change', { detail: next }));
  };

  const activeLobbyId = joinGameId || pendingGameId;
  const isHost = (activeLobbyId && pendingGameId !== null) || (user && lobbyHostUid === user.uid);
  const hasClaimedSeat = Object.values(seats).some(s => s.uid === user?.uid);

  const activeSeats = Object.entries(seats).filter(([_, s]) => s.type !== 'closed');
  const playerCount = activeSeats.length;
  const botCount = activeSeats.filter(([_, s]) => s.type === 'bot').length;
  const activeColors = activeSeats.map(([_, s]) => s.color);

  useEffect(() => {
    const handleMuteChange = (e) => setIsMuted(e.detail);
    window.addEventListener('dyut-mute-change', handleMuteChange);
    return () => window.removeEventListener('dyut-mute-change', handleMuteChange);
  }, []);

  useEffect(() => {
    // Wait until the anonymous authentication completes before attempting to listen to the secure database
    if (!activeLobbyId || !user) return; 
    
    setConnectionStatus('connecting');

    const unsub = onValue(rtdbRef(rtdb, 'lobbies/' + activeLobbyId), (snapshot) => {
      if (snapshot.exists()) {
        setConnectionStatus('connected');
        const data = snapshot.val();
        if (data.seats) setSeats(data.seats);
        if (data.botDifficulty !== undefined) setBotDifficulty(data.botDifficulty);
        if (data.isVoidRuleEnabled !== undefined) setIsVoidRuleEnabled(data.isVoidRuleEnabled);
        if (data.isQuickGame !== undefined) setIsQuickGame(data.isQuickGame);
        if (data.isTeamMode !== undefined) setIsTeamMode(data.isTeamMode);
        if (data.isPublic !== undefined) setIsLobbyPublic(data.isPublic);
        if (data.status !== undefined) setLobbyStatus(data.status);
        if (data.hostUid !== undefined) setLobbyHostUid(data.hostUid);
        if (data.expiresAt !== undefined) setLobbyExpiresAt(data.expiresAt);
        if (data.matchType !== undefined) setMatchType(data.matchType);
        if (data.lastPing !== undefined) setHostLastPing(data.lastPing);
        if (data.status === 'abandoned' && !isHost) {
          alert(t('hostOffline', 'The host has disconnected. Lobby closed.'));
          window.location.href = window.location.pathname;
        }

        // If the host starts the game, instantly pull joiners into the match
        if (data.gameStarted && joinGameId) {
          executeStart(true, activeLobbyId, data);
        }
      } else {
        setConnectionStatus('notFound');
      }
    }, (error) => {
      console.error("Lobby listener error:", error);
      setConnectionStatus('error: ' + error.message);
    });
    return () => unsub();
  }, [activeLobbyId, joinGameId, user]);

  useEffect(() => {
    if (!lobbyExpiresAt || !activeLobbyId || lobbyStatus !== 'waiting') {
      setTimeLeft(null);
      return;
    }
    
    const updateTimer = () => {
      const remaining = Math.floor((lobbyExpiresAt - Date.now()) / 1000);
      if (remaining <= 0) {
        setTimeLeft(0);
        return false;
      }
      setTimeLeft(remaining);
      return true;
    };

    if (updateTimer()) {
      const interval = setInterval(() => {
        if (!updateTimer()) clearInterval(interval);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [lobbyExpiresAt, activeLobbyId, lobbyStatus]);

  // Push room status updates to CrazyGames SDK for external invite link locking and portal UI
  const updateCrazyGamesRoom = async (action, targetSeats) => {
    if (import.meta.env.VITE_IS_PORTAL && window.CrazyGames?.SDK && activeLobbyId) {
      try {
        if (window.cgInitPromise) await window.cgInitPromise;
        const humanSeats = Object.values(targetSeats).filter(s => s.type === 'human');
        const claimedSeats = humanSeats.filter(s => s.uid);
        const isFull = humanSeats.length > 0 && humanSeats.length === claimedSeats.length;
        
        if (typeof window.CrazyGames.SDK.game.updateRoom === 'function') {
          window.CrazyGames.SDK.game.updateRoom({
            roomId: activeLobbyId,
            action: action === 'start' || isFull ? 'start' : 'update',
            playerCount: claimedSeats.length,
            maxPlayerCount: humanSeats.length,
            isJoinable: action !== 'start' && !isFull,
            inviteParams: { roomId: activeLobbyId }
          });
        }
      } catch (e) { console.error("CrazyGames updateRoom error:", e); }
    }
  };

  const isStartingRef = useRef(false);

  useEffect(() => {
    if (!isHost || lobbyStatus !== 'waiting' || !isLobbyPublic) return;

    const humanSeats = Object.values(seats).filter(s => s.type === 'human');
    const claimedSeats = humanSeats.filter(s => s.uid);
    const isFull = humanSeats.length > 0 && humanSeats.length === claimedSeats.length;

    if (isFull || timeLeft === 0) {
      if (isStartingRef.current) return;
      isStartingRef.current = true;

      const autoStart = async () => {
        setLobbyStatus('playing'); // Prevent multiple triggers
        const finalSeats = { ...seats };
        Object.keys(finalSeats).forEach(k => {
          if (finalSeats[k].type === 'human' && !finalSeats[k].uid) {
            finalSeats[k] = { ...finalSeats[k], type: 'bot' };
          }
        });
        try {
          await rtdbUpdate(rtdbRef(rtdb, 'lobbies/' + activeLobbyId), { status: 'playing', gameStarted: true, seats: finalSeats, openSeats: 0 });
          updateCrazyGamesRoom('start', finalSeats);
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
        const updates = { [field]: value };
        if (field === 'seats') {
          updates.openSeats = Object.values(value).filter(s => s.type === 'human' && !s.uid).length;
        }
        await rtdbUpdate(rtdbRef(rtdb, 'lobbies/' + activeLobbyId), updates); 
        if (field === 'seats') {
          updateCrazyGamesRoom('update', value);
        }
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
      let validSeatIds = ['Player1', 'Player2', 'Player3', 'Player4'];
      if (matchType === '1v1') validSeatIds = ['Player1', 'Player3'];
      
      let targetSeat = validSeatIds.find(id => seats[id].type === 'human' && !seats[id].uid);
      if (!targetSeat) targetSeat = validSeatIds.find(id => seats[id].type === 'bot' && !seats[id].uid);
      
      if (targetSeat) {
        handleClaimSeat(targetSeat);
      } else {
        alert(t('lobbyFullOrCorrupt', 'This lobby is full. Redirecting to menu...'));
        window.location.href = window.location.pathname;
      }
    }
  }, [isLobbyPublic, activeLobbyId, user, seats, lobbyStatus, hasClaimedSeat, matchType, t]);

  // Host: Send Heartbeat to keep lobby alive and setup beforeunload
  useEffect(() => {
    if (!isHost || !activeLobbyId || lobbyStatus !== 'waiting') return;

    const pushPing = () => {
      rtdbUpdate(rtdbRef(rtdb, 'lobbies/' + activeLobbyId), { lastPing: Date.now() }).catch(() => {});
    };

    pushPing();
    const pingInterval = setInterval(pushPing, 10000);

    const handleUnload = () => {
      rtdbRemove(rtdbRef(rtdb, 'lobbies/' + activeLobbyId)).catch(() => {});
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(pingInterval);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [isHost, activeLobbyId, lobbyStatus]);

  // Client: Monitor Host Heartbeat
  useEffect(() => {
    if (isHost || !activeLobbyId || lobbyStatus !== 'waiting' || !hostLastPing) return;

    const monitorInterval = setInterval(() => {
      if (Date.now() - hostLastPing > 25000) {
        alert(t('hostOffline', 'The host has disconnected. Lobby closed.'));
        window.location.href = window.location.pathname;
      }
    }, 5000);

    return () => clearInterval(monitorInterval);
  }, [isHost, activeLobbyId, lobbyStatus, hostLastPing, t]);

  useEffect(() => {
    if (playerCount !== 4) setIsTeamMode(false); // Team mode strictly 2v2
  }, [playerCount]);

  const executeStart = (isOnline = false, targetGameId = null, overrideData = null) => {
    const currentSeats = overrideData?.seats || seats;
    const currentActiveSeats = Object.entries(currentSeats).filter(([_, s]) => s.type !== 'closed');
    const currentActiveColors = currentActiveSeats.map(([_, s]) => s.color);
    const bots = currentActiveSeats.filter(([_, s]) => s.type === 'bot').map(([id]) => id);
    
    if (!overrideData) { // Only validate if we are initiating the start locally
      if (currentActiveSeats.length < 2) return alert(t('needTwoPlayers', "Need at least 2 players."));
      if (isOnline) {
        const humanCount = currentActiveSeats.filter(([_, s]) => s.type === 'human').length;
        if (humanCount < 2) return alert(t('onlineHumansRequired', "Online games require at least 2 human players."));
        if (currentActiveSeats.length === 4 && bots.length > 1) return alert(t('maxOneBotInFourPlayer', "Maximum 1 bot allowed in a 4-player game."));
        const unclaimedHumans = currentActiveSeats.filter(([_, s]) => s.type === 'human' && !s.uid).length;
        if (unclaimedHumans > 0) return alert(t('allHumansMustBeClaimed', "All human seats must be claimed before starting."));
      } else {
        if (currentActiveSeats.filter(([_, s]) => s.type === 'human').length === 0) return alert(t('needOneHuman', "Need at least 1 human player."));
      }
      if (new Set(currentActiveColors).size !== currentActiveColors.length) return alert(t('uniqueColorsRequired', "Each active player must have a unique color."));
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

  const handleHostOnlineClick = async (isPublicLobby = false, overrideConfig = null) => {
    const isPublic = typeof isPublicLobby === 'boolean' ? isPublicLobby : false;
    
    const currentMatchType = overrideConfig?.matchType || matchType;
    const currentIsQuickGame = overrideConfig?.isQuickGame ?? isQuickGame;
    const currentIsVoidRuleEnabled = overrideConfig?.isVoidRuleEnabled ?? isVoidRuleEnabled;
    const currentBotDifficulty = overrideConfig?.botDifficulty || botDifficulty;

    let newSeats = {};
    if (currentMatchType === '1v1') {
      newSeats = {
        Player4: { type: 'closed', color: 'amber', name: '', uid: null },
        Player3: { type: 'human', color: 'emerald', name: '', uid: null },
        Player1: { type: 'human', color: 'ruby', name: user?.displayName || '', uid: null },
        Player2: { type: 'closed', color: 'sapphire', name: '', uid: null }
      };
    } else {
      newSeats = {
        Player4: { type: 'human', color: 'amber', name: '', uid: null },
        Player3: { type: 'human', color: 'emerald', name: '', uid: null },
        Player1: { type: 'human', color: 'ruby', name: user?.displayName || '', uid: null },
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
    const isTeamModeLocal = (currentMatchType === '2v2');

    try {
      await rtdbSet(rtdbRef(rtdb, 'lobbies/' + newGameId), {
        seats: newSeats, botDifficulty: currentBotDifficulty, isVoidRuleEnabled: currentIsVoidRuleEnabled, isQuickGame: currentIsQuickGame, isTeamMode: isTeamModeLocal, hostUid: user?.uid || null, gameStarted: false,
        isPublic, status: 'waiting', expiresAt, matchType: currentMatchType,
        version: 2,
        lastPing: Date.now(),
        openSeats: Object.values(newSeats).filter(s => s.type === 'human' && !s.uid).length
      });
  
      setSeats(newSeats);
      setIsTeamMode(isTeamModeLocal);
      setPendingGameId(newGameId);
      
      if (overrideConfig) {
        setMatchType(currentMatchType);
        setIsQuickGame(currentIsQuickGame);
        setIsVoidRuleEnabled(currentIsVoidRuleEnabled);
      }
    } catch (error) {
      console.error("Firebase Error:", error);
      alert(t('failedToCreateLobby', "Failed to create online lobby. Please check your Firestore Security Rules in the Firebase Console!"));
    } finally {
      setIsHosting(false);
    }
  };

  const handleFindMatch = async (overrideConfig = null) => {
    setIsSearching(true);
    const currentMatchType = overrideConfig?.matchType || matchType;
    const currentIsQuickGame = overrideConfig?.isQuickGame ?? isQuickGame;
    const currentIsVoidRuleEnabled = overrideConfig?.isVoidRuleEnabled ?? isVoidRuleEnabled;

    const availableGameId = await findRandomPublicGame({
      matchType: currentMatchType,
      isQuickGame: currentIsQuickGame,
      isTeamMode: currentMatchType === '2v2',
      isVoidRuleEnabled: currentIsVoidRuleEnabled
    });

    if (availableGameId) {
      try {
        const lobbySnap = await rtdbGet(rtdbRef(rtdb, 'lobbies/' + availableGameId));
        if (lobbySnap.exists()) {
          const data = lobbySnap.val();
          if (data.matchType !== currentMatchType || (data.lastPing && Date.now() - data.lastPing > 25000)) {
            await handleHostOnlineClick(true, overrideConfig);
            setIsSearching(false);
            return;
          }
        }
      } catch (e) {
        console.error("Lobby validation failed", e);
      }

      if (overrideConfig) {
        setMatchType(currentMatchType);
        setIsQuickGame(currentIsQuickGame);
        setIsTeamMode(currentMatchType === '2v2');
        setIsVoidRuleEnabled(currentIsVoidRuleEnabled);
        setBotDifficulty(overrideConfig.botDifficulty || botDifficulty);
      }

      window.history.pushState({}, '', `?join=${availableGameId}`);
      onReconnectOnline(availableGameId);
    } else {
      // No games found. Host a new public game!
      await handleHostOnlineClick(true, overrideConfig);
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
    const updates = { status: 'playing', gameStarted: true, openSeats: 0 };
    if (finalSeats) updates.seats = finalSeats;
    try {
      await rtdbUpdate(rtdbRef(rtdb, 'lobbies/' + activeLobbyId), updates);
      updateCrazyGamesRoom('start', finalSeats || seats);
    } catch (e) { console.error(e); }
    executeStart(true, activeLobbyId, finalSeats ? { seats: finalSeats } : null);
  };

  useEffect(() => {
    if (!activeLobbyId) {
      setInviteUrl('');
      return;
    }
    const defaultUrl = `${window.location.origin}${window.location.pathname}?join=${activeLobbyId}`;
    let isMounted = true;

    if (import.meta.env.VITE_IS_PORTAL && window.CrazyGames?.SDK) {
      const fetchLink = async () => {
        try {
          if (window.cgInitPromise) await window.cgInitPromise;
          if (!isMounted) return;
          
          const link = await window.CrazyGames.SDK.game.inviteLink({ roomId: activeLobbyId });
          setInviteUrl(link || defaultUrl);
          
          // Render the native CrazyGames social invite overlay button
          window.CrazyGames.SDK.game.showInviteButton({ roomId: activeLobbyId });
        } catch(e) { setInviteUrl(defaultUrl); }
      };
      fetchLink();

      return () => {
        isMounted = false;
        try { window.CrazyGames.SDK.game.hideInviteButton(); } catch(e) {}
      };
    } else {
      setInviteUrl(defaultUrl);
    }
  }, [activeLobbyId]);

  // Request CrazyGames Banner Ad on Desktop
  useEffect(() => {
    if (import.meta.env.VITE_IS_PORTAL && CRAZYGAMES_ADS_ENABLED) {
      let isMounted = true;
      const showBanners = async () => {
        try {
          if (window.cgInitPromise) await window.cgInitPromise;
          if (!isMounted) return;
          // Only request the banners if the screen is large enough (XL Desktop) to avoid UI overlap
          if (window.innerWidth >= 1280 && window.CrazyGames?.SDK?.banner) {
            await window.CrazyGames.SDK.banner.requestBanner({
              id: 'cg-lobby-banner-left',
              width: 300,
              height: 600
            });
            await window.CrazyGames.SDK.banner.requestBanner({
              id: 'cg-lobby-banner-right',
              width: 300,
              height: 600
            });
          }
        } catch (e) { console.warn("CrazyGames banner error:", e); }
      };
      const timeoutId = setTimeout(showBanners, 500); // Give DOM time to render the containers
      return () => {
        isMounted = false;
        clearTimeout(timeoutId);
        if (window.CrazyGames?.SDK?.banner) {
          try { window.CrazyGames.SDK.banner.clearAllBanners(); } catch (e) {}
        }
      };
    }
  }, []);

  const isInitialMenu = !activeLobbyId && !setupMode;
  const isSetupConfig = !activeLobbyId && setupMode && setupStep === 'config';
  const isLobbyStage = isInitialMenu || isSetupConfig;
  const SoundIcon = isMuted ? DYUT_ICONS.soundMuted : DYUT_ICONS.soundOn;
  const MenuIcon = DYUT_ICONS.menu;
  const HowToPlayIcon = DYUT_ICONS.howToPlay;
  const RulesIcon = DYUT_ICONS.rules;
  const HistoryIcon = DYUT_ICONS.history;
  const InfoIcon = DYUT_ICONS.info;
  const ResumeIcon = DYUT_ICONS.resumeOffline;
  const BackIcon = DYUT_ICONS.back;
  const LocalModeIcon = DYUT_ICONS.battle;
  const OnlineModeIcon = DYUT_ICONS.language;
  const PrivateModeIcon = DYUT_ICONS.privateMatch;
  const PublicLobbyIcon = DYUT_ICONS.inviteFriend;
  const ReconnectIcon = DYUT_ICONS.shareMatch;
  const QuickIcon = DYUT_ICONS.quickMode;
  const EasyIcon = DYUT_ICONS.easyDifficulty;
  const HardIcon = DYUT_ICONS.hardDifficulty;
  const StartIcon = DYUT_ICONS.next;
  const configPrimaryButtonClass = "w-full rounded-xl border border-yellow-200/50 bg-gradient-to-b from-yellow-300 via-gold to-amber-700 py-3.5 font-display text-3xl font-bold uppercase tracking-widest text-charcoal shadow-[0_0_28px_rgba(234,179,8,0.36),inset_0_2px_10px_rgba(255,255,255,0.35)] transition-all hover:scale-[1.01] hover:brightness-110 disabled:scale-100 disabled:cursor-not-allowed disabled:opacity-70 sm:text-4xl lg:py-2.5 lg:text-[1.95rem]";

  return (
    <>
      {isLobbyStage && (
        <div className="fixed inset-0 z-0 overflow-hidden bg-[#070605]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(183,87,24,0.34),transparent_36%),linear-gradient(90deg,rgba(0,0,0,0.96),rgba(8,6,5,0.48)_28%,rgba(8,6,5,0.48)_72%,rgba(0,0,0,0.96))]"></div>
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-[radial-gradient(ellipse_at_center,rgba(126,32,18,0.42),transparent_58%)]"></div>
          <div className="absolute inset-x-0 bottom-0 hidden h-40 bg-[linear-gradient(0deg,rgba(108,28,14,0.34),transparent)] lg:block"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,transparent_0,rgba(0,0,0,0.08)_38%,rgba(0,0,0,0.72)_100%)]"></div>
        </div>
      )}
      {/* Top Navigation Bar */}
      <header className={`fixed top-0 left-0 z-50 flex w-full items-center justify-between gap-3 bg-transparent px-4 py-4 md:px-8 lg:grid lg:grid-cols-[auto_1fr_auto] ${isLobbyStage ? 'lg:py-4' : ''}`}>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <button onClick={toggleMute} className="text-[var(--color-text-muted)] hover:text-[var(--color-gold)] transition-colors p-1" title={isMuted ? t('unmute', 'Unmute') : t('mute', 'Mute')}>
            <SoundIcon className={`h-5 w-5 ${isMuted ? 'text-ruby' : ''}`} aria-hidden="true" />
          </button>
        </div>

        <nav className="hidden min-w-0 items-center justify-center gap-4 lg:flex xl:gap-7">
          <button onClick={onShowTutorial} className="flex items-center gap-2 whitespace-nowrap text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-gold)] font-sans text-sm font-semibold tracking-wide"><HowToPlayIcon className="h-4 w-4 shrink-0" aria-hidden="true" /><span>{t('howToPlay', 'How to Play')}</span></button>
          <button onClick={onShowRules} className="flex items-center gap-2 whitespace-nowrap text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-gold)] font-sans text-sm font-semibold tracking-wide"><RulesIcon className="h-4 w-4 shrink-0" aria-hidden="true" /><span>{t('rules', 'Rules')}</span></button>
          <button onClick={onShowHistory} className="flex items-center gap-2 whitespace-nowrap text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-gold)] font-sans text-sm font-semibold tracking-wide"><HistoryIcon className="h-4 w-4 shrink-0" aria-hidden="true" /><span>{t('history', 'History')}</span></button>
          <button onClick={onShowAbout} className="flex items-center gap-2 whitespace-nowrap text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-gold)] font-sans text-sm font-semibold tracking-wide"><InfoIcon className="h-4 w-4 shrink-0" aria-hidden="true" /><span>{t('aboutUs', 'About Us')}</span></button>
        </nav>
        
        <div className="flex items-center justify-end gap-3">
          <PlayerProfile user={user} />
          
          <div className="relative flex items-center lg:hidden">
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-[var(--color-text-muted)] hover:text-[var(--color-gold)] p-2 ml-2">
              <MenuIcon className="h-6 w-6" aria-hidden="true" />
            </button>
            {isMobileMenuOpen && (
              <div className="absolute right-0 top-12 glass-panel p-4 rounded-xl flex flex-col gap-4 min-w-[150px] shadow-2xl z-50 bg-[var(--color-panel-bg)]">
                <button onClick={() => { setIsMobileMenuOpen(false); onShowTutorial(); }} className="text-[var(--color-text-muted)] hover:text-[var(--color-gold)] font-sans text-sm font-semibold tracking-wide text-left flex items-center gap-2"><HowToPlayIcon className="h-4 w-4" aria-hidden="true" />{t('howToPlay', 'How to Play')}</button>
                <button onClick={() => { setIsMobileMenuOpen(false); onShowRules(); }} className="text-[var(--color-text-muted)] hover:text-[var(--color-gold)] font-sans text-sm font-semibold tracking-wide text-left flex items-center gap-2"><RulesIcon className="h-4 w-4" aria-hidden="true" />{t('rules', 'Rules')}</button>
                <button onClick={() => { setIsMobileMenuOpen(false); onShowHistory(); }} className="text-[var(--color-text-muted)] hover:text-[var(--color-gold)] font-sans text-sm font-semibold tracking-wide text-left flex items-center gap-2"><HistoryIcon className="h-4 w-4" aria-hidden="true" />{t('history', 'History')}</button>
                <button onClick={() => { setIsMobileMenuOpen(false); onShowAbout(); }} className="text-[var(--color-text-muted)] hover:text-[var(--color-gold)] font-sans text-sm font-semibold tracking-wide text-left flex items-center gap-2"><InfoIcon className="h-4 w-4" aria-hidden="true" />{t('aboutUs', 'About Us')}</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className={`${isLobbyStage ? `relative z-10 mx-auto flex h-[100dvh] w-full max-w-6xl flex-col items-center justify-center overflow-hidden px-4 pb-3 pt-20 sm:px-6 sm:pb-4 lg:justify-start ${isSetupConfig ? 'lg:overflow-hidden lg:pb-6 lg:pt-[4.5rem] xl:pb-8 xl:pt-[5rem]' : isInitialMenu ? 'lg:overflow-hidden lg:pb-10 lg:pt-20 xl:pb-12 xl:pt-24' : 'lg:overflow-y-auto'}` : 'glass-panel p-6 sm:p-8 rounded-3xl w-full max-w-md flex flex-col items-center relative z-10 mt-32 sm:mt-24 lg:mt-16 mx-auto'}`}>
        {activeLobbyId && (
        <div className="w-full bg-black/40 border border-white/10 rounded-xl p-4 mb-8 flex flex-col items-center animate-fade-in">
          <div className="flex items-center gap-3 mb-3">
            {isLobbyPublic ? (
              <div className="flex flex-col items-start gap-1" title="Public Lobby">
                <div className="flex items-center gap-2">
                  <PublicLobbyIcon className="h-4 w-4 text-emerald" aria-hidden="true" />
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
                <PrivateModeIcon className="h-4 w-4 text-ruby" aria-hidden="true" />
                <span className="text-gold font-bold text-sm tracking-widest uppercase">{t('privateLobby', 'PRIVATE LOBBY')} - ID: {activeLobbyId}</span>
              </div>
            )}
            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider self-start ${connectionStatus === 'connected' ? 'bg-emerald/20 text-emerald' : 'bg-ruby/20 text-white'}`}>
              {connectionStatus.startsWith('error') 
                ? connectionStatus 
                : t(`status_${connectionStatus}`, connectionStatus === 'waiting' ? 'Waiting...' : connectionStatus === 'connecting' ? 'Connecting...' : connectionStatus === 'connected' ? 'Connected' : 'Lobby not found')}
            </span>
          </div>
          <div className="flex w-full gap-2">
            <input type="text" readOnly value={inviteUrl} className="flex-1 bg-black/60 border border-white/5 text-white/80 font-sans text-xs px-3 py-2 rounded-lg focus:outline-none" />
            <button onClick={() => { navigator.clipboard.writeText(inviteUrl); setIsCopied(true); setTimeout(() => setIsCopied(false), 2000); }} className="bg-white/10 px-4 py-2 rounded-lg text-xs font-bold text-white hover:bg-white/20 transition-colors">{isCopied ? t('copied', 'Copied!') : t('copy', 'Copy')}</button>
          </div>
        </div>
      )}
      
      <h1 className={`dyut-title font-bold tracking-widest text-glow-gold text-[var(--color-gold)] ${isLobbyStage ? `${isSetupConfig ? 'mb-0.5 text-[clamp(1.85rem,3.45vw,3rem)] leading-none sm:mb-1.5 lg:mt-0' : isInitialMenu ? 'mb-1 text-[clamp(2.1rem,4vw,3.45rem)] leading-none sm:mb-2 lg:mt-0' : 'mb-1 text-[clamp(2.35rem,4.4vw,3.9rem)] leading-none sm:mb-2 lg:mt-1'}` : 'mb-8 text-5xl'}`}>DYUT</h1>
      {isLobbyStage && <OrnateDivider />}
      
      <div className={`${isLobbyStage ? `${isSetupConfig ? 'mt-1.5 w-full max-w-[880px] sm:mt-2 lg:max-w-[min(60vw,780px)] xl:max-w-[820px]' : isInitialMenu ? 'mt-2 w-full max-w-[860px] sm:mt-3 lg:max-w-[min(58vw,720px)] xl:max-w-[760px]' : 'mt-3 w-full max-w-[880px] sm:mt-4 lg:max-w-[min(62vw,780px)] xl:max-w-[820px]'}` : 'w-full'}`}>
        {/* --- STATE 1: MAIN MENU --- */}
        {!activeLobbyId && !setupMode && (
          <div className={`${isInitialMenu ? 'relative w-full animate-fade-in rounded-[24px] border border-gold/40 bg-black/70 p-3 shadow-[0_0_55px_rgba(0,0,0,0.75),inset_0_0_45px_rgba(234,179,8,0.08)] sm:p-5 lg:p-4 xl:p-4.5' : 'w-full flex flex-col gap-3 animate-fade-in'}`}>
            {isInitialMenu && (
              <>
                <span className="pointer-events-none absolute -left-1 -top-1 h-8 w-8 rounded-tl-[24px] border-l border-t border-gold/70"></span>
                <span className="pointer-events-none absolute -right-1 -top-1 h-8 w-8 rounded-tr-[24px] border-r border-t border-gold/70"></span>
                <span className="pointer-events-none absolute -bottom-1 -left-1 h-8 w-8 rounded-bl-[24px] border-b border-l border-gold/70"></span>
                <span className="pointer-events-none absolute -bottom-1 -right-1 h-8 w-8 rounded-br-[24px] border-b border-r border-gold/70"></span>
              </>
            )}
            {import.meta.env.VITE_IS_PORTAL ? (
              <>
                <div className="flex w-full flex-col gap-3 sm:gap-4 lg:gap-2.5">
                  <LobbyModeCard
                    tone="gold"
                    icon={<LocalModeIcon className="h-7 w-7 sm:h-10 sm:w-10" aria-hidden="true" />}
                    title={t('playNow', 'PLAY NOW')}
                    description={t('playNowSubtitle', 'Start an instant offline battle against temple-trained rivals.')}
                    onClick={() => {
                      const newSeats = {
                        Player1: { type: 'human', color: 'ruby', name: user?.displayName || '', uid: null },
                        Player2: { type: 'bot', color: 'sapphire', name: '', uid: null },
                        Player3: { type: 'bot', color: 'emerald', name: '', uid: null },
                        Player4: { type: 'bot', color: 'amber', name: '', uid: null }
                      };
                      executeStart(false, null, { seats: newSeats, isQuickGame: false, isTeamMode: false, botDifficulty: 'easy', isVoidRuleEnabled: true });
                    }}
                  />
                  <LobbyModeCard
                    tone="ruby"
                    icon={<OnlineModeIcon className="h-7 w-7 sm:h-10 sm:w-10" aria-hidden="true" />}
                    title={isSearching ? t('searching', 'SEARCHING...') : t('playOnline', 'PLAY ONLINE')}
                    description={t('playOnlineSubtitle', 'Enter matchmaking and face challengers across the realm.')}
                    onClick={() => handleFindMatch({ matchType: 'ffa', isQuickGame: false, isVoidRuleEnabled: true, botDifficulty: 'easy' })}
                    disabled={isSearching || isHosting}
                  />
                  <LobbyModeCard
                    tone="sapphire"
                    icon={<PrivateModeIcon className="h-7 w-7 sm:h-10 sm:w-10" aria-hidden="true" />}
                    title={t('customGame', 'CUSTOM GAME')}
                    description={t('customGameSubtitle', 'Fine-tune seats, rules, and difficulty before the match begins.')}
                    onClick={() => { setSetupMode('local'); setSetupStep('config'); }}
                  />
                </div>
              </>
            ) : (
              <>
                {isInitialMenu ? (
                  <div className="flex w-full flex-col gap-3 sm:gap-4 lg:gap-2.5">
                    <LobbyModeCard
                      tone="gold"
                      icon={<LocalModeIcon className="h-7 w-7 sm:h-10 sm:w-10" aria-hidden="true" />}
                      title={t('localPlay', 'LOCAL PLAY')}
                      description={t('localPlaySubtitle', 'Play with friends on the same device.')}
                      onClick={() => { setSetupMode('local'); setSetupStep('config'); }}
                    />
                    <LobbyModeCard
                      tone="ruby"
                      icon={<OnlineModeIcon className="h-7 w-7 sm:h-10 sm:w-10" aria-hidden="true" />}
                      title={t('onlineMatch', 'ONLINE MATCH')}
                      description={t('onlineMatchSubtitle', 'Compete with players around the world.')}
                      onClick={() => { setSetupMode('public'); setSetupStep('config'); }}
                    />
                    <LobbyModeCard
                      tone="sapphire"
                      icon={<PrivateModeIcon className="h-7 w-7 sm:h-10 sm:w-10" aria-hidden="true" />}
                      title={t('privateMatch', 'PRIVATE MATCH')}
                      description={t('privateMatchSubtitle', 'Create or join a private room.')}
                      onClick={() => { setSetupMode('private'); setSetupStep('config'); }}
                    />
                  </div>
                ) : (
                  <>
                    <button onClick={() => { setSetupMode('local'); setSetupStep('config'); }} className="w-full py-4 flex items-center justify-start gap-4 px-6 bg-[var(--color-panel-bg)] text-white font-sans font-semibold tracking-wide rounded-xl border-l-4 border-[var(--color-gold)] hover:bg-white/5 transition-all" title={t('localPlayTitle', 'Local Play')}>
                      <LocalModeIcon className="h-6 w-6 text-[var(--color-gold)]" aria-hidden="true" />
                      <span className="text-sm leading-none uppercase tracking-widest">{t('localPlay', 'LOCAL PLAY')}</span>
                    </button>

                    <button onClick={() => { setSetupMode('public'); setSetupStep('config'); }} className="w-full py-4 flex items-center justify-start gap-4 px-6 bg-[var(--color-panel-bg)] text-white font-sans font-semibold tracking-wide rounded-xl border-l-4 border-emerald-500 hover:bg-white/5 transition-all" title={t('findPublicMatchTitle', 'Find Public Match')}>
                      <OnlineModeIcon className="h-6 w-6 text-emerald-500" aria-hidden="true" />
                      <span className="text-sm leading-none uppercase tracking-widest">{t('publicMatch', 'PUBLIC MATCH')}</span>
                    </button>

                    <button onClick={() => { setSetupMode('private'); setSetupStep('config'); }} className="w-full py-4 flex items-center justify-start gap-4 px-6 bg-[var(--color-panel-bg)] text-white font-sans font-semibold tracking-wide rounded-xl border-l-4 border-sky-400 hover:bg-white/5 transition-all" title={t('hostPrivateMatchTitle', 'Host Private Match')}>
                      <PrivateModeIcon className="h-6 w-6 text-sky-400" aria-hidden="true" />
                      <span className="text-sm leading-none uppercase tracking-widest">{t('privateMatch', 'PRIVATE MATCH')}</span>
                    </button>
                  </>
                )}
              </>
            )}

            {(hasCachedGame || lastOnlineGameId) && (
              <div className={`${isInitialMenu ? 'mx-auto mt-3.5 flex w-full max-w-md gap-2' : 'flex gap-2 w-full mt-2'}`}>
                {hasCachedGame && (
                  <button onClick={onResumeGame} className={`${isInitialMenu ? 'border-gold/35 bg-white/10 text-gold' : 'border-white/10 bg-white/5 text-white'} flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 font-sans text-xs font-semibold transition-colors hover:bg-white/15`}>
                    <ResumeIcon className="h-4 w-4 text-gold" aria-hidden="true" />
                    {t('resumeOffline', 'Resume Offline')}
                  </button>
                )}
                {lastOnlineGameId && (
                  <button onClick={() => onReconnectOnline(lastOnlineGameId)} className="flex-1 py-3 bg-white/5 text-sapphire font-sans text-xs font-semibold rounded-xl border border-white/10 hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
                    <ReconnectIcon className="h-4 w-4" aria-hidden="true" />
                    {t('reconnectOnline', 'Reconnect')}
                  </button>
                )}
              </div>
            )}
            {import.meta.env.VITE_IS_PORTAL && (
              <p className="mt-3 text-center text-[10px] leading-relaxed text-white/45">
                {t('portalLegalNotice', 'By playing Dyut on CrazyGames, you agree to the CrazyGames Terms & Conditions and Privacy Policy.')}
              </p>
            )}
          </div>
        )}

        {isLobbyStage && (
          <div className={`${isSetupConfig ? 'hidden lg:contents' : 'mt-3 flex'} w-full max-w-[880px] flex-col items-start gap-3 sm:mt-4 lg:contents`}>
            <div className="flex w-full items-center gap-3 rounded-[8px] border border-gold/30 bg-black/55 px-3 py-2 text-left shadow-[0_0_22px_rgba(0,0,0,0.55)] lg:fixed lg:bottom-5 lg:left-8 lg:z-20 lg:max-w-[280px] lg:px-3.5 lg:py-2.5 xl:bottom-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-gold/40 bg-gold/10 text-gold">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3l7 3v5c0 4.4-2.8 8.1-7 10-4.2-1.9-7-5.6-7-10V6l7-3z"></path>
                  <path d="M9 12l2 2 4-5"></path>
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-gold sm:text-base lg:text-[0.95rem]">{t('fairPlayTitle', 'Fair Play. Pure Dyut.')}</div>
                <div className="text-xs leading-snug text-white/70 sm:text-sm lg:text-[0.88rem]">{t('fairPlaySubtitle', 'Respect the game. Honor the tradition.')}</div>
              </div>
            </div>

          </div>
        )}

        {/* --- STATE 2: INTERMEDIATE CONFIG SCREEN --- */}
        {!activeLobbyId && setupMode && setupStep === 'config' && (
          <div className="relative w-full animate-fade-in rounded-[24px] border border-gold/40 bg-black/72 p-4 shadow-[0_0_60px_rgba(0,0,0,0.82),inset_0_0_48px_rgba(234,179,8,0.08)] sm:p-6 lg:mx-auto lg:max-w-[min(60vw,780px)] lg:overflow-hidden lg:p-3.5 xl:max-w-[800px]">
            <span className="pointer-events-none absolute -left-1 -top-1 h-8 w-8 rounded-tl-[24px] border-l border-t border-gold/70"></span>
            <span className="pointer-events-none absolute -right-1 -top-1 h-8 w-8 rounded-tr-[24px] border-r border-t border-gold/70"></span>
            <span className="pointer-events-none absolute -bottom-1 -left-1 h-8 w-8 rounded-bl-[24px] border-b border-l border-gold/70"></span>
            <span className="pointer-events-none absolute -bottom-1 -right-1 h-8 w-8 rounded-br-[24px] border-b border-r border-gold/70"></span>

            <div className="mb-3 grid grid-cols-[auto_1fr_auto] items-center gap-3 sm:mb-4 lg:mb-2">
              <button onClick={() => setSetupMode(null)} className="flex items-center gap-2 rounded-lg border border-gold/30 bg-white/5 px-4 py-2 font-display text-xs font-bold uppercase tracking-widest text-white/70 transition-colors hover:border-gold/60 hover:text-gold lg:px-3 lg:py-1.5 lg:text-[0.68rem]">
                <BackIcon className="h-4 w-4" aria-hidden="true" />
                {t('back', 'BACK')}
              </button>
              <h2 className="text-center font-display text-2xl font-bold uppercase tracking-widest text-gold text-glow-gold sm:text-3xl lg:text-[1.35rem]">
                {setupMode === 'public' ? t('publicMatch', 'PUBLIC MATCH') : setupMode === 'private' ? t('privateMatch', 'PRIVATE MATCH') : t('localPlay', 'LOCAL PLAY')}
              </h2>
              <div className="hidden w-[92px] sm:block"></div>
            </div>

            <div className="flex flex-col gap-3 sm:gap-4 lg:gap-2">
              <ConfigSectionTitle>{t('matchType', 'Match Type')}</ConfigSectionTitle>
              <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:gap-2">
                <ConfigChoiceCard active={matchType === '1v1'} tone="sapphire" title={t('1v1', '1 vs 1')} subtitle={t('oneOnOne', 'Face off one on one')} onClick={() => setMatchType('1v1')}>
                  <div className="flex gap-1.5"><span className="h-3 w-3 rounded-full bg-sapphire shadow-[0_0_10px_rgba(56,189,248,0.8)]"></span><span className="h-3 w-3 rounded-full bg-ruby shadow-[0_0_10px_rgba(220,38,38,0.8)]"></span></div>
                  <LocalModeIcon className="h-5 w-5 text-white/80" aria-hidden="true" />
                </ConfigChoiceCard>
                <ConfigChoiceCard active={matchType === '2v2'} tone="gold" title={t('2v2', '2 vs 2')} subtitle={t('teamUpDominate', 'Team up and dominate')} onClick={() => setMatchType('2v2')}>
                  <div className="flex gap-1.5"><span className="h-3 w-3 rounded-full bg-emerald shadow-[0_0_10px_rgba(52,211,153,0.8)]"></span><span className="h-3 w-3 rounded-full bg-amber shadow-[0_0_10px_rgba(245,158,11,0.8)]"></span></div>
                  <LocalModeIcon className="h-5 w-5 text-white/80" aria-hidden="true" />
                </ConfigChoiceCard>
                <ConfigChoiceCard active={matchType === 'ffa'} tone="violet" title={t('ffa4p', 'FFA 4P')} subtitle={t('everyPlayerForThemselves', 'Every player for themselves')} onClick={() => setMatchType('ffa')}>
                  <div className="flex gap-1.5"><span className="h-3 w-3 rounded-full bg-ruby shadow-[0_0_10px_rgba(220,38,38,0.8)]"></span><span className="h-3 w-3 rounded-full bg-sapphire shadow-[0_0_10px_rgba(56,189,248,0.8)]"></span><span className="h-3 w-3 rounded-full bg-emerald shadow-[0_0_10px_rgba(52,211,153,0.8)]"></span><span className="h-3 w-3 rounded-full bg-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.8)]"></span></div>
                  <LocalModeIcon className="h-5 w-5 text-white/80" aria-hidden="true" />
                </ConfigChoiceCard>
              </div>

              <ConfigSectionTitle>{t('gameRules', 'Game Rules')}</ConfigSectionTitle>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:gap-2">
                <ConfigChoiceCard active={isVoidRuleEnabled} tone="gold" title={t('voidRule', '1+3 Void')} subtitle={t('classicStrategicFormat', 'Classic strategic format')} onClick={() => setIsVoidRuleEnabled(!isVoidRuleEnabled)} className="min-h-[92px] lg:min-h-[64px]">
                  <RulesIcon className="h-8 w-8" aria-hidden="true" />
                </ConfigChoiceCard>
                <ConfigChoiceCard active={isQuickGame} tone="gold" title={t('quick', 'Quick')} subtitle={t('fastPacedShortGames', 'Fast-paced & short games')} onClick={() => setIsQuickGame(!isQuickGame)} className="min-h-[92px] lg:min-h-[64px]">
                  <QuickIcon className="h-8 w-8" aria-hidden="true" />
                </ConfigChoiceCard>
              </div>

              {setupMode !== 'public' && (
                <>
                  <ConfigSectionTitle>{t('botDifficulty', 'Bot Difficulty')}</ConfigSectionTitle>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:gap-2">
                    <ConfigChoiceCard active={botDifficulty === 'easy'} tone="emerald" title={t('easy', 'EASY')} subtitle={t('relaxedChallenge', 'Relaxed challenge')} onClick={() => setBotDifficulty('easy')} className="min-h-[86px] lg:min-h-[62px]">
                      <EasyIcon className="h-8 w-8" aria-hidden="true" />
                    </ConfigChoiceCard>
                    <ConfigChoiceCard active={botDifficulty === 'hard'} tone="ruby" title={t('hard', 'HARD')} subtitle={t('forSeasonedStrategists', 'For seasoned & strategists')} onClick={() => setBotDifficulty('hard')} className="min-h-[86px] lg:min-h-[62px]">
                      <HardIcon className="h-8 w-8" aria-hidden="true" />
                    </ConfigChoiceCard>
                  </div>
                </>
              )}
            </div>

            <div className="mx-auto mt-4 w-full max-w-[760px] lg:mt-2">
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
                }} className={configPrimaryButtonClass}>
                  {t('next', 'Next')}
                </button>
              )}
              {setupMode === 'public' && (
                <button onClick={() => handleFindMatch()} disabled={isSearching || isHosting} className={configPrimaryButtonClass}>
                  {isSearching ? t('searching', 'SEARCHING...') : t('findMatch', 'FIND MATCH')}
                </button>
              )}
              {setupMode === 'private' && (
                <button onClick={() => handleHostOnlineClick(false)} disabled={isHosting || isSearching} className={configPrimaryButtonClass}>
                  {isHosting ? t('hostingMatch', 'CREATING LOBBY...') : t('createLobby', 'CREATE LOBBY')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* --- STATE 3: LOCAL PLAY SETUP --- */}
        {!activeLobbyId && setupMode === 'local' && setupStep === 'seats' && (
          <div className="w-full space-y-6 animate-fade-in lg:mx-auto lg:max-w-[min(34vw,430px)] lg:space-y-3.5">
            <div className="mb-4 flex w-full items-center justify-between rounded-xl border border-white/5 bg-black/20 p-2 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] lg:mb-3">
              <button onClick={() => setSetupStep('config')} className="px-3 py-1.5 bg-white/5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-1"><BackIcon className="h-3 w-3" aria-hidden="true" /> {t('back', 'BACK')}</button>
              <h2 className="text-sm font-bold uppercase tracking-widest text-white/80 lg:text-xs">{t('localPlay', 'LOCAL PLAY')}</h2>
              <div className="w-[72px]"></div>
            </div>

            <div className="w-full flex flex-col items-center">
              <h2 className="mb-4 text-center text-[10px] font-semibold uppercase tracking-widest text-white/70 lg:mb-3">{t('seatArrangement', 'Seat Arrangement')}</h2>
              <div className="grid w-full max-w-[280px] grid-cols-2 gap-4 lg:max-w-[220px] lg:gap-2.5">
                 <SeatCard id="Player4" label={`${t('player', 'Player')} 4`} seat={seats.Player4} onTypeChange={(type) => handleSeatTypeChange('Player4', type)} onColorChange={(c) => handleSeatColorChange('Player4', c)} onNameChange={(n) => handleSeatNameChange('Player4', n)} onClaim={handleClaimSeat} activeColors={activeColors} isHost={isHost} isOnline={!!activeLobbyId} userUid={user?.uid} t={t} hasClaimedSeat={hasClaimedSeat} lobbyStatus={lobbyStatus} isLobbyPublic={isLobbyPublic} />
                 <SeatCard id="Player3" label={`${t('player', 'Player')} 3`} seat={seats.Player3} onTypeChange={(type) => handleSeatTypeChange('Player3', type)} onColorChange={(c) => handleSeatColorChange('Player3', c)} onNameChange={(n) => handleSeatNameChange('Player3', n)} onClaim={handleClaimSeat} activeColors={activeColors} isHost={isHost} isOnline={!!activeLobbyId} userUid={user?.uid} t={t} hasClaimedSeat={hasClaimedSeat} lobbyStatus={lobbyStatus} isLobbyPublic={isLobbyPublic} />
                 <SeatCard id="Player1" label={`${t('player', 'Player')} 1`} seat={seats.Player1} onTypeChange={(type) => handleSeatTypeChange('Player1', type)} onColorChange={(c) => handleSeatColorChange('Player1', c)} onNameChange={(n) => handleSeatNameChange('Player1', n)} onClaim={handleClaimSeat} activeColors={activeColors} isHost={isHost} isOnline={!!activeLobbyId} userUid={user?.uid} t={t} hasClaimedSeat={hasClaimedSeat} lobbyStatus={lobbyStatus} isLobbyPublic={isLobbyPublic} />
                 <SeatCard id="Player2" label={`${t('player', 'Player')} 2`} seat={seats.Player2} onTypeChange={(type) => handleSeatTypeChange('Player2', type)} onColorChange={(c) => handleSeatColorChange('Player2', c)} onNameChange={(n) => handleSeatNameChange('Player2', n)} onClaim={handleClaimSeat} activeColors={activeColors} isHost={isHost} isOnline={!!activeLobbyId} userUid={user?.uid} t={t} hasClaimedSeat={hasClaimedSeat} lobbyStatus={lobbyStatus} isLobbyPublic={isLobbyPublic} />
              </div>
            </div>

            <button onClick={() => executeStart(false)} className="w-full rounded-xl bg-gold py-4 font-display text-lg font-bold text-charcoal shadow-[0_0_15px_rgba(251,191,36,0.4)] transition-all hover:scale-[1.02] hover:bg-yellow-400 lg:py-2.5 lg:text-[0.95rem]">
              {t('startMatch', 'START MATCH')}
            </button>
          </div>
        )}

        {/* --- STATE 4: ACTIVE LOBBY (PUBLIC OR PRIVATE) --- */}
        {activeLobbyId && (
          <div className="w-full space-y-6 animate-fade-in lg:mx-auto lg:max-w-[min(34vw,440px)] lg:space-y-3.5">
            <div className="w-full flex flex-col items-center">
              <h2 className="mb-4 text-center text-[10px] font-semibold uppercase tracking-widest text-white/70 lg:mb-3">{t('seatArrangement', 'Seat Arrangement')}</h2>
              <div className="grid w-full max-w-[280px] grid-cols-2 gap-4 lg:max-w-[220px] lg:gap-2.5">
                 <SeatCard id="Player4" label={`${t('player', 'Player')} 4`} seat={seats.Player4} onTypeChange={(type) => handleSeatTypeChange('Player4', type)} onColorChange={(c) => handleSeatColorChange('Player4', c)} onNameChange={(n) => handleSeatNameChange('Player4', n)} onClaim={handleClaimSeat} activeColors={activeColors} isHost={isHost} isOnline={!!activeLobbyId} userUid={user?.uid} t={t} hasClaimedSeat={hasClaimedSeat} lobbyStatus={lobbyStatus} isLobbyPublic={isLobbyPublic} />
                 <SeatCard id="Player3" label={`${t('player', 'Player')} 3`} seat={seats.Player3} onTypeChange={(type) => handleSeatTypeChange('Player3', type)} onColorChange={(c) => handleSeatColorChange('Player3', c)} onNameChange={(n) => handleSeatNameChange('Player3', n)} onClaim={handleClaimSeat} activeColors={activeColors} isHost={isHost} isOnline={!!activeLobbyId} userUid={user?.uid} t={t} hasClaimedSeat={hasClaimedSeat} lobbyStatus={lobbyStatus} isLobbyPublic={isLobbyPublic} />
                 <SeatCard id="Player1" label={`${t('player', 'Player')} 1`} seat={seats.Player1} onTypeChange={(type) => handleSeatTypeChange('Player1', type)} onColorChange={(c) => handleSeatColorChange('Player1', c)} onNameChange={(n) => handleSeatNameChange('Player1', n)} onClaim={handleClaimSeat} activeColors={activeColors} isHost={isHost} isOnline={!!activeLobbyId} userUid={user?.uid} t={t} hasClaimedSeat={hasClaimedSeat} lobbyStatus={lobbyStatus} isLobbyPublic={isLobbyPublic} />
                 <SeatCard id="Player2" label={`${t('player', 'Player')} 2`} seat={seats.Player2} onTypeChange={(type) => handleSeatTypeChange('Player2', type)} onColorChange={(c) => handleSeatColorChange('Player2', c)} onNameChange={(n) => handleSeatNameChange('Player2', n)} onClaim={handleClaimSeat} activeColors={activeColors} isHost={isHost} isOnline={!!activeLobbyId} userUid={user?.uid} t={t} hasClaimedSeat={hasClaimedSeat} lobbyStatus={lobbyStatus} isLobbyPublic={isLobbyPublic} />
              </div>
            </div>

            <div className="mt-4 flex w-full flex-col gap-2 lg:mt-2.5">
            {isHost ? (
                <button onClick={handleStartOnlineMatch} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold py-4 font-display text-lg font-bold text-charcoal shadow-[0_0_15px_rgba(251,191,36,0.4)] transition-all hover:scale-[1.02] hover:bg-yellow-400 lg:py-2.5 lg:text-[0.95rem]">
                  <StartIcon className="h-6 w-6" aria-hidden="true" />
                  {t('startMatch', 'START MATCH')}
                </button>
            ) : (
                <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/5 py-4 font-sans text-sm font-bold uppercase tracking-widest text-white/60 lg:py-3 lg:text-[0.72rem]">
                  <svg className="animate-spin h-5 w-5 text-white/60" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  {t('waitingForHost', 'Waiting for Host...')}
                </div>
            )}
              <button onClick={async () => {
                if (import.meta.env.VITE_IS_PORTAL && window.CrazyGames?.SDK) {
                  try { await window.CrazyGames.SDK.game.leftRoom(); } catch(e){}
                }
                window.location.href = window.location.pathname;
              }} className="w-full py-3 bg-transparent text-white/40 hover:text-white flex items-center justify-center gap-2 font-sans text-xs font-semibold rounded-xl transition-colors uppercase tracking-widest">
                {t('leaveLobby', 'Leave Lobby')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Desktop Banner Ad Containers */}
    {import.meta.env.VITE_IS_PORTAL && CRAZYGAMES_ADS_ENABLED && (
      <>
        {/* Left Banner */}
        <div className="hidden xl:flex fixed left-4 2xl:left-12 top-1/2 -translate-y-1/2 z-10 flex-col items-center gap-2 pointer-events-none">
          <span className="text-white/30 text-[10px] uppercase tracking-widest font-bold">Advertisement</span>
          <div id="cg-lobby-banner-left" className="w-[300px] h-[600px] bg-black/20 rounded-xl overflow-hidden shadow-2xl border border-white/10 pointer-events-auto flex items-center justify-center"></div>
        </div>
        {/* Right Banner */}
        <div className="hidden xl:flex fixed right-4 2xl:right-12 top-1/2 -translate-y-1/2 z-10 flex-col items-center gap-2 pointer-events-none">
          <span className="text-white/30 text-[10px] uppercase tracking-widest font-bold">Advertisement</span>
          <div id="cg-lobby-banner-right" className="w-[300px] h-[600px] bg-black/20 rounded-xl overflow-hidden shadow-2xl border border-white/10 pointer-events-auto flex items-center justify-center"></div>
        </div>
      </>
    )}
    </>
  );
};
export default UnifiedLobby;
