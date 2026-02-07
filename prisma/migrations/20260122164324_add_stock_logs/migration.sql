-- CreateTable
CREATE TABLE "stock_adjustment_logs" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "quantity" INTEGER,
    "reason" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_adjustment_logs_pkey" PRIMARY KEY ("id")
);
