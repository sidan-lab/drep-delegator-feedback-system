import {
  epochToTimestamp,
  timestampToEpoch,
  getSecondsUntilEpoch,
  SHELLEY_START_TIMESTAMP,
  EPOCH_LENGTH_SECONDS,
} from "../../src/utils/epoch.utils";

describe("Epoch Utilities", () => {
  test("epochToTimestamp: epoch 208 returns Shelley start", () => {
    expect(epochToTimestamp(208)).toBe(SHELLEY_START_TIMESTAMP);
  });

  test("epochToTimestamp: epoch 209 is 5 days after epoch 208", () => {
    const epoch208Start = epochToTimestamp(208);
    const epoch209Start = epochToTimestamp(209);
    expect(epoch209Start - epoch208Start).toBe(EPOCH_LENGTH_SECONDS);
  });

  test("timestampToEpoch: Shelley start returns epoch 208", () => {
    expect(timestampToEpoch(SHELLEY_START_TIMESTAMP)).toBe(208);
  });

  test("timestampToEpoch: 1 second before epoch 209 returns epoch 208", () => {
    const oneSecBeforeEpoch209 = epochToTimestamp(209) - 1;
    expect(timestampToEpoch(oneSecBeforeEpoch209)).toBe(208);
  });

  test("getSecondsUntilEpoch: 5 days remaining", () => {
    const currentTime = epochToTimestamp(610);
    const targetEpoch = 611;
    expect(getSecondsUntilEpoch(targetEpoch, currentTime)).toBe(EPOCH_LENGTH_SECONDS);
  });

  test("getSecondsUntilEpoch: past epoch returns 0", () => {
    const currentTime = epochToTimestamp(611);
    const targetEpoch = 610;
    expect(getSecondsUntilEpoch(targetEpoch, currentTime)).toBe(0);
  });

  test("getSecondsUntilEpoch: mid-epoch calculation", () => {
    const epoch610Start = epochToTimestamp(610);
    const midEpoch610 = epoch610Start + EPOCH_LENGTH_SECONDS / 2; // 2.5 days into epoch
    const targetEpoch = 612;

    const expected = EPOCH_LENGTH_SECONDS * 1.5; // 1.5 epochs = 7.5 days
    expect(getSecondsUntilEpoch(targetEpoch, midEpoch610)).toBe(expected);
  });
});
