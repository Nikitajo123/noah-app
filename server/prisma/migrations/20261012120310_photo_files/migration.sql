-- CreateTable
CREATE TABLE "PhotoFile" (
    "photoId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "PhotoFile_pkey" PRIMARY KEY ("photoId")
);

-- AddForeignKey
ALTER TABLE "PhotoFile" ADD CONSTRAINT "PhotoFile_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
