ALTER TABLE "Attendance"
ADD COLUMN "checkOutPhotoUrl" TEXT,
ADD COLUMN "checkOutLatitude" DOUBLE PRECISION,
ADD COLUMN "checkOutLongitude" DOUBLE PRECISION,
ADD COLUMN "checkOutDistanceMeters" INTEGER;
