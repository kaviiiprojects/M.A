
import { prisma } from "@/lib/prisma";
import type { Customer, Vehicle, Invoice, Employee } from "@/lib/data";
import { Prisma } from "@/generated";

// Helper to strip internal properties and convert Decimal to Number in-place
const transform = (obj: any): any => {
  if (!obj) return obj;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      obj[i] = transform(obj[i]);
    }
    return obj;
  }

  if (typeof obj === 'object') {
    // Handle Prisma Decimal
    if (Prisma.Decimal.isDecimal(obj)) {
      return obj.toNumber();
    }

    // Handle Date - pass through (Next.js handles JSON serialization)
    if (obj instanceof Date) return obj;

    // Recursive for object properties
    // We iterate keys and mutate in place to avoid deep cloning overhead
    for (const key in obj) {
      const val = obj[key];
      if (typeof val === 'object' && val !== null) {
        // Optimization: Only re-assign if we get a DIFFERENT value type back (e.g. Decimal -> Number)
        // or if it's an array/object that needs traversal.
        // Since 'transform' returns the same ref if it's an object/array (in-place), simple assignment is fine.
        // But for Decimal, it returns a primitive number, so we MUST assign.
        obj[key] = transform(val);
      }
    }
  }
  return obj;
}

// Renaming 'serialize' to 'transform' for clarity, but keeping internal usage consistent
const serialize = transform;


export const db = {
  // Generic getters are tricky with strict Prisma types.
  // We will map collection names to Prisma delegates manually.

  async getAll(collectionName: string) {
    switch (collectionName) {
      case "products": return serialize(await prisma.product.findMany());
      case "services": return serialize(await prisma.service.findMany());
      case "customers": return serialize(await prisma.customer.findMany());
      case "vehicles": return serialize(await prisma.vehicle.findMany());
      case "employees": return serialize(await prisma.employee.findMany());
      case "invoices": return serialize(await prisma.invoice.findMany({
        include: {
          items: true,
          payments: true,
          customer: true,
          vehicle: true,
          employee: true
        }
      }));
      default: throw new Error(`Unknown collection: ${collectionName}`);
    }
  },

  async getOne(collectionName: string, id: string) {
    switch (collectionName) {
      case "products": return serialize(await prisma.product.findUnique({ where: { id } }));
      case "services": return serialize(await prisma.service.findUnique({ where: { id } }));
      case "customers": return serialize(await prisma.customer.findUnique({ where: { id } }));
      case "vehicles": return serialize(await prisma.vehicle.findUnique({ where: { id } }));
      case "employees": return serialize(await prisma.employee.findUnique({ where: { id } }));
      case "invoices": return serialize(await prisma.invoice.findUnique({ where: { id }, include: { items: true, payments: true } }));
      default: throw new Error(`Unknown collection: ${collectionName}`);
    }
  },

  async create(collectionName: string, payload: any) {
    // Note: Payload types will need to be strictly checked or cast in the API routes before calling this,
    // or we assume payload matches schema (minus id/createdAt/updatedAt).
    // Prisma create expects specific types.

    // We might need to handle specific logic per model if payload shapes differ from Prisma Input types significantly
    // but for now we try direct mapping.

    switch (collectionName) {
      case "products": return serialize(await prisma.product.create({ data: payload }));
      case "services": return serialize(await prisma.service.create({ data: payload }));
      case "customers": return serialize(await prisma.customer.create({ data: payload }));
      // Vehicles require specific relation logic usually (customerId), so payload must have it.
      case "vehicles": return serialize(await prisma.vehicle.create({ data: payload }));
      case "employees": return serialize(await prisma.employee.create({ data: payload }));
      // Invoices are complex and handled separately usually, but for simple create:
      // case "invoices": ... complicated due to nested writes
      default: throw new Error(`Create not supported via generic db.create for: ${collectionName}`);
    }
  },

  async update(collectionName: string, id: string, payload: any) {
    const { id: _, ...data } = payload; // Ensure ID is not in data

    switch (collectionName) {
      case "products": return serialize(await prisma.product.update({ where: { id }, data }));
      case "services": return serialize(await prisma.service.update({ where: { id }, data }));
      case "customers": return serialize(await prisma.customer.update({ where: { id }, data }));
      case "vehicles": return serialize(await prisma.vehicle.update({ where: { id }, data }));
      case "employees": return serialize(await prisma.employee.update({ where: { id }, data }));
      default: throw new Error(`Update not supported for: ${collectionName}`);
    }
  },

  async remove(collectionName: string, id: string) {
    switch (collectionName) {
      case "products": return prisma.product.delete({ where: { id } });
      case "services": return prisma.service.delete({ where: { id } });
      case "customers": return prisma.customer.delete({ where: { id } });
      case "vehicles": return prisma.vehicle.delete({ where: { id } });
      case "employees": return prisma.employee.delete({ where: { id } });
      default: throw new Error(`Remove not supported for: ${collectionName}`);
    }
  },

  // Specific helper for customers page
  async getAllCustomersWithVehicles() {
    const customers = await prisma.customer.findMany({
      include: { vehicles: true },
      orderBy: { name: 'asc' }
    });

    return serialize(customers);
  },

  // Specific helper for invoices list
  // Note: Since getAll("invoices") now includes customer, vehicle, and employee,
  // this function can be used to ensure data is properly enriched.
  // Returns invoices as-is if already enriched, or fetches relations if missing.
  async enrichInvoices(invoices: any[]) {
    // If invoices already have customer/vehicle/employee data, return as-is
    if (invoices.length === 0 || (invoices[0].customer && invoices[0].vehicle && invoices[0].employee)) {
      return invoices;
    }

    // Otherwise, fetch full invoice data with relations
    const invoiceIds = invoices.map(inv => inv.id);
    const enrichedInvoices = await prisma.invoice.findMany({
      where: { id: { in: invoiceIds } },
      include: {
        items: true,
        payments: true,
        customer: true,
        vehicle: true,
        employee: true
      }
    });

    return serialize(enrichedInvoices);
  }
};
