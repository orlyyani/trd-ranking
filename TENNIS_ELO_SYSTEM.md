# Tennis ELO System (Rally District)

## Ranking Tiers

  Tier           Starting MMR   MMR Range     Description
  -------------- -------------- ------------- --------------------------------------------
  Unranked       1000           —             Placement phase — fewer than 5 matches played
  Beginner       1000           1000–1499     Casual/newer players developing consistency
  Class C        1500           1500–1899     Competitive intermediate players
  Class B        1900           1900–2199     Strong advanced club players
  Class A / Open 2200           2200+         Elite local competitive players

Tier is assigned by an admin when a player is registered. Starting MMR resets to the
tier's base value whenever the tier is changed, and all match history is replayed
from that new baseline to keep ratings consistent.

------------------------------------------------------------------------

## ELO Formula

R' = R + K(S - E)

Where:
- R' = new rating
- R  = current rating
- K  = K-factor (see below)
- S  = result (1 = win, 0 = lose)
- E  = expected score

------------------------------------------------------------------------

## Expected Score Formula

E = 1 / (1 + 10^((R_opponent - R_player) / 400))

------------------------------------------------------------------------

## K-Factor Rules

### Singles

- First 5 matches (placement) → K = 40
- After 5 matches             → K = 20

### Doubles

- First 5 matches (placement) → K = 20
- After 5 matches             → K = 10

Doubles uses half the singles K-factor because each player shares the
result with a partner, reducing individual variance per match.

------------------------------------------------------------------------

## Placement Phase

New players start in the **Unranked** tier with a provisional MMR of 1000.
The higher K-factor (40 for singles, 20 for doubles) during the first 5 matches
allows the rating to move quickly toward its true level. After 5 matches the
K-factor drops and the rating stabilises.

------------------------------------------------------------------------

## Example Computations

### 1. Beginner vs Beginner — equal rating (1000 vs 1000), post-placement

- Expected = 0.5, K = 20

If Player A wins:  +10  (Player A), −10 (Player B)
If Player A loses: −10  (Player A), +10 (Player B)

------------------------------------------------------------------------

### 2. Class B vs Beginner (1900 vs 1000), post-placement

- Expected (Class B)  ≈ 0.997
- Expected (Beginner) ≈ 0.003

If Class B wins:   +1   (Class B),  −1  (Beginner)
If Beginner wins:  +39  (Beginner), −39 (Class B)

------------------------------------------------------------------------

### 3. Beginner vs Unranked — placement match (1050 vs 1000)

Unranked player is still in placement (K = 40); Beginner is post-placement (K = 20).

- Expected (Beginner) ≈ 0.57
- Expected (Unranked) ≈ 0.43

If Beginner wins:  +9   (Beginner, K=20), −23 (Unranked, K=40)
If Unranked wins:  −11  (Beginner, K=20), +23 (Unranked, K=40)

------------------------------------------------------------------------

## Recalculation

Ratings are **fully replayable** from match history. Running `recalculate_all_mmr()`
resets every player to their tier's starting MMR, clears the history log, then
replays every recorded match in chronological order. The result is always identical
for the same match history and tier assignments.

This is triggered automatically whenever a player's tier is changed via the admin
panel, ensuring MMR always reflects the correct baseline.

------------------------------------------------------------------------

## Notes

- ELO self-corrects over time — consistent results against similarly-rated opponents
  gradually shift a player's MMR to its true level.
- Upsets reward more points. The larger the rating gap, the bigger the swing.
- Strong players gain very little from beating much weaker opponents.
- Players exit the placement phase after 5 matches, after which ratings are considered
  stable and the K-factor halves.

------------------------------------------------------------------------

## Possible Future Improvements

- Confidence score (Glicko-style RD) to quantify rating uncertainty
- Match history decay / time-weighted ratings for inactive players
- Surface-specific ratings (clay, hard, grass, indoor)
