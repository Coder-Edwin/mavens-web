-- CreateTable
CREATE TABLE `Game` (
    `id` VARCHAR(191) NOT NULL,
    `whiteId` VARCHAR(191) NULL,
    `blackId` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'ACTIVE', 'FINISHED', 'ABANDONED') NOT NULL DEFAULT 'PENDING',
    `result` ENUM('WHITE_WINS', 'BLACK_WINS', 'DRAW') NULL,
    `resultReason` VARCHAR(191) NULL,
    `fen` TEXT NOT NULL,
    `pgn` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `endedAt` DATETIME(3) NULL,

    INDEX `Game_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Game` ADD CONSTRAINT `Game_whiteId_fkey` FOREIGN KEY (`whiteId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Game` ADD CONSTRAINT `Game_blackId_fkey` FOREIGN KEY (`blackId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
