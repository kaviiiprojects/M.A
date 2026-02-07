
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { Customer, Vehicle } from '@/lib/data';
import { WithId } from "@/lib/data";

type CustomerWithVehicles = WithId<Customer> & {
  vehicles: WithId<Vehicle>[];
};

type DetailsDialogProps = {
  item: CustomerWithVehicles | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

const DetailItem = ({ label, value }: { label: string; value?: string | number | null }) => (
  <div>
    <p className="text-xs text-zinc-500 uppercase tracking-wider">{label}</p>
    <p className="text-base text-zinc-900">{value || 'N/A'}</p>
  </div>
);

export function CustomerVehicleDetailsDialog({ item, isOpen, onOpenChange }: DetailsDialogProps) {
  if (!item) return null;

  const { vehicles, ...customer } = item;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl rounded-none border-zinc-200">
        <DialogHeader>
          <DialogTitle className="font-light tracking-tight text-2xl">
            {customer.name}
          </DialogTitle>
          <DialogDescription className="text-zinc-500">
            Details for customer and their vehicles.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-6 max-h-[70vh] overflow-y-auto pr-4">
          <div>
            <h3 className="text-lg font-medium tracking-tight border-b pb-2 mb-4">Customer Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <DetailItem label="Full Name" value={customer.name} />
              <DetailItem label="Phone Number" value={customer.phone} />
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium tracking-tight border-b pb-2 mb-4">Vehicle Details</h3>
            {vehicles && vehicles.length > 0 ? (
                <div className="space-y-4">
                    {vehicles.map((v, i) => (
                        <div key={v.id} className="bg-zinc-50 p-4 border border-zinc-100">
                             <div className="grid grid-cols-2 gap-4">
                                <DetailItem label={`Vehicle ${i + 1}`} value={v.model} />
                                {/* Add more vehicle fields here if available, e.g. plate number if added later */}
                             </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-zinc-500 italic">No vehicles registered.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

