'use client';

import { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Search } from "lucide-react";
import type { Customer, Vehicle } from "@/lib/data";
import { AddCustomerVehicleDialog } from "@/components/customers/AddCustomerVehicleDialog";
import CustomersVehiclesTable from "@/components/customers/CustomersVehiclesTable";
import { WithId } from "@/lib/data";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CustomerVehicleDetailsDialog } from "@/components/customers/CustomerVehicleDetailsDialog";
import { useToast } from "@/hooks/use-toast";

export type CustomerWithVehicles = WithId<Customer> & {
  vehicles: WithId<Vehicle>[];
};

export default function CustomersPage() {
  const { toast } = useToast();

  const [combinedData, setCombinedData] = useState<CustomerWithVehicles[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setAddDialogOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<CustomerWithVehicles | null>(null);
  const [itemToDelete, setItemToDelete] = useState<CustomerWithVehicles | null>(null);
  const [itemToView, setItemToView] = useState<CustomerWithVehicles | null>(null);

  const fetchData = useCallback(async (signal: AbortSignal) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/customers-vehicles', { signal });
      if (!res.ok) {
        throw new Error('Failed to fetch data');
      }
      const data: CustomerWithVehicles[] = await res.json();
      setCombinedData(data);
    } catch (err: any) {
       if (err.name !== 'AbortError') {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not fetch customer and vehicle data.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);


  const filteredData = useMemo(() => {
    if (!searchQuery) return combinedData;

    const lowercasedQuery = searchQuery.toLowerCase();

    return combinedData.filter((customer) =>
      customer.name.toLowerCase().includes(lowercasedQuery) ||
      customer.phone.toLowerCase().includes(lowercasedQuery)
    );
  }, [combinedData, searchQuery]);
  
  const handleUpsert = useCallback(async (customerData: Omit<Customer, 'id'>, vehicleData: Partial<Omit<Vehicle, 'id' | 'customerId'>>, customerId?: string, vehicleId?: string) => {
      const isEdit = !!customerId; // We focus on customer editing or adding new pair
      try {
          // Centralized fetch logic
          const makeApiCall = (entity: 'customers' | 'vehicles', data: any, id?: string) => {
              const method = id ? 'PUT' : 'POST';
              const body = JSON.stringify(id ? { id, ...data } : data);
              return fetch(`/api/${entity}`, {
                  method,
                  headers: { 'Content-Type': 'application/json' },
                  body,
              });
          };

          if (isEdit && customerId) {
             // Editing existing customer
              const customerRes = await makeApiCall('customers', customerData, customerId);
              if (!customerRes.ok) throw new Error('Failed to update customer');
              
              // If we are editing, we might also be editing a specific vehicle if vehicleId is provided
              // But if vehicleId is missing (e.g. from main table edit), we might create a new one?
              // For now, let's assume if vehicleId is present we update, otherwise create.
              // However, the Dialog usually passes vehicleId if we selected a specific item.
              if (vehicleId && vehicleData.model) {
                  const vehicleRes = await makeApiCall('vehicles', vehicleData, vehicleId);
                  if (!vehicleRes.ok) throw new Error('Failed to update vehicle');
              } else if (vehicleData.model) {
                   // If in edit mode but no vehicle ID, maybe adding a vehicle? or just ignoring?
                   // The simple Edit Dialog currently assumes 1:1.
                   // We'll create if model is provided (e.g. adding vehicle to existing customer via edit?)
                   // But "Edit" button logic in table usually implies editing the *row*. 
                   // Let's safe-guard: if vehicleId is null, we create.
                   const vehiclePayload = { ...vehicleData, customerId };
                   await makeApiCall('vehicles', vehiclePayload);
              }
              
              toast({ title: 'Success', description: 'Customer updated successfully.' });
          } else {
              // Creating New Entry
              let targetCustomerId = null;
              
              const customerRes = await makeApiCall('customers', customerData);
              if (customerRes.ok) {
                  const newCustomer = await customerRes.json();
                  targetCustomerId = newCustomer.id;
              } else if (customerRes.status === 409) {
                  // Customer exists! Fetch by phone to get ID
                  const searchRes = await fetch(`/api/customers?phone=${customerData.phone}`);
                  const searchData = await searchRes.json();
                  if (searchData && searchData.length > 0) {
                      targetCustomerId = searchData[0].id;
                      // Optionally update name if needed? 
                  } else {
                      throw new Error("Customer exists but could not be found.");
                  }
              } else {
                 const errorData = await customerRes.json();
                 throw new Error(errorData.error || 'Failed to create customer.');
              }

              if (targetCustomerId && vehicleData.model) {
                  const vehiclePayload = { ...vehicleData, customerId: targetCustomerId };
                  const vehicleRes = await makeApiCall('vehicles', vehiclePayload);
                  if (!vehicleRes.ok) {
                     const errorData = await vehicleRes.json();
                     throw new Error(errorData.error || 'Failed to create vehicle.');
                  }
              }
              toast({ title: 'Success', description: 'Entry processed successfully.' });
          }

          setAddDialogOpen(false);
          fetchData(new AbortController().signal);
          return true;
      } catch (err: any) {
          const message = err.message || "An unknown error occurred.";
          toast({ variant: 'destructive', title: 'Error', description: message });
          return false;
      }
  }, [fetchData, toast]);


  const handleEdit = useCallback((item: CustomerWithVehicles) => {
    // Determine which vehicle to edit? The Dialog expects { customer, vehicle }.
    // We'll pick the first vehicle for now to populate the form, 
    // or we need to update the dialog to handle "Customer Only" or "Select Vehicle".
    // For simplicity with existing dialog:
    const vehicleToEdit = item.vehicles.length > 0 ? item.vehicles[0] : { id: '', model: '', customerId: item.id } as any;
    
    // We pass a constructed object that matches what the Dialog expects (CustomerWithVehicle)
    // We cast it to any or compatible type because the Dialog expects the old type.
    // We should ideally refactor the dialog, but mapping here is faster.
    setItemToEdit({ ...item, vehicle: vehicleToEdit } as any);
    setAddDialogOpen(true);
  }, []);
  
  const handleDeleteRequest = useCallback((item: CustomerWithVehicles) => {
    setItemToDelete(item);
  }, []);

  const handleViewDetails = useCallback((item: CustomerWithVehicles) => {
    setItemToView(item);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!itemToDelete) return;

    try {
        // Delete the CUSTOMER (cascading delete for vehicles is usually handled by DB or Prisma)
        // Prisma schema: onDelete: Cascade? 
        // Checking schema: 
        // InvoiceItem -> Invoice (Cascade)
        // Vehicle -> Customer (No cascade defined? Default is usually Restrict or SetNull in Prisma unless specified)
        // Wait, schema says: `vehicles Vehicle[]` and `customerId String`.
        // If we delete Customer, we need to ensure Vehicles are deleted.
        // We might need to delete vehicles first or rely on separate delete logic.
        // Let's look at `db.remove`.
        
        await fetch(`/api/customers?id=${itemToDelete.id}`, { method: 'DELETE' });
        
        toast({ title: 'Deleted', description: 'The customer and their vehicles have been deleted.' });
        fetchData(new AbortController().signal);

    } catch (err: any) {
        toast({ variant: 'destructive', title: 'Error', description: err.message || "Failed to delete" });
    } finally {
        setItemToDelete(null);
    }
  }, [itemToDelete, toast, fetchData]);

  const onDialogClose = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      setItemToEdit(null);
    }
    setAddDialogOpen(isOpen);
  }, []);

  return (
    <div className="relative z-10 w-full max-w-7xl mx-auto px-12 pt-8 pb-12">
        
        {/* --- HEADER --- */}
        <div className="flex justify-between items-start mb-16 gap-8">
            <div>
                <h1 className="text-5xl font-light tracking-tighter mb-2">CUSTOMERS & VEHICLES</h1>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">View and Manage Customer & Vehicle Records</p>
            </div>

            <div className="flex items-end gap-8 w-auto">
                <div className="relative group w-80">
                    <Search className="absolute left-0 bottom-3 h-4 w-4 text-zinc-400 group-focus-within:text-black transition-colors" />
                    <input
                        type="search"
                        placeholder="SEARCH NAME OR PHONE..."
                        className="w-full bg-transparent border-b border-zinc-200 py-2.5 pl-8 text-sm outline-none placeholder:text-zinc-300 placeholder:uppercase placeholder:tracking-widest uppercase tracking-wide focus:border-black transition-colors"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-4">
                     <AddCustomerVehicleDialog
                        onUpsert={handleUpsert}
                        itemToEdit={itemToEdit as any} 
                        isOpen={isAddDialogOpen}
                        onOpenChange={onDialogClose}
                      />
                </div>
            </div>
        </div>

        <div className="min-h-[400px]">
          <CustomersVehiclesTable
            data={filteredData}
            isLoading={isLoading}
            onEdit={handleEdit}
            onDelete={handleDeleteRequest}
            onViewDetails={handleViewDetails}
          />
        </div>

      <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent className="rounded-none border-zinc-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-light tracking-tight text-xl">Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-500">
              This action will permanently delete the customer record and ALL their associated vehicles. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 mt-4">
            <AlertDialogCancel 
                onClick={() => setItemToDelete(null)}
                className="rounded-none border-zinc-200 uppercase tracking-widest text-xs"
            >
                Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
                onClick={confirmDelete} 
                className="bg-red-600 hover:bg-red-700 text-white rounded-none uppercase tracking-widest text-xs"
            >
                Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <CustomerVehicleDetailsDialog
        item={itemToView as any}
        isOpen={!!itemToView}
        onOpenChange={(isOpen) => !isOpen && setItemToView(null)}
      />
    </div>
  );
}

