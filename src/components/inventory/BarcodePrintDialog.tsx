
'use client';

import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Barcode from 'react-barcode';
import { Printer } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';

type BarcodePrintDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  barcode: string;
  price: number;
};

export function BarcodePrintDialog({
  isOpen,
  onOpenChange,
  productName,
  barcode,
  price,
}: BarcodePrintDialogProps) {
  const componentRef = useRef<HTMLDivElement>(null);
  const [quantity, setQuantity] = useState(1);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
  });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-none border-zinc-200">
        <DialogHeader>
          <DialogTitle className="font-light tracking-tight text-xl">Print Barcode</DialogTitle>
          <DialogDescription className="text-zinc-500">
            Preview and print barcodes for {productName}.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
             <div className="flex flex-col gap-3 bg-zinc-50 p-4 border border-zinc-100">
                <Label htmlFor="quantity" className="text-xs uppercase tracking-widest text-zinc-500 font-bold">Quantity to Print</Label>
                <div className="flex items-center gap-4">
                    <Input 
                        id="quantity" 
                        type="number" 
                        min={1} 
                        value={quantity} 
                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="rounded-none h-12 text-lg bg-white w-full"
                        autoFocus
                    />
                </div>
             </div>
        </div>

        {/* Scrollable Preview Area for UI */}
        <div className="max-h-[300px] overflow-y-auto border border-zinc-200 bg-zinc-50 p-4">
            <div ref={componentRef} className="flex flex-col items-center bg-white w-full print:w-auto p-4 print:p-0">
                {Array.from({ length: quantity }).map((_, index) => (
                    <div key={index} className="flex flex-col items-center text-center pb-8 mb-4 border-b-2 border-dashed border-zinc-200 print:border-none print:mb-0 print:pb-4 print:pt-4 last:border-0 last:mb-0 w-full">
                        <p className="text-xs font-bold uppercase truncate max-w-[200px] mb-1">{productName}</p>
                        <Barcode 
                            value={barcode} 
                            width={1.5} 
                            height={50} 
                            fontSize={12} 
                        />
                        <p className="text-sm font-mono mt-1">Rs. {price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                    </div>
                ))}
            </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-none uppercase tracking-widest text-xs">
            Cancel
          </Button>
          <Button onClick={() => handlePrint && handlePrint()} className="rounded-none bg-black text-white hover:bg-zinc-800 uppercase tracking-widest text-xs">
            <Printer className="mr-2 h-4 w-4" />
            Print {quantity} Copies
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
