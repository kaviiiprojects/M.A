/*
  Warnings:

  - You are about to drop the column `address` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `nic` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `fuelType` on the `vehicles` table. All the data in the column will be lost.
  - You are about to drop the column `make` on the `vehicles` table. All the data in the column will be lost.
  - You are about to drop the column `mileage` on the `vehicles` table. All the data in the column will be lost.
  - You are about to drop the column `numberPlate` on the `vehicles` table. All the data in the column will be lost.
  - You are about to drop the column `transmission` on the `vehicles` table. All the data in the column will be lost.
  - You are about to drop the column `year` on the `vehicles` table. All the data in the column will be lost.
  - You are about to drop the `stock_adjustment_logs` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[phone]` on the table `customers` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_vehicleId_fkey";

-- DropIndex
DROP INDEX "customers_nic_key";

-- DropIndex
DROP INDEX "vehicles_numberPlate_key";

-- AlterTable
ALTER TABLE "customers" DROP COLUMN "address",
DROP COLUMN "nic";

-- AlterTable
ALTER TABLE "invoices" ALTER COLUMN "vehicleId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "vehicles" DROP COLUMN "fuelType",
DROP COLUMN "make",
DROP COLUMN "mileage",
DROP COLUMN "numberPlate",
DROP COLUMN "transmission",
DROP COLUMN "year";

-- DropTable
DROP TABLE "stock_adjustment_logs";

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
