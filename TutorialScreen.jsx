import React, { useState, useCallback, useReducer, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Board from './Board';
import { GameContext, gameReducer } from './GameContext';
import { getTutorialScenarios } from './tutorialScenarios';

const tutorialReducer = (state, action) => {
  if (action.type === 'LOAD_SCENARIO') return action.payload;
  return gameReducer(state, action);
};

const TutorialScreen = ({ onBack }) => {
  const { t } = useTranslation();
  const scenarios = useMemo(() => getTutorialScenarios(), []);
  const [currentScenarioIndex, setCurrentScenarioIndex] = useState(0);
  const currentScenario = scenarios[currentScenarioIndex];

  const [scenarioState, dispatchLocal] = useReducer(tutorialReducer, null, () => scenarios[0].initialState);
  const [isSuccess, setIsSuccess] = useState(false);

  // Re-sync if we switch scenarios
  useEffect(() => {
    dispatchLocal({ type: 'LOAD_SCENARIO', payload: scenarios[currentScenarioIndex].initialState });
    setIsSuccess(false);
  }, [currentScenarioIndex, scenarios]);

  const needsAction = currentScenario.expectedAction !== null;
  const canProceed = isSuccess || !needsAction;

  const handleNext = () => {
    if (currentScenarioIndex < scenarios.length - 1) {
      setCurrentScenarioIndex(currentScenarioIndex + 1);
    } else {
      onBack();
    }
  };

  const dispatch = useCallback((action) => {
    if (isSuccess) return; 
    
    // Dispatch everything so animations/moves execute immediately
    dispatchLocal(action);

    if (needsAction) {
      const match = Array.isArray(currentScenario.expectedAction) 
        ? currentScenario.expectedAction.includes(action.type) 
        : action.type === currentScenario.expectedAction;
      
      if (match) setIsSuccess(true);
    }
  }, [currentScenario, isSuccess, needsAction]);

  const value = { state: scenarioState, dispatch, leaveGame: () => {} };

  return (
    <div className="flex flex-col items-center w-full max-w-4xl p-4 sm:p-8 overflow-y-auto">
      <div className="glass-panel p-6 rounded-3xl w-full mb-6 text-center animate-fade-in z-20">
        <h2 className="text-gold font-display font-bold text-3xl mb-2 uppercase tracking-widest">{t(`tutorialTitle_${currentScenario.id}`, currentScenario.title)}</h2>
        <p className="text-white/80 font-sans text-sm sm:text-base leading-relaxed max-w-2xl mx-auto">
          {t(`tutorialDesc_${currentScenario.id}`, currentScenario.description)}
        </p>
        
        <div className="mt-6 flex flex-col items-center gap-3">
          {isSuccess && <div className="text-emerald font-bold text-lg animate-hop">{t(`tutorialSuccess_${currentScenario.id}`, currentScenario.successMessage)}</div>}
          {(!needsAction && !isSuccess) && <div className="text-emerald font-bold text-sm animate-pulse">{t(`tutorialSuccess_${currentScenario.id}`, currentScenario.successMessage)}</div>}
          <div className="flex gap-4">
            <button onClick={onBack} className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-colors shadow-md">{t('exitTutorial', 'Exit Tutorial')}</button>
            <button onClick={handleNext} disabled={!canProceed} className={`px-8 py-2 font-bold rounded-xl transition-all shadow-lg ${canProceed ? 'bg-gold text-charcoal hover:scale-105 hover:bg-yellow-400' : 'bg-white/5 text-white/30 cursor-not-allowed border border-white/10 shadow-none'}`}>{currentScenarioIndex < scenarios.length - 1 ? t('next', 'Next') : t('finish', 'Finish')}</button>
          </div>
        </div>
      </div>
      <div className="w-full max-w-md sm:max-w-lg lg:max-w-xl pointer-events-auto">
        <GameContext.Provider value={value}><Board onGoToMenu={onBack} /></GameContext.Provider>
      </div>
    </div>
  );
};
export default TutorialScreen;