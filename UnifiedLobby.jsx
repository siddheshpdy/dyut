import React, { useState } from 'react';

const ALL_COLORS = [
  { name: 'ruby', tw: 'bg-ruby' },
  { name: 'sapphire', tw: 'bg-sapphire' },
  { name: 'emerald', tw: 'bg-emerald' },
  { name: 'amber', tw: 'bg-amber' },
];

const UnifiedLobby = ({ onStartGame, onResumeGame, onShowRules, hasCachedGame }) => {
  const [playerCount, setPlayerCount] = useState(2);
  const [playerColors, setPlayerColors] = useState(['ruby', 'sapphire', 'emerald', 'amber']);
  const [botCount, setBotCount] = useState(1);
  const [botDifficulty, setBotDifficulty] = useState('hard');
  const [isVoidRuleEnabled, setIsVoidRuleEnabled] = useState(true);

  const handleColorChange = (playerIndex, colorName) => {
    const newColors = [...playerColors];
    newColors[playerIndex] = colorName;
    setPlayerColors(newColors);
  };

  const handleStartClick = () => {
    const selected = playerColors.slice(0, playerCount);
    const hasDuplicates = new Set(selected).size !== selected.length;
    if (hasDuplicates) {
      alert("Each player must have a unique color.");
      return;
    }

    // Generate bot assignments starting from the last player index backwards
    const bots = [];
    for (let i = playerCount - botCount; i < playerCount; i++) bots.push(`Player${i + 1}`);

    onStartGame({ playerCount, playerColors: selected, isVoidRuleEnabled, bots, botDifficulty });
  };

  return (
    <div className="glass-panel p-8 rounded-3xl w-full max-w-lg flex flex-col items-center relative z-10">
      <button onClick={onShowRules} className="absolute top-6 right-6 text-white/60 hover:text-gold transition-colors" title="Rules">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      </button>
      
      <h1 className="font-display text-5xl font-bold mb-8 tracking-widest text-glow-gold text-gold">DYUT</h1>
      
      <div className="w-full space-y-8">
        {/* Player Count */}
        <div>
          <h2 className="text-white/70 text-xs uppercase tracking-widest mb-3 text-center font-semibold">Number of Players</h2>
          <div className="flex justify-center gap-4">
            {[2, 3, 4].map(num => (
              <button
                key={num}
                onClick={() => {
                  setPlayerCount(num);
                  if (botCount >= num) setBotCount(num - 1); // Cap bots to avoid 0 humans
                }}
                className={`w-14 h-14 rounded-xl font-display text-2xl font-bold transition-all duration-300 ${playerCount === num ? 'bg-glow-gold bg-gold text-charcoal scale-110' : 'bg-white/10 text-white hover:bg-white/20'}`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        {/* Bot Count */}
        <div>
          <h2 className="text-white/70 text-xs uppercase tracking-widest mb-3 text-center font-semibold">AI Bots</h2>
          <div className="flex justify-center gap-4">
            {Array.from({ length: playerCount }).map((_, i) => (
              <button
                key={i}
                onClick={() => setBotCount(i)}
                className={`w-12 h-12 rounded-xl font-display text-xl font-bold transition-all duration-300 ${botCount === i ? 'bg-sapphire text-charcoal scale-110 shadow-[0_0_15px_rgba(56,189,248,0.4)]' : 'bg-white/10 text-white hover:bg-white/20'}`}
              >
                {i}
              </button>
            ))}
          </div>
        </div>

        {/* Bot Difficulty (Only show if bots are enabled) */}
        {botCount > 0 && (
          <div className="animate-fade-in">
            <h2 className="text-white/70 text-xs uppercase tracking-widest mb-3 text-center font-semibold">Bot Difficulty</h2>
            <div className="flex justify-center gap-4">
              <button onClick={() => setBotDifficulty('easy')} className={`px-6 py-2 rounded-xl font-sans text-sm font-bold transition-all duration-300 ${botDifficulty === 'easy' ? 'bg-emerald text-charcoal scale-110 shadow-[0_0_15px_rgba(74,222,128,0.4)]' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                EASY
              </button>
              <button onClick={() => setBotDifficulty('hard')} className={`px-6 py-2 rounded-xl font-sans text-sm font-bold transition-all duration-300 ${botDifficulty === 'hard' ? 'bg-ruby text-white scale-110 shadow-[0_0_15px_rgba(244,63,94,0.4)]' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                HARD
              </button>
            </div>
          </div>
        )}

        {/* Colors */}
        <div>
          <h2 className="text-white/70 text-xs uppercase tracking-widest mb-3 text-center font-semibold">Player Colors</h2>
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: playerCount }).map((_, i) => {
              const availableForPlayer = ALL_COLORS.filter(c => !playerColors.slice(0, playerCount).includes(c.name) || playerColors[i] === c.name);
              return (
                <div key={i} className="flex flex-col items-center bg-black/40 p-3 rounded-xl border border-white/5">
                  <span className="text-white/90 font-sans text-sm font-semibold mb-3">Player {i + 1}</span>
                  <div className="flex gap-2">
                    {availableForPlayer.map(color => (
                      <button
                        key={color.name}
                        onClick={() => handleColorChange(i, color.name)}
                        className={`w-6 h-6 rounded-full ${color.tw} jewel-shadow transition-transform ${playerColors[i] === color.name ? 'ring-2 ring-white ring-offset-2 ring-offset-charcoal scale-125' : 'opacity-40 hover:opacity-100'}`}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rules Toggle */}
        <div className="flex items-center justify-center gap-3">
          <input type="checkbox" id="void-rule" checked={isVoidRuleEnabled} onChange={(e) => setIsVoidRuleEnabled(e.target.checked)} className="w-5 h-5 accent-gold cursor-pointer" />
          <label htmlFor="void-rule" className="text-white/80 font-sans text-sm cursor-pointer hover:text-white transition-colors">Enable Void Roll (1+3)</label>
        </div>
      </div>

      <div className="mt-10 w-full flex flex-col gap-3">
        <button onClick={handleStartClick} className="w-full py-3 bg-gold text-charcoal font-display font-bold text-lg rounded-xl shadow-[0_0_15px_rgba(251,191,36,0.4)] hover:bg-yellow-400 hover:scale-[1.02] transition-all">START NEW GAME</button>
        {hasCachedGame && <button onClick={onResumeGame} className="w-full py-3 bg-white/5 text-white font-sans text-sm font-semibold rounded-xl border border-white/10 hover:bg-white/10 transition-colors">RESUME LAST SESSION</button>}
      </div>
    </div>
  );
};
export default UnifiedLobby;