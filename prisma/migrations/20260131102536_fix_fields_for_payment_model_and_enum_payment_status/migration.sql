/*
  Warnings:

  - You are about to alter the column `amount` on the `Payment` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Decimal(10,2)`.
  - You are about to alter the column `status` on the `Payment` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(0))` to `Enum(EnumId(0))`.

*/
-- AlterTable
ALTER TABLE `Payment` MODIFY `amount` DECIMAL(10, 2) NOT NULL,
    MODIFY `status` ENUM('pending', 'succeeded', 'canceled') NOT NULL DEFAULT 'pending',
    MODIFY `externalPaymentId` VARCHAR(191) NULL;
