import type { AssisteFinanceiroMessageFeedback } from '../message-feedback.model';
import {
  getFeedbackStatus,
  isSuccessfulRecovery,
  calculateMessageEffectiveness,
  FeedbackStatus,
} from '../message-feedback.model';

describe('MessageFeedback Model - Type and Logic Tests', () => {
  it('should define FeedbackStatus enum correctly', () => {
    expect(FeedbackStatus.PENDING).toBe('pending');
    expect(FeedbackStatus.RESPONDED).toBe('responded');
    expect(FeedbackStatus.RETURNED).toBe('returned');
    expect(FeedbackStatus.NO_RESPONSE).toBe('no_response');
  });

  it('should get feedback status for pending state', () => {
    const status = getFeedbackStatus(null, null);
    expect(status).toBe(FeedbackStatus.PENDING);
  });

  it('should get feedback status for returned state', () => {
    const status = getFeedbackStatus(null, true);
    expect(status).toBe(FeedbackStatus.RETURNED);

    const status2 = getFeedbackStatus(true, true);
    expect(status2).toBe(FeedbackStatus.RETURNED);
  });

  it('should get feedback status for responded state', () => {
    const status = getFeedbackStatus(true, false);
    expect(status).toBe(FeedbackStatus.RESPONDED);
  });

  it('should get feedback status for no response state', () => {
    const status = getFeedbackStatus(false, false);
    expect(status).toBe(FeedbackStatus.NO_RESPONSE);
  });

  it('should determine successful recovery', () => {
    const successful = isSuccessfulRecovery(true, 100);
    expect(successful).toBe(true);

    const unsuccessful1 = isSuccessfulRecovery(false, 0);
    expect(unsuccessful1).toBe(false);

    const unsuccessful2 = isSuccessfulRecovery(true, 0);
    expect(unsuccessful2).toBe(false);

    const unsuccessful3 = isSuccessfulRecovery(false, 100);
    expect(unsuccessful3).toBe(false);
  });

  it('should calculate message effectiveness correctly', () => {
    const full = calculateMessageEffectiveness(null, true);
    expect(full).toBe(100);

    const partial = calculateMessageEffectiveness(true, false);
    expect(partial).toBe(50);

    const none1 = calculateMessageEffectiveness(false, false);
    expect(none1).toBe(0);

    const none2 = calculateMessageEffectiveness(false, null);
    expect(none2).toBe(0);

    const unknown = calculateMessageEffectiveness(null, null);
    expect(unknown).toBe(0);
  });
});
