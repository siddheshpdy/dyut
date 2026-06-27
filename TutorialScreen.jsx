import React, { useState, useCallback, useReducer, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Board from './Board';
import DiceTray from './DiceTray';
import { GameContext, gameReducer } from './GameContext';
import { getTutorialScenarios } from './tutorialScenarios';
import SecondaryScreenShell from './SecondaryScreenShell';

const tutorialReducer = (state, action) => {
  if (action.type === 'LOAD_SCENARIO') return { ...action.payload, isTutorial: true };
  return gameReducer(state, action);
};

const TutorialScreen = ({ onBack }) => {
  const { t } = useTranslation();
  const scenarios = useMemo(() => getTutorialScenarios(), []);
  const [currentScenarioIndex, setCurrentScenarioIndex] = useState(0);
  const currentScenario = scenarios[currentScenarioIndex];

  const [scenarioState, dispatchLocal] = useReducer(tutorialReducer, null, () => ({ ...scenarios[0].initialState, isTutorial: true }));
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
    <div className="flex w-full max-w-[1600px] flex-col items-center overflow-y-auto px-2 pb-4 pt-16 sm:px-4 sm:pb-6 lg:px-6 lg:pt-8">
      <div className="z-20 mx-auto mb-4 w-full max-w-4xl animate-fade-in sm:mb-6">
        <SecondaryScreenShell
          title={t(`tutorialTitle_${currentScenario.id}`, currentScenario.title)}
          maxWidthClass="max-w-4xl"
          titleClassName="tracking-[0.14em]"
        >
          <div className="space-y-5 text-center">
            <p className="mx-auto max-w-3xl font-sans text-sm leading-relaxed text-white/82 sm:text-base">
              {t(`tutorialDesc_${currentScenario.id}`, currentScenario.description)}
            </p>

            <div className="rounded-2xl border border-gold/20 bg-black/30 px-4 py-4 shadow-[inset_0_0_24px_rgba(0,0,0,0.45)]">
              {isSuccess && <div className="animate-hop font-display text-base font-bold uppercase tracking-[0.16em] text-emerald sm:text-lg">{t(`tutorialSuccess_${currentScenario.id}`, currentScenario.successMessage)}</div>}
              {(!needsAction && !isSuccess) && <div className="animate-pulse font-display text-sm font-bold uppercase tracking-[0.14em] text-emerald/90">{t(`tutorialSuccess_${currentScenario.id}`, currentScenario.successMessage)}</div>}
              {needsAction && !isSuccess && (
                <div className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-white/55 sm:text-sm">
                  {t('completePrompt', 'Complete the required move on the board')}
                </div>
              )}
            </div>

            <div className="mt-2 flex flex-wrap justify-center gap-3 sm:gap-4">
              <button onClick={onBack} className="dyut-secondary-button px-4 py-2 text-xs sm:px-6 sm:text-sm">{t('exitTutorial', 'Exit Tutorial')}</button>
              <button onClick={() => {
                dispatchLocal({ type: 'LOAD_SCENARIO', payload: currentScenario.initialState });
                setIsSuccess(false);
              }} className="dyut-muted-button px-4 py-2 text-xs sm:px-6 sm:text-sm">
                {t('reset', 'Reset')}
              </button>
              <button onClick={handleNext} disabled={!canProceed} className={`rounded-xl border px-6 py-2 font-display text-xs font-bold uppercase tracking-[0.18em] transition-all sm:px-8 sm:text-sm ${canProceed ? 'dyut-primary-button shadow-[0_0_18px_rgba(251,191,36,0.4)]' : 'cursor-not-allowed border-white/10 bg-white/5 text-white/30 shadow-none'}`}>{currentScenarioIndex < scenarios.length - 1 ? t('next', 'Next') : t('finish', 'Finish')}</button>
            </div>
          </div>
        </SecondaryScreenShell>
      </div>
      <div className="w-full flex justify-center pointer-events-auto">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(140,56,16,0.18),transparent_38%)]"></div>
      </div>
      <div className="w-full flex justify-center pointer-events-auto">
        <div className="rounded-[28px] border border-gold/20 bg-black/18 p-2 shadow-[0_0_40px_rgba(0,0,0,0.45)] sm:p-3 lg:p-4">
          <GameContext.Provider value={value}>
            <div className="relative z-10 flex w-full flex-col items-center justify-center gap-6 sm:gap-8 lg:flex-row">
              <Board onGoToMenu={onBack} />
              <DiceTray />
            </div>
          </GameContext.Provider>
        </div>
      </div>
    </div>
  );
};
export default TutorialScreen;
