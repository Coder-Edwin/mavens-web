-- AlterTable
ALTER TABLE `Session` ADD COLUMN `classScheduleId` VARCHAR(191) NULL,
    ADD COLUMN `endsAt` DATETIME(3) NULL,
    ADD COLUMN `startsAt` DATETIME(3) NULL,
    ADD COLUMN `status` ENUM('SCHEDULED', 'COMPLETED', 'CANCELLED', 'LOGGED') NOT NULL DEFAULT 'LOGGED';

-- CreateTable
CREATE TABLE `Term` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `status` ENUM('PLANNED', 'ACTIVE', 'CLOSED') NOT NULL DEFAULT 'PLANNED',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Term_status_startDate_idx`(`status`, `startDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClassSchedule` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `deliveryType` ENUM('HOME', 'CENTER', 'SCHOOL_GROUP') NOT NULL,
    `schoolGroupId` VARCHAR(191) NULL,
    `level` ENUM('NOVICE', 'INTERMEDIATE', 'ADVANCED') NULL,
    `coachId` VARCHAR(191) NULL,
    `venue` VARCHAR(191) NULL,
    `weekday` INTEGER NOT NULL,
    `startTime` VARCHAR(191) NOT NULL,
    `durationMinutes` INTEGER NOT NULL DEFAULT 60,
    `termId` VARCHAR(191) NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NULL,
    `status` ENUM('ACTIVE', 'PAUSED', 'ENDED') NOT NULL DEFAULT 'ACTIVE',
    `capacity` INTEGER NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ClassSchedule_status_weekday_idx`(`status`, `weekday`),
    INDEX `ClassSchedule_schoolGroupId_idx`(`schoolGroupId`),
    INDEX `ClassSchedule_coachId_idx`(`coachId`),
    INDEX `ClassSchedule_termId_idx`(`termId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Session_status_date_idx` ON `Session`(`status`, `date`);

-- CreateIndex
CREATE INDEX `Session_classScheduleId_idx` ON `Session`(`classScheduleId`);

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_classScheduleId_fkey` FOREIGN KEY (`classScheduleId`) REFERENCES `ClassSchedule`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClassSchedule` ADD CONSTRAINT `ClassSchedule_schoolGroupId_fkey` FOREIGN KEY (`schoolGroupId`) REFERENCES `SchoolGroup`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClassSchedule` ADD CONSTRAINT `ClassSchedule_coachId_fkey` FOREIGN KEY (`coachId`) REFERENCES `CoachProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClassSchedule` ADD CONSTRAINT `ClassSchedule_termId_fkey` FOREIGN KEY (`termId`) REFERENCES `Term`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

