# 🎾 Tennis ELO System (Rally District)

## Initial Ratings

  Tier       Starting ELO
  ---------- --------------
  Class C    1900--2000
  Beginner   1200
  Unranked   1000

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

### 2. Class C vs Beginner (1900 vs 1200)

-   Expected (Class C) ≈ 0.98\
-   Expected (Beginner) ≈ 0.02

If Class C wins: - +1\
If Beginner loses: - -1

If Beginner wins: - +39\
If Class C loses: - -39

------------------------------------------------------------------------

### 3. Beginner vs Unranked (1200 vs 1000)

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
-   Strong players gain less from weaker opponents

------------------------------------------------------------------------

## Future Improvements

-   Provisional ratings (first 10 matches)
-   Confidence score (Glicko-style)
-   Match history weighting
