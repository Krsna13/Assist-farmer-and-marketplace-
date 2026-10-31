import {
  calculateFreshness,
  formatLocalDateTime,
  FRESHNESS_THRESHOLDS,
  FRESHNESS_DISCLAIMER,
} from './freshnessUtils';

describe('freshnessUtils', () => {
  const baseNow = new Date('2026-10-23T12:00:00Z').getTime();

  test('evaluates photos received within 24 hours as Fresh', () => {
    const received1hAgo = new Date(baseNow - 1 * 60 * 60 * 1000).toISOString();
    const result = calculateFreshness(received1hAgo, baseNow);
    expect(result.status).toBe('fresh');
    expect(result.label).toContain('Fresh');
    expect(result.badgeColor).toContain('emerald');
  });

  test('evaluates photos exactly at 24 hours threshold as Fresh', () => {
    const received24hAgo = new Date(baseNow - FRESHNESS_THRESHOLDS.FRESH_MAX_MS).toISOString();
    const result = calculateFreshness(received24hAgo, baseNow);
    expect(result.status).toBe('fresh');
  });

  test('evaluates photos received between 24 hours and 7 days as Recent', () => {
    const received3DaysAgo = new Date(baseNow - 3 * 24 * 60 * 60 * 1000).toISOString();
    const result = calculateFreshness(received3DaysAgo, baseNow);
    expect(result.status).toBe('recent');
    expect(result.label).toContain('Recent');
    expect(result.badgeColor).toContain('amber');
  });

  test('evaluates photos older than 7 days as Stale', () => {
    const received10DaysAgo = new Date(baseNow - 10 * 24 * 60 * 60 * 1000).toISOString();
    const result = calculateFreshness(received10DaysAgo, baseNow);
    expect(result.status).toBe('stale');
    expect(result.label).toContain('Stale');
    expect(result.badgeColor).toContain('rose');
  });

  test('evaluates null or undefined timestamp as No Photo', () => {
    const resultNull = calculateFreshness(null, baseNow);
    expect(resultNull.status).toBe('no_photo');
    expect(resultNull.label).toBe('No Photo');

    const resultUndefined = calculateFreshness(undefined, baseNow);
    expect(resultUndefined.status).toBe('no_photo');
  });

  test('handles invalid date strings gracefully', () => {
    const resultInvalid = calculateFreshness('NOT_A_VALID_DATE', baseNow);
    expect(resultInvalid.status).toBe('no_photo');
    expect(resultInvalid.label).toBe('Invalid Timestamp');
  });

  test('formatLocalDateTime formats dates and handles invalid inputs', () => {
    const formatted = formatLocalDateTime('2026-10-23T12:30:00Z');
    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(0);

    expect(formatLocalDateTime(null)).toBe('N/A');
    expect(formatLocalDateTime('invalid-date')).toBe('Invalid Date');
  });

  test('exports standard policy disclaimer', () => {
    expect(FRESHNESS_DISCLAIMER).toContain('Freshness indicates when this photograph was received');
    expect(FRESHNESS_DISCLAIMER).toContain('does not independently guarantee crop condition');
  });
});
