-- AlterTable
ALTER TABLE `CoachProfile` ADD COLUMN `employmentType` ENUM('STAFF', 'CONSULTANT') NOT NULL DEFAULT 'STAFF',
    ADD COLUMN `skills` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Lead` ADD COLUMN `convertedToStudentId` VARCHAR(191) NULL,
    ADD COLUMN `priorExperience` TEXT NULL,
    ADD COLUMN `selfAssessedLevel` ENUM('NOVICE', 'INTERMEDIATE', 'ADVANCED') NULL;

-- AlterTable
ALTER TABLE `ParentProfile` ADD COLUMN `communicationPreference` ENUM('SMS', 'WHATSAPP', 'EMAIL') NOT NULL DEFAULT 'WHATSAPP',
    ADD COLUMN `phone` VARCHAR(191) NULL,
    ADD COLUMN `preferredPaymentMethod` ENUM('MPESA', 'CASH', 'OTHER') NOT NULL DEFAULT 'MPESA';

-- AlterTable
ALTER TABLE `StudentProfile` ADD COLUMN `homeAddress` VARCHAR(191) NULL,
    ADD COLUMN `level` ENUM('NOVICE', 'INTERMEDIATE', 'ADVANCED') NULL,
    ADD COLUMN `priorExperience` TEXT NULL;

-- CreateTable
CREATE TABLE `SchoolGroup` (
    `id` VARCHAR(191) NOT NULL,
    `institutionName` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NULL,
    `coordinatorName` VARCHAR(191) NULL,
    `coordinatorPhone` VARCHAR(191) NULL,
    `coordinatorEmail` VARCHAR(191) NULL,
    `agreedGroupSize` INTEGER NULL,
    `status` ENUM('PROSPECT', 'ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'PROSPECT',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SchoolGroup_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Enrollment` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `deliveryType` ENUM('HOME', 'CENTER', 'SCHOOL_GROUP') NOT NULL,
    `schoolGroupId` VARCHAR(191) NULL,
    `clientType` ENUM('INDIVIDUAL', 'INSTITUTION') NOT NULL DEFAULT 'INDIVIDUAL',
    `level` ENUM('NOVICE', 'INTERMEDIATE', 'ADVANCED') NULL,
    `assignedCoachId` VARCHAR(191) NULL,
    `status` ENUM('PENDING_PLACEMENT', 'WAITLISTED', 'ACTIVE', 'PAUSED', 'WITHDRAWN') NOT NULL DEFAULT 'PENDING_PLACEMENT',
    `startDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endDate` DATETIME(3) NULL,
    `pausedFrom` DATETIME(3) NULL,
    `pausedTo` DATETIME(3) NULL,
    `waitlistNote` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Enrollment_studentId_status_idx`(`studentId`, `status`),
    INDEX `Enrollment_status_deliveryType_idx`(`status`, `deliveryType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EnrollmentEvent` (
    `id` VARCHAR(191) NOT NULL,
    `enrollmentId` VARCHAR(191) NOT NULL,
    `type` ENUM('CREATED', 'PLACED', 'LEVEL_CHANGE', 'COACH_CHANGE', 'DELIVERY_CHANGE', 'PAUSED', 'RESUMED', 'WITHDRAWN', 'WAITLISTED') NOT NULL,
    `fromValue` VARCHAR(191) NULL,
    `toValue` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `byUserId` VARCHAR(191) NULL,
    `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EnrollmentEvent_enrollmentId_at_idx`(`enrollmentId`, `at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlacementAssessment` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `enrollmentId` VARCHAR(191) NULL,
    `scheduledFor` DATETIME(3) NULL,
    `assessorCoachId` VARCHAR(191) NULL,
    `status` ENUM('SCHEDULED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
    `resultLevel` ENUM('NOVICE', 'INTERMEDIATE', 'ADVANCED') NULL,
    `notes` TEXT NULL,
    `completedAt` DATETIME(3) NULL,
    `nextReviewDue` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PlacementAssessment_status_scheduledFor_idx`(`status`, `scheduledFor`),
    INDEX `PlacementAssessment_studentId_idx`(`studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Lead_convertedToStudentId_key` ON `Lead`(`convertedToStudentId`);

-- CreateIndex
CREATE INDEX `StudentProfile_level_idx` ON `StudentProfile`(`level`);

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_convertedToStudentId_fkey` FOREIGN KEY (`convertedToStudentId`) REFERENCES `StudentProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Enrollment` ADD CONSTRAINT `Enrollment_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Enrollment` ADD CONSTRAINT `Enrollment_schoolGroupId_fkey` FOREIGN KEY (`schoolGroupId`) REFERENCES `SchoolGroup`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Enrollment` ADD CONSTRAINT `Enrollment_assignedCoachId_fkey` FOREIGN KEY (`assignedCoachId`) REFERENCES `CoachProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EnrollmentEvent` ADD CONSTRAINT `EnrollmentEvent_enrollmentId_fkey` FOREIGN KEY (`enrollmentId`) REFERENCES `Enrollment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlacementAssessment` ADD CONSTRAINT `PlacementAssessment_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlacementAssessment` ADD CONSTRAINT `PlacementAssessment_enrollmentId_fkey` FOREIGN KEY (`enrollmentId`) REFERENCES `Enrollment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlacementAssessment` ADD CONSTRAINT `PlacementAssessment_assessorCoachId_fkey` FOREIGN KEY (`assessorCoachId`) REFERENCES `CoachProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
