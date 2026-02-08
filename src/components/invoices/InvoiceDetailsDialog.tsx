'use client';

import { useEffect, useRef, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Invoice, Customer, Vehicle, Employee, Payment } from '@/lib/data';
import { WithId } from "@/lib/data";
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { CheckCircle, AlertCircle, Share2, Loader2, ScrollText } from 'lucide-react';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { format as formatTz, toDate } from 'date-fns-tz';
import html2canvas from 'html2canvas';
import { useToast } from '@/hooks/use-toast';
import { useReactToPrint } from 'react-to-print';


type EnrichedInvoice = WithId<Invoice> & {
    customerDetails?: WithId<Customer>;
    vehicleDetails?: WithId<Vehicle>;
    employeeDetails?: WithId<Employee>;
};

type DetailsDialogProps = {
    invoice: EnrichedInvoice | null;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    shareOnOpen?: boolean;
    receiptOnOpen?: boolean;
};

const DetailItem = ({ label, value }: { label: string; value?: string | number | null }) => (
    <div>
        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</p>
        <p className="text-sm text-zinc-900 font-medium">{value || 'N/A'}</p>
    </div>
);

const statusStyles: Record<EnrichedInvoice['paymentStatus'], string> = {
    Paid: "bg-emerald-100 text-emerald-800 border-emerald-200",
    Partial: "bg-amber-100 text-amber-800 border-amber-200",
    Unpaid: "bg-red-100 text-red-800 border-red-200",
};


export function InvoiceDetailsDialog({ invoice, isOpen, onOpenChange, shareOnOpen = false, receiptOnOpen = false }: DetailsDialogProps) {
    const { toast } = useToast();
    const actionTriggered = useRef(false);
    const invoiceContentRef = useRef<HTMLDivElement>(null);
    const [isSharing, setIsSharing] = useState(false);

    // Receipt Printing Logic
    const receiptRef = useRef<HTMLDivElement>(null);
    const handlePrintReceipt = useReactToPrint({
        contentRef: receiptRef,
    });

    useEffect(() => {
        if (isOpen && !actionTriggered.current) {
            if (shareOnOpen) {
                actionTriggered.current = true;
                setTimeout(() => handleShare(), 500);
            } else if (receiptOnOpen && handlePrintReceipt) {
                actionTriggered.current = true;
                setTimeout(() => handlePrintReceipt(), 500);
            }
        }
        if (!isOpen) {
            actionTriggered.current = false;
        }
    }, [isOpen, shareOnOpen, receiptOnOpen, handlePrintReceipt]);

    if (!invoice) return null;

    const { customerDetails: customer, vehicleDetails: vehicle, employeeDetails: employee } = invoice;

    const formatPrice = (price: number) => {
        return `Rs. ${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const handleShare = async () => {
        if (!invoiceContentRef.current) return;

        // Check if Web Share API is supported for files
        if (navigator.canShare && navigator.canShare({ files: [new File([], 'test.png', { type: 'image/png' })] })) {
            setIsSharing(true);
            try {
                const canvas = await html2canvas(invoiceContentRef.current, {
                    scale: 2,
                    backgroundColor: '#ffffff',
                    useCORS: true,
                });

                const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));

                if (!blob) {
                    throw new Error('Could not create image from invoice.');
                }

                const file = new File([blob], `invoice-${invoice.invoiceNumber}.png`, { type: 'image/png' });

                await navigator.share({
                    files: [file],
                    title: `Invoice ${invoice.invoiceNumber}`,
                    text: `Here is the invoice for ${customer?.name}. Total: ${formatPrice(invoice.total)}`,
                });

            } catch (error: any) {
                if (error.name !== 'AbortError') {
                    console.error("Share error:", error);
                    toast({
                        variant: 'destructive',
                        title: 'Share Failed',
                        description: error.message || 'There was an error trying to share the invoice.'
                    });
                }
            } finally {
                setIsSharing(false);
            }
        } else {
            toast({
                variant: 'destructive',
                title: "Sharing Not Supported",
                description: "Your browser does not support native file sharing."
            });
        }
    };


    const formatDateInSL = (timestamp: number | string | Date) => {
        if (!timestamp) return 'Invalid Date';
        try {
            const date = toDate(timestamp, { timeZone: 'Asia/Colombo' });
            return formatTz(date, 'MMM d, yyyy', { timeZone: 'Asia/Colombo' });
        } catch {
            return 'Invalid Date';
        }
    };

    // Invoice is fully paid if balanceDue is 0 or less (change given case)
    const isFullyPaid = invoice.balanceDue <= 0;



    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl rounded-none border-zinc-200 p-0" id="invoice-preview">

                {/* --- Hidden 80mm Receipt Layout --- */}
                <div className="absolute top-0 left-0 w-0 h-0 overflow-hidden">
                    <div ref={receiptRef} className="receipt-print w-[72mm] p-1 mx-auto bg-white text-[11px] font-mono leading-tight">
                        {/* Header */}
                        <div className="text-center mb-3">
                            <img src="/logo.png" alt="Mahesh Auto" className="h-10 w-auto mx-auto mb-1 object-contain" />
                            <p className="font-bold text-base uppercase mb-0.5">Mahesh Auto Accessories</p>
                            <p className="text-[10px] mb-0.5">No. 172/, Nattandiya Rd, Dankotuwa</p>
                            <p className="text-[10px]">077-6050787 / 031-2259699</p>
                            <Separator className="my-2 border-black" />
                            <p className="font-bold text-[12px]">INVOICE</p>
                        </div>

                        {/* Info */}
                        <div className="mb-1.5 space-y-1 text-[10px]">
                            <div className="flex gap-2">
                                <span>Invoice No:</span>
                                <span className="font-bold">{invoice.invoiceNumber}</span>
                            </div>
                            <div className="flex gap-2">
                                <span>Date:</span>
                                <span className="font-bold">{formatDateInSL(invoice.date)}</span>
                            </div>
                            <div className="flex gap-2">
                                <span>Customer:</span>
                                <span className="font-bold truncate max-w-[40mm]">{customer?.name || 'Walk-in'}</span>
                            </div>
                            <div className="flex gap-2">
                                <span>Vehicle:</span>
                                <span className="font-bold truncate max-w-[40mm]">{vehicle?.model || '-'}</span>
                            </div>
                            <div className="flex gap-2">
                                <span>Job By:</span>
                                <span className="font-bold truncate max-w-[40mm]">{employee?.name || '-'}</span>
                            </div>
                        </div>
                        <div className="mb-4" />

                        {/* Items */}
                        <div className="mb-2 text-[10px]">
                            <div className="grid grid-cols-12 font-bold mb-0.5 border-b border-black pb-0.5">
                                <div className="col-span-6">ITEM</div>
                                <div className="col-span-1 text-center">Q</div>
                                <div className="col-span-2 text-right">DISC</div>
                                <div className="col-span-3 text-right">TOTAL</div>
                            </div>
                            {invoice.items.map((item, i) => (
                                <div key={i} className="mb-0.5">
                                    <div className="grid grid-cols-12">
                                        <div className="col-span-6 truncate pr-0.5">{item.name}</div>
                                        <div className="col-span-1 text-center">{item.quantity}</div>
                                        <div className="col-span-2 text-right">{item.discount > 0 ? item.discount.toLocaleString() : '-'}</div>
                                        <div className="col-span-3 text-right">{item.total.toLocaleString()}</div>
                                    </div>
                                    {item.warrantyMonths && item.warrantyMonths > 0 && (
                                        <div className="text-[9px] text-left pl-1 italic">
                                            ✓ {item.warrantyMonths} Month{item.warrantyMonths > 1 ? 's' : ''} Warranty
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="mb-4" />

                        {/* Totals */}
                        <div className="w-full flex items-end justify-end">
                            <div className="space-y-1 text-right mb-3 text-[10px] w-[60%]">
                            <div className="flex justify-between gap-2  ">
                                <span>Subtotal:</span>
                                <span>{formatPrice(invoice.subtotal).replace('Rs. ', '')}</span>
                            </div>
                            {invoice.globalDiscountAmount > 0 && (
                                <div className="flex justify-between gap-2">
                                    <span>Discount:</span>
                                    <span>-{formatPrice(invoice.globalDiscountAmount).replace('Rs. ', '')}</span>
                                </div>
                            )}
                            <div className="flex justify-between font-bold text-[12px] border-t border-black pt-0.5 mt-0.5 gap-2">
                                <span>TOTAL (Rs):</span>
                                <span>{formatPrice(invoice.total).replace('Rs. ', '')}</span>
                            </div>
                            <div className="flex justify-between pt-0.5 gap-2">
                                <span>Paid:</span>
                                <span>{formatPrice(invoice.amountPaid).replace('Rs. ', '')}</span>
                            </div>
                            {invoice.changeGiven && invoice.changeGiven > 0 && (
                                <div className="flex justify-between">
                                    <span>Change:</span>
                                    <span>{formatPrice(invoice.changeGiven).replace('Rs. ', '')}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span>Balance:</span>
                                <span>{formatPrice(invoice.balanceDue).replace('Rs. ', '')}</span>
                            </div>
                        </div>
                        </div>

                        {/* Summary */}
                        <div className="flex justify-between text-[10px] mb-2 px-1">
                            <span>No of Items: <span className="font-bold">{invoice.items.length}</span></span>
                            <span>Total Qty: <span className="font-bold">{invoice.items.reduce((sum, item) => sum + item.quantity, 0)}</span></span>
                        </div>

                        {/* Footer */}
                        <div className="text-center text-[10px] pt-2 pb-4">
                              <p className="text-[9px] text-gray-600 leading-snug px-1 mb-3">
                                Exchange is Possible within 7 Days. Items need to be in reasonable condition (With package and tags with sale invoice)
                            </p>
                            <p>Thank you for your business!</p>
                          
                        </div>
                    </div>
                </div>

                <ScrollArea className="max-h-[75vh]">
                    <div ref={invoiceContentRef} className="bg-white" id="invoice-printable-area">
                        <div className="p-6">
                            <DialogHeader className="p-0 pb-6 border-b border-zinc-500 mb-6 ">
                                <DialogTitle className="sr-only">Invoice {invoice.invoiceNumber}</DialogTitle>
                                <div className="flex flex-col space-y-6">
                                    {/* Company Header */}
                                    {/* Company Header */}
                                    <div className="flex flex-col items-center text-center space-y-4">
                                        <img src="/logo.png" alt="Company Logo" className="h-16 w-auto object-contain" />
                                        <div className="space-y-1">
                                            <h1 className="font-bold text-3xl tracking-tight text-zinc-900 uppercase">Mahesh Auto accessories</h1>
                                            <div className="text-sm text-zinc-500 space-y-1">
                                                <p>No. 172/, Nattandiya Rd, Dankotuwa</p>
                                                <p>Tel: 077-6050787 , 031-2259699</p>
                                                <p>Email: maheshauto077@gmail.com</p>
                                            </div>
                                        </div>
                                    </div>

                                    <Separator className="my-6" />

                                    <div className="flex justify-between items-end">
                                        <div className="text-left space-y-1">
                                            <h2 className="text-3xl font-light tracking-tight text-zinc-900 uppercase">Invoice</h2>
                                            <p className="font-mono text-sm text-zinc-500">#{invoice.invoiceNumber}</p>
                                        </div>
                                        <Badge className={cn("capitalize text-sm font-semibold px-3 py-1 rounded-full", statusStyles[invoice.paymentStatus])} variant="outline">
                                            {invoice.paymentStatus}
                                        </Badge>
                                    </div>
                                </div>
                            </DialogHeader>
                            <div className="space-y-8">
                                {/* --- Customer & Vehicle Details --- */}
                                <div className="grid grid-cols-3 gap-6">
                                    <div className="col-span-1 space-y-4">
                                        <h3 className="text-xs uppercase tracking-widest text-zinc-400 font-bold">Bill To</h3>
                                        <div className="space-y-1">
                                            <p className="font-semibold text-base">{customer?.name}</p>
                                            <p className="text-sm text-zinc-600">{customer?.phone}</p>
                                        </div>
                                    </div>
                                    <div className="col-span-1 space-y-4">
                                        <h3 className="text-xs uppercase tracking-widest text-zinc-400 font-bold">Vehicle</h3>
                                        <div className="space-y-1">
                                            <p className="font-semibold text-base">{vehicle?.model}</p>
                                        </div>
                                    </div>
                                    <div className="col-span-1 space-y-4 text-right">
                                        <h3 className="text-xs uppercase tracking-widest text-zinc-400 font-bold">Details</h3>
                                        <div className="space-y-1">
                                            <p className="text-sm"><span className="font-semibold">Date:</span> {formatDateInSL(invoice.date)}</p>
                                            <p className="text-sm"><span className="font-semibold">Job By:</span> {employee?.name || 'N/A'}</p>
                                        </div>
                                    </div>
                                </div>
                                <Separator />
                                {/* --- Items Table --- */}
                                <div>
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-zinc-200">
                                                <th className="text-left font-semibold uppercase text-zinc-500 tracking-wider pb-2">Item</th>
                                                <th className="text-center font-semibold uppercase text-zinc-500 tracking-wider pb-2">Qty</th>
                                                <th className="text-right font-semibold uppercase text-zinc-500 tracking-wider pb-2">Unit Price</th>
                                                <th className="text-right font-semibold uppercase text-zinc-500 tracking-wider pb-2">Discount</th>
                                                <th className="text-right font-semibold uppercase text-zinc-500 tracking-wider pb-2">Line Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {invoice.items.map((item, index) => (
                                                <tr key={index} className="border-b border-zinc-100">
                                                    <td className="py-3 pr-2">
                                                        <div>{item.name}</div>
                                                        {item.warrantyMonths && item.warrantyMonths > 0 && (
                                                            <div className="text-xs text-emerald-600 font-medium mt-0.5">
                                                                ✓ {item.warrantyMonths} Month{item.warrantyMonths > 1 ? 's' : ''} Warranty
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-2 text-center">{item.quantity}</td>
                                                    <td className="py-3 px-2 text-right font-mono">{formatPrice(item.unitPrice)}</td>
                                                    <td className="py-3 px-2 text-right font-mono">{item.discount > 0 ? formatPrice(item.discount) : '-'}</td>
                                                    <td className="py-3 pl-2 text-right font-mono font-semibold">{formatPrice(item.total)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* --- Totals Section --- */}
                                <div className="flex justify-end">
                                    <div className="w-full max-w-sm space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-zinc-600">Subtotal:</span>
                                            <span className="font-mono">{formatPrice(invoice.subtotal)}</span>
                                        </div>
                                        {invoice.globalDiscountAmount > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-zinc-600">Global Discount ({invoice.globalDiscountPercent}%):</span>
                                                <span className="font-mono text-red-500">- {formatPrice(invoice.globalDiscountAmount)}</span>
                                            </div>
                                        )}
                                        <Separator />
                                        <div className="flex justify-between font-bold text-base">
                                            <span>Total:</span>
                                            <span className="font-mono">{formatPrice(invoice.total)}</span>
                                        </div>
                                        <Separator />

                                        {invoice.payments.map((payment, index) => (
                                            <div key={index} className="flex justify-between">
                                                <div className="text-zinc-600">
                                                    Paid by {payment.method}
                                                    {payment.method === 'Cheque' && payment.chequeNumber && (
                                                        <span className="block text-xs text-zinc-400">
                                                            (No: {payment.chequeNumber}, Bank: {payment.bank})
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="font-mono">{formatPrice(payment.amount)}</span>
                                            </div>
                                        ))}

                                        <div className="flex justify-between font-bold text-zinc-800">
                                            <span>Total Paid:</span>
                                            <span className="font-mono">{formatPrice(invoice.amountPaid)}</span>
                                        </div>

                                        {invoice.changeGiven && invoice.changeGiven > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-zinc-600">Change Given:</span>
                                                <span className="font-mono">{formatPrice(invoice.changeGiven)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between font-semibold">
                                            <span>Balance Due:</span>
                                            <span className="font-mono">{formatPrice(invoice.balanceDue)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </ScrollArea>
                <DialogFooter className="p-6 bg-zinc-50 border-t border-zinc-100 gap-4 flex-row justify-between items-center print:hidden">
                    {isFullyPaid ? (
                        <div className="flex items-center gap-2 text-sm text-emerald-600">
                            <CheckCircle className="h-4 w-4" />
                            <span>This invoice is fully paid.</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-sm text-amber-600">
                            <AlertCircle className="h-4 w-4" />
                            <span>This is a partial payment. Balance of {formatPrice(invoice.balanceDue)} is due.</span>
                        </div>
                    )}
                    <div className='flex gap-2'>
                        <Button onClick={handleShare} variant="outline" className="rounded-none uppercase tracking-widest text-xs h-11" disabled={isSharing}>
                            {isSharing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}
                            {isSharing ? 'Sharing...' : 'Share'}
                        </Button>
                        <Button onClick={() => handlePrintReceipt && handlePrintReceipt()} variant="outline" className="rounded-none uppercase tracking-widest text-xs h-11 border-zinc-400 text-zinc-700 hover:bg-zinc-100">
                            <ScrollText className="mr-2 h-4 w-4" />
                            Print
                        </Button>
                    </div>
                </DialogFooter>

                <style jsx global>{`
          @media print {
            body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            body * {
              visibility: hidden;
            }
            .receipt-print, .receipt-print * {
              visibility: visible !important;
            }
            .receipt-print {
              position: fixed !important;
              left: 50% !important;
              top: 0 !important;
              transform: translateX(-50%) !important;
              width: 72mm !important;
              max-width: 72mm !important;
              height: auto !important;
              overflow: hidden !important;
              background: white !important;
              margin: 0 !important;
              padding: 2mm !important;
              font-size: 12px !important;
            }
          }
          
          @media print {
            @page {
              size: 80mm auto;
              margin: 4mm;
            }
          }
        `}</style>
            </DialogContent>
        </Dialog>
    );
}

