import 'dotenv/config';
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Starting transaction test...");
  try {
    const result = await prisma.$transaction(async (tx) => {
      console.log("Inside transaction...");

      // Read operation
      const count = await tx.product.count();
      console.log("Product count:", count);

      // Write operation (create dummy, then throw to rollback)
      /* 
      // Uncomment to test writes if needed, but read is enough to test connection context
      */

      return "Success";
    });
    console.log("Transaction result:", result);
  } catch (e) {
    console.error("Transaction failed:", e);
    process.exit(1);
  }
}

main();
