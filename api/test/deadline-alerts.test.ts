import { findMatchingThreshold, getDaysUntilExpiry } from '../src/jobs/deadline-alerts.job';
import { epochToTimestamp, EPOCH_LENGTH_SECONDS } from '../src/utils/epoch.utils';

describe('findMatchingThreshold', () => {
  test('exact match: daysRemaining=7, alertDays=[7,3,1]', () => {
    expect(findMatchingThreshold(7, [7, 3, 1])).toBe(7);
  });

  test('exact match: daysRemaining=3, alertDays=[7,3,1]', () => {
    expect(findMatchingThreshold(3, [7, 3, 1])).toBe(3);
  });

  test('exact match: daysRemaining=1, alertDays=[7,3,1]', () => {
    expect(findMatchingThreshold(1, [7, 3, 1])).toBe(1);
  });

  test('no match: daysRemaining=5, alertDays=[7,3,1]', () => {
    expect(findMatchingThreshold(5, [7, 3, 1])).toBeNull();
  });

  test('no match: daysRemaining=10, alertDays=[7,3,1]', () => {
    expect(findMatchingThreshold(10, [7, 3, 1])).toBeNull();
  });

  test('no match: daysRemaining=0 (expired)', () => {
    expect(findMatchingThreshold(0, [7, 3, 1])).toBeNull();
  });

  test('unordered thresholds: alertDays=[1,7,3]', () => {
    expect(findMatchingThreshold(3, [1, 7, 3])).toBe(3);
  });

  test('single threshold: alertDays=[7]', () => {
    expect(findMatchingThreshold(7, [7])).toBe(7);
    expect(findMatchingThreshold(3, [7])).toBeNull();
  });

  test('edge case: negative daysRemaining', () => {
    expect(findMatchingThreshold(-1, [7, 3, 1])).toBeNull();
  });

  test('edge case: empty alertDays array', () => {
    expect(findMatchingThreshold(7, [])).toBeNull();
  });

  test('epoch boundary aligned thresholds: [10, 5, 1]', () => {
    expect(findMatchingThreshold(10, [10, 5, 1])).toBe(10);
    expect(findMatchingThreshold(5, [10, 5, 1])).toBe(5);
    expect(findMatchingThreshold(1, [10, 5, 1])).toBe(1);
    expect(findMatchingThreshold(7, [10, 5, 1])).toBeNull();
  });
});

describe('getDaysUntilExpiry (timestamp-based)', () => {
  test('beginning of epoch: 15 days remaining', () => {
    const epoch610Start = epochToTimestamp(610);
    const expirationEpoch = 614; // Voting ends at END of epoch 612 (3 full epochs away)
    const days = getDaysUntilExpiry(expirationEpoch, epoch610Start);
    expect(days).toBe(15); // 3 full epochs = 15 days
  });

  test('middle of epoch: 13 days remaining', () => {
    const epoch610Start = epochToTimestamp(610);
    const midEpoch610 = epoch610Start + EPOCH_LENGTH_SECONDS / 2; // 2.5 days into epoch
    const expirationEpoch = 614; // Voting ends at END of epoch 612 (2.5 epochs away from midpoint)
    const days = getDaysUntilExpiry(expirationEpoch, midEpoch610);
    expect(days).toBe(13); // 2.5 epochs = 12.5 days → ceil = 13 days
  });

  test('end of epoch: 6 days remaining', () => {
    const epoch611Start = epochToTimestamp(611);
    const oneSecBeforeEpoch611 = epoch611Start - 1; // END of epoch 610
    const expirationEpoch = 614; // Voting ends at END of epoch 612
    const days = getDaysUntilExpiry(expirationEpoch, oneSecBeforeEpoch611);
    expect(days).toBe(10); // 2 full epochs = 10 days
  });

  test('exact epoch boundary: 5 days remaining', () => {
    const epoch611Start = epochToTimestamp(611);
    const expirationEpoch = 613; // Voting ends at END of epoch 611
    const days = getDaysUntilExpiry(expirationEpoch, epoch611Start);
    expect(days).toBe(5); // Exactly 1 epoch = 5 days (to END of epoch 611)
  });

  test('already expired: 0 days (at expiration)', () => {
    const epoch612Start = epochToTimestamp(612);
    const expirationEpoch = 613; // Voting ends at END of epoch 611
    const days = getDaysUntilExpiry(expirationEpoch, epoch612Start);
    expect(days).toBe(0); // Past the END of epoch 611, so expired
  });

  test('1 second before expiration: rounds up to 1 day', () => {
    const oneSecBeforeEndEpoch611 = epochToTimestamp(612) - 2; // 2 seconds before epoch 612 = 1 second before END of 611
    const expirationEpoch = 613; // Voting ends at END of epoch 611
    const days = getDaysUntilExpiry(expirationEpoch, oneSecBeforeEndEpoch611);
    expect(days).toBe(1); // 1 second remaining rounds up to 1 day
  });

  test('exactly at expiration moment: 0 days', () => {
    const endOfEpoch611 = epochToTimestamp(612) - 1; // Exact END of epoch 611
    const expirationEpoch = 613; // Voting ends at END of epoch 611
    const days = getDaysUntilExpiry(expirationEpoch, endOfEpoch611);
    expect(days).toBe(0); // At exact expiration, 0 days remaining
  });

  test('past expiration: 0 days', () => {
    const epoch613Start = epochToTimestamp(613);
    const expirationEpoch = 613; // Voting ends at END of epoch 611
    const days = getDaysUntilExpiry(expirationEpoch, epoch613Start);
    expect(days).toBe(0);
  });
});
