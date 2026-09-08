-- AlterTable
ALTER TABLE `Tournament` ADD COLUMN `totalRounds` INTEGER NULL;

-- AlterTable
ALTER TABLE `TournamentRegistration` ADD COLUMN `seed` INTEGER NULL,
    ADD COLUMN `withdrawn` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `TournamentRound` (
    `id` VARCHAR(191) NOT NULL,
    `tournamentId` VARCHAR(191) NOT NULL,
    `number` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'PAIRED', 'COMPLETED') NOT NULL DEFAULT 'PAIRED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `TournamentRound_tournamentId_number_key`(`tournamentId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TournamentPairing` (
    `id` VARCHAR(191) NOT NULL,
    `roundId` VARCHAR(191) NOT NULL,
    `board` INTEGER NOT NULL,
    `whiteRegistrationId` VARCHAR(191) NOT NULL,
    `blackRegistrationId` VARCHAR(191) NULL,
    `result` ENUM('WHITE_WIN', 'BLACK_WIN', 'DRAW', 'BYE') NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TournamentPairing_roundId_board_idx`(`roundId`, `board`),
    INDEX `TournamentPairing_whiteRegistrationId_idx`(`whiteRegistrationId`),
    INDEX `TournamentPairing_blackRegistrationId_idx`(`blackRegistrationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TournamentRound` ADD CONSTRAINT `TournamentRound_tournamentId_fkey` FOREIGN KEY (`tournamentId`) REFERENCES `Tournament`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TournamentPairing` ADD CONSTRAINT `TournamentPairing_roundId_fkey` FOREIGN KEY (`roundId`) REFERENCES `TournamentRound`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TournamentPairing` ADD CONSTRAINT `TournamentPairing_whiteRegistrationId_fkey` FOREIGN KEY (`whiteRegistrationId`) REFERENCES `TournamentRegistration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TournamentPairing` ADD CONSTRAINT `TournamentPairing_blackRegistrationId_fkey` FOREIGN KEY (`blackRegistrationId`) REFERENCES `TournamentRegistration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

