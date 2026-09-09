-- AlterTable
ALTER TABLE `Game` ADD COLUMN `blackMs` INTEGER NULL,
    ADD COLUMN `clockUpdatedAt` DATETIME(3) NULL,
    ADD COLUMN `initialSeconds` INTEGER NULL,
    ADD COLUMN `whiteMs` INTEGER NULL;

