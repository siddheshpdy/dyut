import React, { useState } from 'react';

const ALL_COLORS = [
  { name: 'yellow', hex: '#fde047', tw: 'bg-piece-yellow' },
  { name: 'black', hex: '#171717', tw: 'bg-piece-black' },
  { name: 'green', hex: '#4ade80', tw: 'bg-piece-green' },
  { name: 'blue', hex: '#60a5fa', tw: 'bg-piece-blue' },
  { name: 'red', hex: '#f87171', tw: 'bg-red-400' },
  { name: 'purple', hex: '#c084fc', tw: 'bg-purple-400' },
];

const ColorPicker = ({ selectedColor, availableColors, onSelect }) => (
  <div className="flex gap-2">
    {availableColors.map(color => (
      <button
        key={color.name}
        onClick={() => onSelect(color.name)}
        className={`w-8 h-8 rounded-full ${color.tw} border-2 ${selectedColor === color.name ? 'border-white ring-2 ring-white' : 'border-transparent'}`}
        aria-label={`Select ${color.name}`}
      />
    ))}
  </div>
);

const GameSetup = ({ onGameSetupComplete }) => {
  const [step, setStep] = useState(1); // 1 for player count, 2 for config
  const [playerCount, setPlayerCount] = useState(2);
  const [playerColors, setPlayerColors] = useState(['yellow', 'black', 'green', 'blue']);
  const [isVoidRuleEnabled, setIsVoidRuleEnabled] = useState(true);

  const handlePlayerCountSelect = (count) => {
    setPlayerCount(count);
    setStep(2);
  };

  const handleColorChange = (playerIndex, color) => {
    const newColors = [...playerColors];
    newColors[playerIndex] = color;
    setPlayerColors(newColors);
  };

  const handleStartGame = () => {
    // Ensure no duplicate colors are selected
    const selected = playerColors.slice(0, playerCount);
    const hasDuplicates = new Set(selected).size !== selected.length;
    if (hasDuplicates) {
      alert("Each player must have a unique color.");
      return;
    }

    onGameSetupComplete({
      playerCount,
      playerColors: selected,
      isVoidRuleEnabled,
    });
  };

  if (step === 1) {
    return (
      <div className="bg-neutral-800 p-8 rounded-xl shadow-2xl text-white text-center">
        <h1 className="text-2xl font-bold mb-6">Select Number of Players</h1>
        <div className="flex justify-center gap-4">
          <button onClick={() => handlePlayerCountSelect(2)} className="w-24 h-24 bg-blue-600 rounded-lg text-4xl font-bold hover:bg-blue-700 transition-colors">2</button>
          <button onClick={() => handlePlayerCountSelect(3)} className="w-24 h-24 bg-green-600 rounded-lg text-4xl font-bold hover:bg-green-700 transition-colors">3</button>
          <button onClick={() => handlePlayerCountSelect(4)} className="w-24 h-24 bg-red-600 rounded-lg text-4xl font-bold hover:bg-red-700 transition-colors">4</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-800 p-8 rounded-xl shadow-2xl text-white w-full max-w-md">
      <h1 className="text-2xl font-bold mb-6 text-center">Game Configuration</h1>
      
      <div className="space-y-4 mb-6">
        <h2 className="text-lg font-semibold">Player Colors</h2>
        {Array.from({ length: playerCount }).map((_, i) => {
          const availableForPlayer = ALL_COLORS.filter(c => !playerColors.slice(0, playerCount).includes(c.name) || playerColors[i] === c.name);
          return (
            <div key={i} className="flex items-center justify-between bg-black/20 p-3 rounded-lg">
              <span className="font-bold">Player {i + 1}</span>
              <ColorPicker 
                selectedColor={playerColors[i]}
                availableColors={availableForPlayer}
                onSelect={(color) => handleColorChange(i, color)}
              />
            </div>
          );
        })}
      </div>

      <div className="space-y-4 mb-8">
        <h2 className="text-lg font-semibold">Game Rules</h2>
        <div className="flex items-center justify-between bg-black/20 p-3 rounded-lg">
          <label htmlFor="void-rule" className="font-bold">Enable Void Roll (1+3)</label>
          <input
            type="checkbox"
            id="void-rule"
            checked={isVoidRuleEnabled}
            onChange={(e) => setIsVoidRuleEnabled(e.target.checked)}
            className="w-6 h-6 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="text-center">
        <button onClick={handleStartGame} className="w-full px-6 py-3 bg-green-600 text-white font-bold text-xl rounded-lg shadow-md hover:bg-green-700 transition-colors">
          Start Game
        </button>
      </div>
    </div>
  );
};

export default GameSetup;