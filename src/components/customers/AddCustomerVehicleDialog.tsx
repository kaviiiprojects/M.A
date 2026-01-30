
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import type { Customer, Vehicle } from '@/lib/data';
import { WithId } from "@/lib/data";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Loader2, Plus, Search, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { useDebouncedCallback } from 'use-debounce';
import { format, formatDistanceToNow } from 'date-fns';

const customerSchema = z.object({
  name: z.string().min(1, 'Full Name is required'),
  phone: z.string().regex(/^\d{10}$/, 'Phone number must be exactly 10 digits and contain only numbers'),
});

const vehicleSchema = z.object({
  model: z.string().min(1, 'Model is required'),
});

const combinedSchema = customerSchema.merge(vehicleSchema);


type EnrichedVehicle = WithId<Vehicle> & { customer?: WithId<Customer> };

type CustomerWithVehicle = {
  customer: WithId<Customer>;
  vehicle: WithId<Vehicle>;
};

type AddCustomerVehicleDialogProps = {
  onUpsert: (customer: Omit<Customer, 'id'>, vehicle: Partial<Omit<Vehicle, 'id' | 'customerId'>>, customerId?: string, vehicleId?: string) => Promise<boolean>;
  itemToEdit?: CustomerWithVehicle | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

export function AddCustomerVehicleDialog({ 
  onUpsert, 
  itemToEdit, 
  isOpen, 
  onOpenChange 
}: AddCustomerVehicleDialogProps) {
  const { toast } = useToast();
  
  const isEditMode = !!itemToEdit;
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  
  const form = useForm<z.infer<typeof combinedSchema>>({
    resolver: zodResolver(combinedSchema),
    defaultValues: {
      name: '', phone: '',
      model: ''
    },
  });

  useEffect(() => {
    if (isOpen) {
        if (isEditMode && itemToEdit) {
            setShowAddForm(true);
            form.reset({
                name: itemToEdit.customer.name,
                phone: itemToEdit.customer.phone,
                model: itemToEdit.vehicle.model,
            });
        } else {
             // Reset form for add mode
        }
    } else {
        // Reset all state when dialog is closed
        setShowAddForm(false);
        setIsSubmitting(false);
        form.reset({
             name: '', phone: '',
            model: ''
        });
    }
  }, [itemToEdit, isEditMode, form, isOpen]);


  const onSubmit = async (values: z.infer<typeof combinedSchema>) => {
    setIsSubmitting(true);
    const { name, phone, ...vehicleData } = values;
    
    // Create payload
    const finalVehicleData: Omit<Vehicle, 'id' | 'customerId'> = {
        ...vehicleData,
    };

    try {
        await onUpsert(
            { name, phone },
            finalVehicleData,
            itemToEdit?.customer.id, 
            itemToEdit?.vehicle.id
        );
    } finally {
        setIsSubmitting(false);
    }
  };

  const commonInputStyles = "rounded-none h-11 text-base";
  const commonButtonStyles = "rounded-none uppercase tracking-widest text-xs h-11";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
         <Button 
            onClick={() => onOpenChange(true)}
            className="h-10 px-6 rounded-none bg-black text-white text-xs uppercase tracking-[0.15em] hover:bg-zinc-800 transition-all shadow-none"
        >
            <Plus className="mr-2 h-3 w-3" />
            New Entry
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl rounded-none border-zinc-200">
        <DialogHeader>
          <DialogTitle className="font-light tracking-tight text-2xl">{isEditMode ? 'Edit Customer & Vehicle' : 'Add New Customer & Vehicle'}</DialogTitle>
          <DialogDescription className="text-zinc-500">
            {isEditMode ? "Update the customer and vehicle details." : 'Add a new customer and their vehicle to your records.'}
          </DialogDescription>
        </DialogHeader>

        {showAddForm || isEditMode ? (
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
                     
                     <div className="space-y-4">
                         <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 border-b pb-1">Vehicle Details</h3>
                         <div className="grid grid-cols-1 gap-4">
                            <FormField control={form.control} name="model" render={({ field }) => (
                              <FormItem><FormLabel>Model</FormLabel><FormControl><Input placeholder="e.g., Corolla" {...field} className={commonInputStyles} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                     </div>

                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 border-b pb-1">Customer Details</h3>
                        <div className="grid grid-cols-2 gap-4">
                             <FormField control={form.control} name="name" render={({ field }) => (
                              <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="e.g., John Doe" {...field} className={commonInputStyles} /></FormControl><FormMessage /></FormItem>
                            )} />
                             <FormField control={form.control} name="phone" render={({ field }) => (
                              <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="e.g., 0771234567" {...field} className={commonInputStyles} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                    </div>

                    <DialogFooter className="mt-8 gap-2 sticky bottom-0 bg-white py-0 pr-4">
                      {!isEditMode && 
                        <Button type="button" variant="outline" onClick={() => setShowAddForm(false)} className={commonButtonStyles}>
                          Back to Search
                        </Button>
                      }
                      <Button type="submit" className={commonButtonStyles} disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isEditMode ? 'Save Changes' : 'Create Entry'}
                      </Button>
                    </DialogFooter>
                </form>
            </Form>
        ) : (
          <SearchAndSelect onSelect={(customer, vehicle) => {
             onUpsert(
                { name: customer.name, phone: customer.phone },
                { model: vehicle.model },
                customer.id,
                vehicle.id
            ).then(success => {
                if(success) onOpenChange(false);
            });
          }} onAddNew={() => setShowAddForm(true)} />
        )}

      </DialogContent>
    </Dialog>
  );
}


function SearchAndSelect({ onSelect, onAddNew }: { 
    onSelect: (customer: WithId<Customer>, vehicle: WithId<Vehicle>) => void;
    onAddNew: () => void;
}) {
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<EnrichedVehicle[]>([]);
    const [customers, setCustomers] = useState<WithId<Customer>[]>([]);
    const { toast } = useToast();

    // Map of vehicle ID -> Customer
    const customerMap = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);

    const debouncedSearch = useDebouncedCallback(async (query: string) => {
        if (query.trim().length < 2) {
        setSearchResults([]);
        setIsSearching(false);
        return;
        }
        
        try {
        const res = await fetch(`/api/vehicles/search?query=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error('Search failed');
        const vehicles: WithId<Vehicle & { customer: WithId<Customer> }>[] = await res.json();
        
        // This relies on the backend search returning vehicles that match the customer query associated with the vehicle
        // Or we might need to search customers and get their vehicles.
        // The current API/vehicles/search does return vehicles based on customer name/phone.
        
        const enrichedVehicles = vehicles.map(vehicle => ({
            ...vehicle,
            customer: vehicle.customer // The API already includes the customer
        }));

        setSearchResults(enrichedVehicles);
        } catch (error) {
        console.error("Failed to search vehicles:", error);
        setSearchResults([]);
        } finally {
        setIsSearching(false);
        }
    }, 500);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        setSearchQuery(query);
        setIsSearching(true);
        debouncedSearch(query);
    };

    const handleSelect = (vehicle: EnrichedVehicle) => {
        if(vehicle.customer) {
        onSelect(vehicle.customer, vehicle);
        }
    }
    
    const formatLastVisit = (timestamp: number | string | Date | { seconds: number, nanoseconds: number } | undefined): string => {
        if (!timestamp) return 'No previous visits';
        try {
        const dateInMillis = typeof timestamp === 'number' 
            ? timestamp 
            : (timestamp && typeof timestamp === 'object' && 'seconds' in timestamp) 
            ? timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000
            : 0;

        if (dateInMillis === 0 && !(timestamp instanceof Date)) return 'Invalid date';
        
        const date = timestamp instanceof Date ? timestamp : new Date(dateInMillis);
        return `${format(date, 'MMM d, yyyy')} (${formatDistanceToNow(date, { addSuffix: true })})`;
        } catch(e) {
        return 'Invalid date format';
        }
    };


    return (
        <div className="py-4">
            <div className="relative group mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 group-focus-within:text-black transition-colors" />
                {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 animate-spin" />}
                <Input
                    placeholder="Search by Phone or Name..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className={cn("rounded-none h-11 text-base", "pl-10")}
                />
            </div>
            
            <ScrollArea className="h-60 border border-zinc-200">
                <div className='p-2'>
                {searchResults.length > 0 ? (
                    searchResults.map(vehicle => {
                    return (
                        <button key={vehicle.id} onClick={() => handleSelect(vehicle)} className="w-full text-left p-3 hover:bg-zinc-100 rounded-sm transition-colors flex justify-between items-center group">
                        <div>
                            <p className="font-semibold text-sm">{vehicle.customer?.name}</p>
                            <p className="text-xs text-zinc-500">{vehicle.customer?.phone} - {vehicle.model}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-zinc-400">{formatLastVisit(vehicle.lastVisit)}</p>
                            <span className="text-xs uppercase tracking-widest text-zinc-400 group-hover:text-black">Select</span>
                        </div>
                        </button>
                    )
                    })
                ) : (
                    <div className="p-8 text-center text-sm text-zinc-400 uppercase tracking-widest">
                    {searchQuery ? 'No customers found' : 'Start typing to search'}
                    </div>
                )}
                </div>
            </ScrollArea>
                <DialogFooter className="mt-6">
                <Button onClick={onAddNew} className={cn("rounded-none uppercase tracking-widest text-xs h-11", "w-full")}>
                    <UserPlus className="mr-2 h-4 w-4"/>
                    Customer or Vehicle Not Found? Add New Entry
                </Button>
            </DialogFooter>
        </div>
    )
}

