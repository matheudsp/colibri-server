/*
  Warnings:

  - Added the required column `cameraType` to the `AccessKey` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CameraType" AS ENUM ('normal', 'camera_360');

-- AlterTable
ALTER TABLE "AccessKey" ADD COLUMN     "cameraType" "CameraType" NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cameraType" "CameraType";
