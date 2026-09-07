-- Backfill openChallengeOwnerId for challenges that predate the column.
-- The unique index already exists, so duplicates must be resolved first.

-- 1. Keep only the most recent PENDING challenge per user; abandon the rest.
UPDATE `Game` AS g
JOIN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(`whiteId`, `blackId`)
        ORDER BY `createdAt` DESC, `id` DESC
      ) AS rn
    FROM `Game`
    WHERE `status` = 'PENDING'
      AND COALESCE(`whiteId`, `blackId`) IS NOT NULL
  ) ranked
  WHERE ranked.rn > 1
) AS stale ON stale.id = g.id
SET g.`status` = 'ABANDONED',
    g.`endedAt` = CURRENT_TIMESTAMP(3);

-- 2. Claim the ownership slot for each surviving open challenge.
UPDATE `Game`
SET `openChallengeOwnerId` = COALESCE(`whiteId`, `blackId`)
WHERE `status` = 'PENDING'
  AND `openChallengeOwnerId` IS NULL
  AND COALESCE(`whiteId`, `blackId`) IS NOT NULL;
