'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { User, Search, Plus, Phone } from 'lucide-react';
import { useDebounce } from 'use-debounce';
import { cn } from '@/lib/utils';
import { ScrollArea } from "@/components/ui/scroll-area";

type Customer = {
    id: string;
    name: string;
    phone: string;
};

interface CustomerSelectDialogProps {
    onSelect: (mobile: string | string[], name: string) => void;
    currentMobile: string;
    multiSelect?: boolean;
}

export function CustomerSelectDialog({ onSelect, currentMobile, multiSelect = false }: CustomerSelectDialogProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [debouncedSearch] = useDebounce(search, 500);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Multi-select state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (open) {
            fetchCustomers();
            if (multiSelect) {
                setSelectedIds(new Set()); // Reset on open for fresh selection
            }
        }
    }, [open, debouncedSearch]);

    const fetchCustomers = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (debouncedSearch) {
                params.set('search', debouncedSearch);
            } else {
                params.set('limit', '50'); // Fetch more for selection
            }

            const res = await fetch(`/api/customers?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setCustomers(data);
            }
        } catch (error) {
            console.error("Failed to fetch customers", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (customer: Customer) => {
        if (multiSelect) {
            const newSelected = new Set(selectedIds);
            if (newSelected.has(customer.id)) {
                newSelected.delete(customer.id);
            } else {
                newSelected.add(customer.id);
            }
            setSelectedIds(newSelected);
        } else {
            onSelect(customer.phone, customer.name);
            setOpen(false);
        }
    };

    const handleConfirmMulti = () => {
        const selectedCustomers = customers.filter(c => selectedIds.has(c.id));
        const phones = selectedCustomers.map(c => c.phone).filter(p => p);
        onSelect(phones, `Selected (${phones.length})`);
        setOpen(false);
    };

    const handleCustomNumber = () => {
        if (search.match(/^\d{10}$/)) {
            onSelect(search, "Unknown");
            setOpen(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {multiSelect ? (
                   <Button variant="outline" className="flex-1">
                        <User className="mr-2 h-4 w-4" /> Pick Customers
                   </Button>
                ) : (
                    <div className="relative cursor-pointer">
                        <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Select Mobile Number..." 
                            value={currentMobile} 
                            readOnly 
                            className="pl-9 cursor-pointer pointer-events-none" 
                        />
                        <div className="absolute inset-0" />
                    </div>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{multiSelect ? `Select Customers (${selectedIds.size})` : "Select Customer"}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by name or mobile..."
                            className="pl-9"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            autoFocus
                        />
                    </div>
                    
                    <ScrollArea className="h-[300px] border rounded-md p-2">
                        {loading ? (
                            <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
                        ) : customers.length > 0 ? (
                            <div className="space-y-1">
                                {customers.map((customer) => {
                                    const isSelected = selectedIds.has(customer.id);
                                    return (
                                        <div
                                            key={customer.id}
                                            className={cn(
                                                "flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors",
                                                isSelected ? "bg-blue-50 border border-blue-200" : "hover:bg-zinc-100"
                                            )}
                                            onClick={() => handleSelect(customer)}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={cn("p-2 rounded-full", isSelected ? "bg-blue-100 text-blue-600" : "bg-zinc-200")}>
                                                    <User className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium">{customer.name}</p>
                                                    <p className="text-xs text-muted-foreground">{customer.phone}</p>
                                                </div>
                                            </div>
                                            {multiSelect && isSelected && <div className="text-blue-600 text-xs font-bold">✓</div>}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                <p className="text-sm">No customers found.</p>
                                {!multiSelect && search.match(/^\d{10}$/) && (
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="mt-4" 
                                        onClick={handleCustomNumber}
                                    >
                                        <Plus className="h-4 w-4 mr-2" /> Use "{search}"
                                    </Button>
                                )}
                            </div>
                        )}
                    </ScrollArea>
                    
                    {multiSelect && (
                        <Button onClick={handleConfirmMulti} disabled={selectedIds.size === 0} className="w-full">
                            Confirm Selection ({selectedIds.size})
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
