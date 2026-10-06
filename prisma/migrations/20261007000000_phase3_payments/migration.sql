-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('PAYSTACK', 'MPESA');

-- Keep existing data: the Paystack reference column becomes the generic provider reference.
ALTER TABLE "order" RENAME COLUMN "paystackReference" TO "providerReference";
ALTER INDEX "order_paystackReference_key" RENAME TO "order_providerReference_key";

-- AlterTable
ALTER TABLE "order" ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "merchantRequestId" TEXT,
ADD COLUMN     "mpesaReceipt" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "payerPhone" TEXT,
ADD COLUMN     "provider" "PaymentProvider",
ADD COLUMN     "refundRequestedById" TEXT;

-- Every order that already has a reference came from Paystack (the only provider until now).
UPDATE "order" SET "provider" = 'PAYSTACK' WHERE "providerReference" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "order_mpesaReceipt_key" ON "order"("mpesaReceipt");
