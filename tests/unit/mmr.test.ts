import { describe, it, expect } from 'vitest'
import { expectedScore, calculateMmr } from '../../server/utils/mmr'

describe('expectedScore', () => {
  it('returns 0.5 for equal ratings', () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5)
  })

  it('returns > 0.5 when player A has a higher rating', () => {
    expect(expectedScore(1200, 1000)).toBeGreaterThan(0.5)
  })

  it('returns < 0.5 when player A has a lower rating', () => {
    expect(expectedScore(1000, 1200)).toBeLessThan(0.5)
  })

  it('expected scores for A and B always sum to 1', () => {
    const a = 1400
    const b = 1100
    expect(expectedScore(a, b) + expectedScore(b, a)).toBeCloseTo(1)
  })

  it('is symmetric across multiple rating pairs', () => {
    const pairs = [
      [800, 800],
      [1000, 1200],
      [1500, 900],
    ] as [number, number][]

    for (const [a, b] of pairs) {
      expect(expectedScore(a, b) + expectedScore(b, a)).toBeCloseTo(1)
    }
  })

  it('never returns 0 or 1 (always strictly between)', () => {
    expect(expectedScore(3000, 100)).toBeGreaterThan(0)
    expect(expectedScore(3000, 100)).toBeLessThan(1)
    expect(expectedScore(100, 3000)).toBeGreaterThan(0)
    expect(expectedScore(100, 3000)).toBeLessThan(1)
  })
})

describe('calculateMmr', () => {
  it('winner gains MMR, loser loses MMR', () => {
    const { newWinnerMmr, newLoserMmr } = calculateMmr(1000, 1000)
    expect(newWinnerMmr).toBeGreaterThan(1000)
    expect(newLoserMmr).toBeLessThan(1000)
  })

  it('the sum of MMR is conserved (zero-sum)', () => {
    const winnerMmr = 1200
    const loserMmr = 1000
    const { newWinnerMmr, newLoserMmr } = calculateMmr(winnerMmr, loserMmr)
    expect(newWinnerMmr + newLoserMmr).toBeCloseTo(winnerMmr + loserMmr, -1)
  })

  it('underdog upset yields a larger MMR gain than expected win', () => {
    const { newWinnerMmr: upsetGain } = calculateMmr(1000, 1400)
    const { newWinnerMmr: expectedGain } = calculateMmr(1400, 1000)
    expect(upsetGain - 1000).toBeGreaterThan(expectedGain - 1400)
  })

  it('heavy favourite winning gains fewer than K=32 points', () => {
    const { newWinnerMmr } = calculateMmr(1600, 1000)
    expect(newWinnerMmr - 1600).toBeLessThan(32)
  })

  it('equal-rated match awards ~16 points to the winner (K/2)', () => {
    const { newWinnerMmr } = calculateMmr(1000, 1000)
    expect(newWinnerMmr - 1000).toBe(16)
  })

  it('returns integer MMR values (rounded)', () => {
    const { newWinnerMmr, newLoserMmr } = calculateMmr(1137, 983)
    expect(Number.isInteger(newWinnerMmr)).toBe(true)
    expect(Number.isInteger(newLoserMmr)).toBe(true)
  })
})
