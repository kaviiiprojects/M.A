'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { WithId } from "@/lib/data";
import type { Customer, Vehicle } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Search, UserPlus, Loader2 } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { format, formatDistanceToNow } from 'date-fns';
import { useDebouncedCallback } from 'use-debounce';
import { useToast } from '@/hooks/use-toast';


const customerSchema = z.object({
  name: z.string().min(1, 'Full Name is required'),
  phone: z.string().regex(/^\d{10}$/, 'Phone number must be exactly 10 digits and contain only numbers'),
});

const vehicleSchema = z.object({
  model: z.string().min(1, 'Model is required'),
});

type EnrichedVehicle = WithId<Vehicle> & { customer?: WithId<Customer> };

type AddCustomerVehicleDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSelect: (customer: WithId<Customer>, vehicle: WithId<Vehicle>) => void;
  onCreate: (customer: Omit<Customer, 'id'>, vehicle: Omit<Vehicle, 'id' | 'customerId'>) => Promise<void>;
};

export function AddCustomerVehicleDialog({ isOpen, onOpenChange, onSelect, onCreate }: AddCustomerVehicleDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<EnrichedVehicle[]>([]);
  const { toast } = useToast();

  const form = useForm({
    resolver: zodResolver(customerSchema.merge(vehicleSchema)),
    defaultValues: { 
      name: '', phone: '',
      model: ''
    },
  });
  
  useEffect(() => {
    if (!isOpen) {
      // Reset state when dialog closes
      form.reset();
      setSearchQuery('');
      setShowAddForm(false);
      setIsSubmitting(false);
      setSearchResults([]);
      setIsSearching(false);
    }
  }, [isOpen, form]);

  const debouncedSearch = useDebouncedCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    
    try {
      const res = await fetch(`/api/vehicles/search?query=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Search failed');
      const vehicles: WithId<Vehicle & { customer: Customer }>[] = await res.json();
      
      // API now returns customer with the vehicle
      const enrichedVehicles = vehicles.map(vehicle => ({
          ...vehicle,
          customer: vehicle.customer as WithId<Customer>
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


  const onSubmit = async (values: z.infer<typeof customerSchema> & z.infer<typeof vehicleSchema>) => {
    setIsSubmitting(true);
    const { name, phone, ...vehicleData } = values;
    const customerData = { name, phone };
    
    const finalVehicleData: Omit<Vehicle, 'id' | 'customerId'> = {
        ...vehicleData,
    };

    try {
      await onCreate(customerData, finalVehicleData);
    } catch(err) {
      // Error is handled by the parent
    } finally {
      setIsSubmitting(false);
    }
  };

  const commonInputStyles = "rounded-none h-11 text-base";
  const commonButtonStyles = "rounded-none uppercase tracking-widest text-xs h-11";

  // ... (handleSelect, formatLastVisit implementation remains similar)
  const handleSelect = (vehicle: EnrichedVehicle) => {
    if(vehicle.customer) {
      onSelect(vehicle.customer, vehicle);
    }
  }

  const formatLastVisit = (timestamp: any): string => {
    if (!timestamp) return 'No previous visits';
    try {
      const dateInMillis = typeof timestamp === 'number' 
        ? timestamp 
        : (timestamp && timestamp.seconds) 
          ? timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000
          : 0;
      if (dateInMillis === 0) return 'Invalid date';
      const date = new Date(dateInMillis);
      return `${format(date, 'MMM d, yyyy')} (${formatDistanceToNow(date, { addSuffix: true })})`;
    } catch(e) {
      return 'Invalid date format';
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl rounded-none border-zinc-200">
        <DialogHeader>
          <DialogTitle className="font-light tracking-tight text-2xl">{showAddForm ? 'Add New Customer & Vehicle' : 'Find Customer / Vehicle'}</DialogTitle>
          <DialogDescription className="text-zinc-500">
            {showAddForm ? 'Enter simplified details for quick entry.' : 'Search by vehicle number or customer details.'}
          </DialogDescription>
        </DialogHeader>

        {!showAddForm && (
           <div className="py-4">
             {/* Search UI remains mostly same */}
             <div className="relative group mb-4">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 group-focus-within:text-black transition-colors" />
               {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 animate-spin" />}
               <Input
                 placeholder="Search by Phone or Name..."
                 value={searchQuery}
                 onChange={handleSearchChange}
                 className={cn(commonInputStyles, "pl-10")}
                 autoFocus
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
                   {searchQuery ? 'No vehicles found' : 'Start typing to search'}
                 </div>
               )}
               </div>
             </ScrollArea>
             <DialogFooter className="mt-6">
                <Button onClick={() => setShowAddForm(true)} className={cn(commonButtonStyles, "w-full")}>
                  <UserPlus className="mr-2 h-4 w-4"/>
                  Add New Customer / Vehicle
                </Button>
            </DialogFooter>
          </div>
        )}

        {showAddForm && (
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

              <DialogFooter className="mt-8 gap-2 sticky bottom-0 bg-background py-0">
                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)} className={commonButtonStyles}>
                  Back
                </Button>

                <Button type="submit" className={commonButtonStyles} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isSubmitting ? "Creating..." : "Create and Select"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
    

