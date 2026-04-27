/**
 * Pure ELO calculation utilities — no DB access, fully testable.
 * K=32, standard formula.
 */

const K = 32

/**
 * Expected score for player A given ratings a and b.
 * Returns a value in (0, 1).
 */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))
}

/**
 * Calculate new ELO ratings after a match.
 * @param winnerElo  current ELO of the winner
 * @param loserElo   current ELO of the loser
 * @returns { newWinnerElo, newLoserElo }
 */
export function calculateElo(
  winnerElo: number,
  loserElo: number,
): { newWinnerElo: number; newLoserElo: number } {
  const expectedWin = expectedScore(winnerElo, loserElo)
  const expectedLoss = expectedScore(loserElo, winnerElo)

  const newWinnerElo = Math.round(winnerElo + K * (1 - expectedWin))
  const newLoserElo = Math.round(loserElo + K * (0 - expectedLoss))

  return { newWinnerElo, newLoserElo }
}