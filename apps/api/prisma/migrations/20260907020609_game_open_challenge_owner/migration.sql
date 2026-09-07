-- One open challenge per user: nullable unique owner id, set while PENDING.
ALTER TABLE `Game` ADD COLUMN `openChallengeOwnerId` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `Game_openChallengeOwnerId_key` ON `Game`(`openChallengeOwnerId`);
