import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getUtcDayKey, normalizeEconomyState } from './economy';

const serviceMocks = vi.hoisted(() => ({
  claimDailyReward: vi.fn(),
  claimGoalReward: vi.fn(),
  claimRewardMultiplier: vi.fn(),
  getEconomyIdentity: vi.fn(() => 'test-user'),
  loadEconomy: vi.fn(),
  recordOnlineGoalProgress: vi.fn(),
  refundPublicMatchEntry: vi.fn(),
  reservePublicMatchEntry: vi.fn(),
  settlePublicMatch: vi.fn(),
}));

vi.mock('./economyService.js', () => serviceMocks);

import { EconomyProvider, useEconomy } from './EconomyContext';

const EconomyProbe = () => {
  const {
    balance,
    dailyRewardAvailable,
    isClaimingDailyReward,
    claimDailyReward,
  } = useEconomy();

  return (
    <>
      <output data-testid="probe-balance">{balance}</output>
      <output data-testid="probe-available">{String(dailyRewardAvailable)}</output>
      <output data-testid="probe-claiming">{String(isClaimingDailyReward)}</output>
      <button type="button" onClick={claimDailyReward}>Claim</button>
    </>
  );
};

describe('EconomyProvider daily reward', () => {
  beforeEach(() => {
    serviceMocks.loadEconomy.mockReset().mockResolvedValue(normalizeEconomyState());
    serviceMocks.claimDailyReward.mockReset().mockResolvedValue({
      applied: true,
      event: {
        delta: 500,
        dayKey: getUtcDayKey(),
      },
      state: normalizeEconomyState({
        coins: 500,
        lastDailyRewardDay: getUtcDayKey(),
      }),
    });
  });

  it('loads without granting coins and awards the reward only after a claim', async () => {
    render(
      <EconomyProvider user={{ uid: 'test-user', isAnonymous: true }}>
        <EconomyProbe />
      </EconomyProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('probe-available')).toHaveTextContent('true'));
    expect(screen.getByTestId('probe-balance')).toHaveTextContent('0');
    expect(serviceMocks.claimDailyReward).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Claim' }));

    await waitFor(() => expect(screen.getByTestId('probe-balance')).toHaveTextContent('500'));
    expect(screen.getByTestId('probe-available')).toHaveTextContent('false');
    expect(screen.getByTestId('probe-claiming')).toHaveTextContent('false');
    expect(serviceMocks.claimDailyReward).toHaveBeenCalledOnce();
  });
});
