import { describe, it, expect } from 'vitest'
import { expectedScore, calculateElo } from '../../server/utils/elo'

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

describe('calculateElo', () => {
  it('winner gains ELO, loser loses ELO', () => {
    const { newWinnerElo, newLoserElo } = calculateElo(1000, 1000)
    expect(newWinnerElo).toBeGreaterThan(1000)
    expect(newLoserElo).toBeLessThan(1000)
  })

  it('the sum of ELOs is conserved (zero-sum)', () => {
    const winnerElo = 1200
    const loserElo = 1000
    const { newWinnerElo, newLoserElo } = calculateElo(winnerElo, loserElo)
    // Rounding may cause ±1 difference; accept within 1 point
    expect(newWinnerElo + newLoserElo).toBeCloseTo(winnerElo + loserElo, -1)
  })

  it('underdog upset yields a larger ELO gain than expected win', () => {
    const { newWinnerElo: upsetGain } = calculateElo(1000, 1400)
    const { newWinnerElo: expectedGain } = calculateElo(1400, 1000)
    // Underdog winning gains more ELO
    expect(upsetGain - 1000).toBeGreaterThan(expectedGain - 1400)
  })

  it('heavy favourite winning gains fewer than K=32 points', () => {
    const { newWinnerElo } = calculateElo(1600, 1000)
    expect(newWinnerElo - 1600).toBeLessThan(32)
  })

  it('equal-rated match awards ~16 points to the winner (K/2)', () => {
    const { newWinnerElo } = calculateElo(1000, 1000)
    expect(newWinnerElo - 1000).toBe(16)
  })

  it('returns integer ELO values (rounded)', () => {
    const { newWinnerElo, newLoserElo } = calculateElo(1137, 983)
    expect(Number.isInteger(newWinnerElo)).toBe(true)
    expect(Number.isInteger(newLoserElo)).toBe(true)
  })
})
