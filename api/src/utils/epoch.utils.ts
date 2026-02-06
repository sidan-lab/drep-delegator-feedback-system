/**
 * Epoch timing constants for Cardano blockchain
 * Reference: Shelley era start (epoch 208)
 */
export const SHELLEY_START_EPOCH = 208;
export const SHELLEY_START_TIMESTAMP = 1596491091; // July 29, 2020 21:44:51 UTC
export const EPOCH_LENGTH_SECONDS = 432000; // 5 days
export const EPOCH_LENGTH_DAYS = 5;

/**
 * Convert Cardano epoch number to Unix timestamp (seconds)
 * Returns the timestamp of the epoch BOUNDARY (when the epoch STARTS)
 *
 * @param epoch - Cardano epoch number
 * @returns Unix timestamp in seconds (epoch START time)
 *
 * @example
 * epochToTimestamp(613) // Returns 1771067091 (Feb 18, 2026 21:44:51 UTC - START of epoch 613)
 *
 * @note For expiration calculations: If expirationEpoch = N, voting ends at epochToTimestamp(N - 1) - 1
 */
export function epochToTimestamp(epoch: number): number {
  const epochDiff = epoch - SHELLEY_START_EPOCH;
  return SHELLEY_START_TIMESTAMP + epochDiff * EPOCH_LENGTH_SECONDS;
}

/**
 * Convert Unix timestamp to epoch number
 * @param timestamp - Unix timestamp in seconds
 * @returns Cardano epoch number
 */
export function timestampToEpoch(timestamp: number): number {
  if (timestamp < SHELLEY_START_TIMESTAMP) {
    return 0; // Before Shelley era
  }
  return (
    SHELLEY_START_EPOCH +
    Math.floor((timestamp - SHELLEY_START_TIMESTAMP) / EPOCH_LENGTH_SECONDS)
  );
}

/**
 * Get exact timestamp when a specific epoch ends (same as next epoch start)
 * @param epoch - Cardano epoch number
 * @returns Unix timestamp (seconds) when the epoch ends
 */
export function getEpochEndTimestamp(epoch: number): number {
  return epochToTimestamp(epoch + 1);
}

/**
 * Calculate seconds remaining until start of target epoch
 * @param targetEpoch - Target epoch number
 * @param currentTimestamp - Current Unix timestamp in seconds
 * @returns Seconds remaining (0 if already past)
 */
export function getSecondsUntilEpoch(
  targetEpoch: number,
  currentTimestamp: number
): number {
  const targetTimestamp = epochToTimestamp(targetEpoch);
  return Math.max(0, targetTimestamp - currentTimestamp);
}
