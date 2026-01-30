
import 'dotenv/config';
import { prisma } from '../src/lib/prisma'; // Use shared instance
// const prisma = new PrismaClient(); // Remove local instance

async function main() {
  console.log('Starting migration: Connecting invoices to employees...');

  // Fetch all invoices that have a legacy employeeId but no connected employees yet
  const invoices = await prisma.invoice.findMany({
    where: {
      employeeId: { not: null },
      employees: { none: {} } // Optimization: Only process un-migrated ones
    }
  });

  console.log(`Found ${invoices.length} invoices to migrate.`);

  let processed = 0;
  for (const invoice of invoices) {
    if (!invoice.employeeId) continue;

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        employees: {
          connect: { id: invoice.employeeId }
        }
      }
    });

    processed++;
    if (processed % 50 === 0) {
      console.log(`Processed ${processed}/${invoices.length}...`);
    }
  }

  console.log('Migration completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
