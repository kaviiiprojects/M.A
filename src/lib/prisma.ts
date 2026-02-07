import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const connectionString = process.env.DATABASE_URL!;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaNeon({ connectionString }),
    transactionOptions: {
      maxWait: 10000, // 10 seconds max wait to start transaction
      timeout: 30000, // 30 seconds max transaction duration
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
