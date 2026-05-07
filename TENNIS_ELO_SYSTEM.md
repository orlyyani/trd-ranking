# Tennis ELO System (Rally District)

## Ranking Tiers

  Tier           MMR Range     Description
  -------------- ------------- --------------------------------------------
  Unranked       —             Placement phase — new players, not enough matches yet
  Beginner       1000–1499     Casual/newer players developing consistency
  Class C        1500–1899     Competitive intermediate players
  Class B        1900–2199     Strong advanced club players
  Class A / Open 2200+         Elite local competitive players

------------------------------------------------------------------------

## ELO Formula

R' = R + K(S - E)

Where: - R' = new rating\
- R = current rating\
- K = factor (40 early, 20 later)\
- S = result (1 = win, 0 = lose)\
- E = expected score

------------------------------------------------------------------------

## Expected Score Formula

E = 1 / (1 + 10\^((R_opponent - R_player)/400))

------------------------------------------------------------------------

## Example Computations

### 1. Beginner vs Beginner (1200 vs 1200)

-   Expected = 0.5

If Player A wins: - +20\
If Player A loses: - -20

------------------------------------------------------------------------

### 2. Class B vs Beginner (1950 vs 1200)

-   Expected (Class B) ≈ 0.98\
-   Expected (Beginner) ≈ 0.02

If Class B wins: - +1\
If Beginner loses: - -1

If Beginner wins: - +39\
If Class B loses: - -39

------------------------------------------------------------------------

### 3. Beginner vs Unranked placement (1200 vs 1000)

-   Expected (Beginner) ≈ 0.76\
-   Expected (Unranked) ≈ 0.24

If Beginner wins: - +10\
If Unranked loses: - -10

If Unranked wins: - +30\
If Beginner loses: - -30

------------------------------------------------------------------------

## K-Factor Rules

-   First 10 matches → K = 40\
-   After 10 matches → K = 20

------------------------------------------------------------------------

## Notes

-   ELO self-corrects over time\
-   Upsets give higher rewards\
-   Strong players gain less from weaker opponents\
-   Unranked (placement) players exit placement after 10 matches

------------------------------------------------------------------------

## Future Improvements

-   Provisional ratings (first 10 matches)
-   Confidence score (Glicko-style)
-   Match history weighting
