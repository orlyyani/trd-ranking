/**
 * Pure MMR calculation utilities — no DB access, fully testable.
 * Variable K-factor per TENNIS_ELO_SYSTEM.md:
 *   K=40 for first 10 matches, K=20 after.
 */

export const TIER_STARTING_MMR = {
  class_c:  1950,
  beginner: 1200,
  unranked: 1000,
} as const

export type PlayerTier = keyof typeof TIER_STARTING_MMR

export const VALID_TIERS = Object.keys(TIER_STARTING_MMR) as PlayerTier[]

export function isValidTier(value: unknown): value is PlayerTier {
  return VALID_TIERS.includes(value as PlayerTier)
}

function kFactor(matchCount: number): number {
  return matchCount < 10 ? 40 : 20
}

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))
}

/**
 * Calculate new MMR ratings after a match.
 * @param winnerMatchCount  matches played by the winner BEFORE this match
 * @param loserMatchCount   matches played by the loser BEFORE this match
 */
export function calculateMmr(
  winnerMmr: number,
  loserMmr: number,
  winnerMatchCount = 0,
  loserMatchCount = 0,
): { newWinnerMmr: number; newLoserMmr: number } {
  const kW = kFactor(winnerMatchCount)
  const kL = kFactor(loserMatchCount)

  const expectedWin  = expectedScore(winnerMmr, loserMmr)
  const expectedLoss = expectedScore(loserMmr, winnerMmr)

  const newWinnerMmr = Math.round(winnerMmr + kW * (1 - expectedWin))
  const newLoserMmr  = Math.round(loserMmr  + kL * (0 - expectedLoss))

  return { newWinnerMmr, newLoserMmr }
}
