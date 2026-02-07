'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import type { Product, Service, Employee, Customer, Vehicle, Invoice, Payment, VehicleCategory } from '@/lib/data';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Search, UserPlus, Car, Bike, Truck, Sparkles, Loader2, Archive, PlusCircle, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

import { useToast } from '@/hooks/use-toast';
import { PaymentDialog } from '@/components/pos/PaymentDialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Check, ChevronsUpDown } from 'lucide-react';
import { CartItem as CartItemComponent } from '@/components/pos/CartItem';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { VanIcon } from '@/components/icons/VanIcon';
import { JeepIcon } from '@/components/icons/JeepIcon';
import { WithId } from "@/lib/data";
import { CartTotals } from '@/components/pos/CartTotals';
import { InvoiceDetailsDialog } from '@/components/invoices/InvoiceDetailsDialog';

// --- Types ---
export type CartItemBase = {
  cartId: string;
  quantity: number;
  discountAmount: number; // Discount per UNIT
};

export type StandardCartItem = CartItemBase & WithId<Product | Service> & {
  type: 'product' | 'service';
};

export type CustomCartItem = CartItemBase & {
  name: string;
  unitPrice: number;
  type: 'custom';
  stock: number; // Added for type consistency
};

export type CartItem = StandardCartItem | CustomCartItem;


// --- Math & Helper Utilities ---

// Solves floating point math issues (e.g., 0.1 + 0.2 !== 0.3)
export const safeRound = (num: number): number => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

// Safely gets price regardless of Product (sellingPrice) or Service (price)
export const getItemPrice = (item: CartItem): number => {
  if (item.type === 'custom') return item.unitPrice;
  if ('sellingPrice' in item) return (item as WithId<Product>).sellingPrice;
  if ('price' in item) return (item as WithId<Service>).price;
  return 0;
};

const categoryIcons: Record<VehicleCategory, React.ElementType> = {
    "Bike": Bike,
    "Car": Car,
    "Van": VanIcon,
    "Jeep": JeepIcon,
    "Lorry": Truck,
};

export default function POSPage() {
  const { toast } = useToast();
  const customNameInputRef = useRef<HTMLInputElement>(null);

  // --- Data States (fetched from API) ---
  const [products, setProducts] = useState<WithId<Product>[]>([]);
  const [services, setServices] = useState<WithId<Service>[]>([]);
  const [employees, setEmployees] = useState<WithId<Employee>[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [employeesLoading, setEmployeesLoading] = useState(true);


  // --- UI/Logic States ---
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('services');
  const [categoryFilter, setCategoryFilter] = useState<VehicleCategory | 'all'>('all');
  const [globalDiscountPercent, setGlobalDiscountPercent] = useState<number>(0);
  const [selectedEmployees, setSelectedEmployees] = useState<WithId<Employee>[]>([]);
  const [employeePopoverOpen, setEmployeePopoverOpen] = useState(false);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<WithId<Customer> | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<WithId<Vehicle> | null>(null);
  const [customerVehicles, setCustomerVehicles] = useState<WithId<Vehicle>[]>([]);
  const [isPaymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<any | null>(null);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  



  const [mobileInput, setMobileInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [vehicleInput, setVehicleInput] = useState('');
  const [isCustomerLoading, setIsCustomerLoading] = useState(false);
  const [isVehicleSelect, setIsVehicleSelect] = useState(false); // Toggle between Select and Input for vehicle
  const [sendSmsNotification, setSendSmsNotification] = useState(true); // SMS notification checkbox - default checked
  
  // Clean inputs when payment completes or resets
  const resetCustomerInputs = useCallback(() => {
    setMobileInput('');
    setNameInput('');
    setVehicleInput('');
    setCustomerVehicles([]);
    setIsVehicleSelect(false);
    setIsCustomerLoading(false);
  }, []);

  const fetchInitialData = useCallback(async (signal: AbortSignal) => {
      try {
        setProductsLoading(true);
        setServicesLoading(true);
        setEmployeesLoading(true);
        
        const [productsRes, servicesRes, employeesRes] = await Promise.all([
          fetch('/api/products?limit=2000', { signal }), // Fetch large batch for POS catalog
          fetch('/api/services', { signal }),
          fetch('/api/employees', { signal }),
        ]);

        if (!productsRes.ok) throw new Error('Failed to fetch products');
        if (!servicesRes.ok) throw new Error('Failed to fetch services');
        if (!employeesRes.ok) throw new Error('Failed to fetch employees');
        
        const productsData = await productsRes.json();
        setProducts(productsData.products || []); // Handle paginated response
        setServices(await servicesRes.json());
        setEmployees(await employeesRes.json());

      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
            return;
        }
        const message = err instanceof Error ? err.message : 'Could not fetch initial POS data.';
        toast({ variant: 'destructive', title: 'Error', description: message });
      } finally {
        setProductsLoading(false);
        setServicesLoading(false);
        setEmployeesLoading(false);
      }
    }, [toast]);
    
  useEffect(() => {
    const controller = new AbortController();
    fetchInitialData(controller.signal);
    
    return () => {
      controller.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    if (cart.some(item => item.type === 'custom' && item.name === '')) {
      customNameInputRef.current?.focus();
    }
  }, [cart]);

  // --- Customer Lookup Effect ---
  useEffect(() => {
    if (mobileInput.length === 10) {
      const checkCustomer = async () => {
        setIsCustomerLoading(true);
        try {
          const res = await fetch(`/api/customers?phone=${mobileInput}`);
          if (res.ok) {
             const data = await res.json();
             if (data && data.length > 0) {
                 const customer = data[0];
                 setSelectedCustomer(customer);
                 setNameInput(customer.name);
                 
                 // Handle Vehicles
                 if (customer.vehicles && customer.vehicles.length > 0) {
                     setCustomerVehicles(customer.vehicles);
                     setIsVehicleSelect(true); // Switch to dropdown
                 } else {
                     setCustomerVehicles([]);
                     setIsVehicleSelect(false); // Switch to input
                 }
             } else {
                 // New customer
                 setSelectedCustomer(null);
                 setCustomerVehicles([]);
                 setIsVehicleSelect(false);
                 if (nameInput && selectedCustomer) setNameInput(''); // Only clear if we were on another customer
             }
          }
        } catch (err) {
            console.error("Error checking customer", err);
        } finally {
            setIsCustomerLoading(false);
        }
      };
      checkCustomer();
    } else {
        if (selectedCustomer) {
            setSelectedCustomer(null);
            setNameInput('');
            setVehicleInput('');
            setCustomerVehicles([]);
            setIsVehicleSelect(false);
        }
    }
  }, [mobileInput]);

  // --- Logic Helpers ---
  const formatPrice = (price: number) => {
    return Math.max(0, price).toLocaleString("en-US", {
      style: "decimal",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const addToCart = useCallback((item: WithId<Product> | WithId<Service>, type: 'product' | 'service') => {
    setCart((prev) => {
      const existing = prev.find((i) => i.type !== 'custom' && i.id === item.id);
      
      // Always check against the latest product state
      let stock = Infinity;
      if (type === 'product') {
        const liveProduct = products.find(p => p.id === item.id);
        stock = liveProduct ? liveProduct.stock : 0;
      }
      
      if (existing) {
        if (existing.quantity < stock) {
          return prev.map((i) => i.cartId === existing.cartId ? { ...i, quantity: i.quantity + 1 } : i);
        }
        toast({
          variant: 'destructive',
          title: 'Stock Limit Reached',
          description: `Cannot add more of ${item.name}.`,
        });
        return prev;
      }
      
      if (stock > 0) {
        const newItem: StandardCartItem = {
          ...(item as WithId<Product> | WithId<Service>),
          cartId: `${item.id}-${Date.now()}`,
          quantity: 1,
          type,
          discountAmount: 0
        };
        return [...prev, newItem];
      } else {
         toast({
          variant: 'destructive',
          title: 'Out of Stock',
          description: `${item.name} is currently out of stock.`,
        });
      }
      return prev;
    });
  }, [products, toast]);

  const addCustomJob = () => {
    const newCustomItem: CustomCartItem = {
      cartId: `custom-${Date.now()}`,
      name: '',
      quantity: 1,
      unitPrice: 0,
      discountAmount: 0,
      type: 'custom',
      stock: Infinity, // Custom jobs don't have stock
    };
    setCart(prev => [...prev, newCustomItem]);
  };
  
  const updateCartItem = (cartId: string, updates: Partial<CartItem>) => {
    const item = cart.find(i => i.cartId === cartId);
    if (!item) return;

    let validatedUpdates = { ...updates };

    if ('quantity' in validatedUpdates && validatedUpdates.quantity !== undefined) {
      const newQuantity = validatedUpdates.quantity;
      if (item.type === 'product') {
        const liveProduct = products.find(p => p.id === item.id);
        const stock = liveProduct ? liveProduct.stock : 0;
        if (newQuantity > stock) {
          toast({
            variant: 'destructive',
            title: 'Stock Limit Exceeded',
            description: `Only ${stock} units of ${item.name} available.`,
          });
          validatedUpdates.quantity = stock;
        }
      }
      if (newQuantity < 1) {
        validatedUpdates.quantity = 1;
      }
    }

    if ('discountAmount' in validatedUpdates && validatedUpdates.discountAmount !== undefined) {
      const originalPrice = getItemPrice(item);
      if (validatedUpdates.discountAmount > originalPrice) {
        toast({
          variant: "destructive",
          title: "Invalid Discount",
          description: "Discount cannot be greater than the item's price.",
        });
        validatedUpdates.discountAmount = originalPrice;
      }
      if (validatedUpdates.discountAmount < 0) {
        validatedUpdates.discountAmount = 0;
      }
    }
    
    setCart(prev => prev.map(i => i.cartId === cartId ? { ...i, ...validatedUpdates } as CartItem : i));
  }
  
  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.cartId !== id));
  };

  // --- Barcode Scanner Logic ---
  const scannerBuffer = useRef<string>('');
  const lastKeyTime = useRef<number>(0);
  const scannerInputRef = useRef<HTMLInputElement>(null);

  // Refocus scanner input on any click to ensure it captures scanner input
  useEffect(() => {
    const refocusScanner = (e?: Event) => {
      // If the user clicked on an interactive element (input, select, button), don't steal focus
      const target = e?.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
          return;
      }

      // Check if focus is currently within a dialog or popover or cmdk
      const activeElement = document.activeElement;
      const isFocusInOverlay = activeElement?.closest('[role="dialog"]') || 
                               activeElement?.closest('[role="listbox"]') || 
                               activeElement?.closest('[role="menu"]') ||
                               activeElement?.closest('[cmdk-root]'); // Kept for other cmdk instances if any
      
      if (isFocusInOverlay) {
          return;
      }

      // Only refocus if no dialog/popover is open
      if (!isPaymentDialogOpen && !employeePopoverOpen) {
          // Small delay to allow other events to process
          setTimeout(() => {
              // Re-check conditions after delay
              if (document.activeElement?.tagName !== 'INPUT') {
                 scannerInputRef.current?.focus();
              }
          }, 10);
      }
    };
    
    window.addEventListener('click', refocusScanner);
    // Initial focus
    refocusScanner();
    
    return () => window.removeEventListener('click', refocusScanner);
  }, [isPaymentDialogOpen, employeePopoverOpen]);

  // Process scanned barcode
  const processBarcodeScan = useCallback((scannedCode: string) => {
    if (productsLoading || scannedCode.length < 3) return;
    
    const normalize = (str: string) => str.trim().replace(/^0+/, '').toLowerCase();
    const normalizedScan = normalize(scannedCode);
    
    const product = products.find(p => {
      const normBarcode = normalize(p.barcode || '');
      const normSku = normalize(p.sku || '');
      return (normBarcode && normBarcode === normalizedScan) || 
             (normSku && normSku === normalizedScan);
    });
    
    if (product) {
      addToCart(product, 'product');
      toast({
        title: "Item Scanned",
        description: `Added ${product.name} to cart.`,
        duration: 1500,
      });
      setSearchQuery('');
    } else if (scannedCode.length > 3) {
      toast({
        variant: 'destructive',
        title: "Product Not Found",
        description: `No product found with barcode: ${scannedCode}`,
        duration: 3000,
      });
    }
  }, [products, productsLoading, addToCart, toast, setSearchQuery]);

  // Handle scanner input field
  const handleScannerInput = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const value = (e.target as HTMLInputElement).value;
      if (value.length > 2) {
        processBarcodeScan(value);
        (e.target as HTMLInputElement).value = '';
      }
    }
  }, [processBarcodeScan]);

  // Fallback: Window-level keydown handler for scanning outside hidden input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (productsLoading) return;

      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      const isScannerInput = target.id === 'barcode-scanner-input';
      
      // If it's the dedicated scanner input, let its own handler deal with it
      if (isScannerInput) return;

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime.current;
      
      // If inside an input and typing is SLOW (human speed), just reset buffer
      // but DON'T return - let the first char of a new scan start the buffer
      if (isInput && timeDiff > 100) {
        scannerBuffer.current = '';
      } else if (!isInput && timeDiff > 200) {
        // Outside inputs, use longer threshold
        scannerBuffer.current = '';
      }
      
      lastKeyTime.current = currentTime;

      if (e.key === 'Enter' || e.key === 'Tab') {
        if ((scannerBuffer.current?.length || 0) > 2) { 
          e.preventDefault();
          processBarcodeScan(scannerBuffer.current || '');
          scannerBuffer.current = '';
        }
      } else if (e.key && e.key.length === 1) { 
        scannerBuffer.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [productsLoading, processBarcodeScan]);
  
 

  // --- Core Financial Calculations ---
  const totals = useMemo(() => {
    const subtotal = cart.reduce((acc, item) => {
      const price = getItemPrice(item);
      return safeRound(acc + price * item.quantity);
    }, 0);
    
    const totalItemDiscount = cart.reduce((acc, item) => {
      return safeRound(acc + item.discountAmount * item.quantity);
    }, 0);

    const subtotalAfterItemDiscount = safeRound(subtotal - totalItemDiscount);
    
    const globalDiscountValue = Math.max(0, globalDiscountPercent || 0);
    const globalDiscountAmount = safeRound(subtotalAfterItemDiscount * (globalDiscountValue / 100));

    const total = Math.max(0, safeRound(subtotalAfterItemDiscount - globalDiscountAmount));
    const totalDiscount = safeRound(totalItemDiscount + globalDiscountAmount);

    return {
      subtotal,
      totalItemDiscount,
      subtotalAfterItemDiscount,
      globalDiscountAmount,
      total,
      totalDiscount,
    };
  }, [cart, globalDiscountPercent]);


  const itemsToShow = useMemo(() => {
    let list: WithId<Service>[] | WithId<Product>[] | undefined;

    if (activeTab === 'services') {
        list = services;
        if (categoryFilter !== 'all') {
            list = list?.filter(s => s.vehicleCategory === categoryFilter);
        }
    } else {
        list = products;
    }
    
    if (!searchQuery) return list;
    const lowercasedQuery = searchQuery.toLowerCase().trim();
    return list?.filter((i: any) => {
        const matchesName = i.name.toLowerCase().includes(lowercasedQuery);
        // Check for SKU if it exists
        const matchesSku = i.sku && i.sku.toLowerCase().includes(lowercasedQuery);
        // Check for Barcode if it exists
        const matchesBarcode = i.barcode && i.barcode.toLowerCase().includes(lowercasedQuery);
        
        return matchesName || matchesSku || matchesBarcode;
    });
  }, [activeTab, services, products, searchQuery, categoryFilter]);


  const resetState = useCallback(() => {
    resetCustomerInputs();
    setCart([]);
    setGlobalDiscountPercent(0);
    resetCustomerInputs();
    setCart([]);
    setGlobalDiscountPercent(0);
    setSelectedEmployees([]);
    setSelectedCustomer(null);
    setSelectedVehicle(null);
    setSelectedCustomer(null);
    setSelectedVehicle(null);
    setPaymentDialogOpen(false);
  }, [resetCustomerInputs]);

  const handleProcessPayment = async () => {
    if (totals.total <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid Transaction',
        description: 'Cannot process a transaction with a total of zero.',
      });
      return;
    }

    // --- Resolve Customer & Vehicle ---
    // With new Transactional API, we don't need to pre-create customer/vehicle here.
    // We just validate that we have enough info to send to the server.
    
    // We need either a selected customer OR (mobile + name)
    const hasCustomerInfo = selectedCustomer || (mobileInput.length === 10 && nameInput.trim().length > 0);
    
    if (!hasCustomerInfo || selectedEmployees.length === 0 || cart.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please ensure Customer, at least one Employee, and Cart items are set.',
      });
      return;
    }

    const errors: string[] = [];
    cart.forEach(cartItem => {
        if (cartItem.type === 'product') {
            const liveProduct = products?.find(p => p.id === cartItem.id);
            if (!liveProduct || liveProduct.stock < cartItem.quantity) {
                errors.push(`Insufficient stock for: ${cartItem.name}`);
            }
        }
        if (cartItem.type === 'custom' && (!cartItem.name.trim() || cartItem.unitPrice <= 0)) {
            errors.push('A custom job is missing a name or has an invalid price.');
        }
    });

    if (errors.length > 0) {
        toast({
            variant: 'destructive',
            title: 'Invoice Error',
            description: errors.join(' '),
        });
        return;
    }

    setPaymentDialogOpen(true);
  };
  
  const handleConfirmPayment = useCallback(async (paymentDetails: {
    payments: Payment[];
    amountPaid: number;
    balanceDue: number;
    paymentStatus: 'Paid' | 'Partial' | 'Unpaid';
    changeGiven: number;
  }) => {
    // If we have inputs but no selected customer, we pass the inputs to API to create one
    // Same for vehicle
    if (selectedEmployees.length === 0) return;

    setIsProcessing(true);
    
    const invoiceItems = cart.map(item => {
      const originalPrice = getItemPrice(item);
      const discountedPricePerUnit = Math.max(0, originalPrice - item.discountAmount);
      const lineTotal = safeRound(discountedPricePerUnit * item.quantity);
      
      // Get warranty from product (only products have warranty, not services or custom)
      let warrantyMonths: number | undefined = undefined;
      if (item.type === 'product' && 'warrantyMonths' in item) {
        warrantyMonths = (item as WithId<Product>).warrantyMonths;
      }
      
      const invoiceItem: {
        itemId: string;
        name: string;
        quantity: number;
        unitPrice: number;
        discount: number;
        total: number;
        warrantyMonths?: number;
      } = {
        itemId: item.type !== 'custom' ? item.id : `custom-${Date.now()}`,
        name: item.name,
        quantity: item.quantity,
        unitPrice: originalPrice,
        discount: item.discountAmount,
        total: lineTotal,
      };
      
      // Only include warrantyMonths if it has a value
      if (warrantyMonths !== undefined && warrantyMonths !== null && warrantyMonths > 0) {
        invoiceItem.warrantyMonths = warrantyMonths;
      }
      
      return invoiceItem;
    });

    // Prepare payload for Transactional API
    const invoicePayload: any = {
      invoiceNumber: `INV-${Date.now()}`,
      employeeIds: selectedEmployees.map(e => e.id),
      date: Date.now(),
      items: invoiceItems,
      subtotal: totals.subtotal,
      globalDiscountPercent,
      globalDiscountAmount: totals.globalDiscountAmount,
      total: totals.total,
      paymentStatus: paymentDetails.paymentStatus,
      payments: paymentDetails.payments,
      amountPaid: paymentDetails.amountPaid,
      balanceDue: paymentDetails.balanceDue,
      changeGiven: paymentDetails.changeGiven,
    };

    // Customer Info
    if (selectedCustomer) {
        invoicePayload.customerId = selectedCustomer.id;
    } else {
        // New Customer info
        invoicePayload.customerName = nameInput;
        invoicePayload.customerPhone = mobileInput;
    }

    // Vehicle Info
    if (selectedVehicle) {
        invoicePayload.vehicleId = selectedVehicle.id;
    } else if (vehicleInput.trim()) {
        // New Vehicle Info (only if typed in input mode)
        invoicePayload.vehicleModel = vehicleInput;
    }
    
    try {
        const res = await fetch('/api/invoices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(invoicePayload),
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Failed to create invoice');
        }
        
        toast({
          title: 'Invoice Created',
          description: `Invoice for ${selectedCustomer ? selectedCustomer.name : nameInput} successfully processed for LKR ${formatPrice(totals.total)}.`,
        });

        // Optimistically update product stock on client
        setProducts(prevProducts => {
            const newProducts = [...prevProducts];
            cart.forEach(cartItem => {
                if (cartItem.type === 'product') {
                    const index = newProducts.findIndex(p => p.id === cartItem.id);
                    if (index !== -1) {
                        newProducts[index] = {
                            ...newProducts[index],
                            stock: newProducts[index].stock - cartItem.quantity,
                        };
                    }
                }
            });
            return newProducts;
        });

        // Show Receipt Dialog
        const invoiceData = await res.json();
        const enrichedInvoice: any = {
            ...invoiceData,
            customerDetails: invoiceData.customer,
            vehicleDetails: invoiceData.vehicle,
            employeeDetails: selectedEmployees[0], // Show first employee as primary
            employees: selectedEmployees, // Pass full list
        };
        
        setLastInvoice(enrichedInvoice);
        setShowInvoiceDialog(true);

        // Send SMS notification if enabled
        if (sendSmsNotification) {
            const customerPhone = selectedCustomer?.phone || mobileInput;
            if (customerPhone && customerPhone.length === 10) {
                const itemsList = cart.map(item => `${item.name} x${item.quantity}`).join(', ');
                const smsMessage = `Thank you for your purchasing at Mahesh Auto Accessories!\n\nInvoice No: ${invoiceData.invoiceNumber}\nBilled Items: ${itemsList}\nTotal: Rs.${totals.total.toLocaleString()}`;
                
                try {
                    await fetch('/api/sms/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            mobile: `94${customerPhone.slice(-9)}`, // Convert to Sri Lankan format
                            message: smsMessage,
                            fromFlow: 'Invoice Notification',
                            saveToHistory: false
                        })
                    });
                    toast({
                        title: 'SMS Sent',
                        description: `Notification sent to ${customerPhone}`,
                    });
                } catch (smsErr) {
                    console.error('SMS send failed:', smsErr);
                    // Don't show error toast - SMS is optional
                }
            }
        }

        resetState();
    } catch(err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to save invoice.';
        toast({ variant: 'destructive', title: 'Error', description: message });
    } finally {
        setIsProcessing(false);
    }
  }, [selectedCustomer, selectedVehicle, selectedEmployees, cart, totals, globalDiscountPercent, resetState, toast, mobileInput, nameInput, vehicleInput, sendSmsNotification]);
  
  const filterButtons: { label: string; value: VehicleCategory | 'all'; icon: React.ElementType }[] = [
    { label: 'All', value: 'all', icon: Sparkles },
    { label: 'Bike', value: 'Bike', icon: Bike },
    { label: 'Car', value: 'Car', icon: Car },
    { label: 'Van', value: 'Van', icon: VanIcon },
    { label: 'Jeep', value: 'Jeep', icon: JeepIcon },
    { label: 'Lorry', value: 'Lorry', icon: Truck },
  ];

  const isLoading = productsLoading || servicesLoading || employeesLoading;

  const renderSkeletons = () => (
    Array.from({ length: 9 }).map((_, i) => (
      <Skeleton key={i} className="h-[180px] w-full" />
    ))
  );

  return (
    <div className="flex h-screen w-full bg-background font-sans overflow-hidden">
      
      {/* Hidden Scanner Input - Captures barcode scanner input */}
      <input
        ref={scannerInputRef}
        id="barcode-scanner-input"
        type="text"
        autoComplete="off"
        className="absolute w-0 h-0 opacity-0 pointer-events-none"
        onKeyDown={handleScannerInput}
        aria-hidden="true"
      />
      
      {/* LEFT: CATALOG (55%) */}
      <div className="relative z-10 w-[55%] flex flex-col pt-8 pl-12 pr-6">
        
        <div className="flex justify-between items-start mb-6">
            <div>
                <h1 className="text-5xl font-normal tracking-tighter mb-2">POINT OF SALE</h1>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Create new invoices</p>
            </div>
            
            <div className="relative group w-80">
                <Search className="absolute left-0 bottom-3 h-4 w-4 text-zinc-400 group-focus-within:text-black transition-colors" />
                <input
                    type="search"
                    placeholder="SEARCH ITEM..."
                    className="w-full bg-transparent border-b border-zinc-200 py-2.5 pl-8 text-sm outline-none placeholder:text-zinc-300 placeholder:uppercase placeholder:tracking-widest uppercase tracking-wide focus:border-black transition-colors"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
        </div>

        <div className={cn("flex items-center gap-2 transition-opacity", activeTab === 'products' && 'opacity-20 pointer-events-none')}>
            {filterButtons.map(({ label, value, icon: Icon }) => (
                <TooltipProvider key={value}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                            key={value}
                            onClick={() => setCategoryFilter(value)}
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "h-10 w-10 rounded-full border border-zinc-200 text-zinc-400 hover:bg-zinc-100 hover:text-black",
                                categoryFilter === value && "bg-black text-white hover:bg-black hover:text-white border-black"
                            )}
                            >
                                <Icon className="h-5 w-5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Filter {label}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            ))}
        </div>

        <Tabs defaultValue="services" value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col min-h-0 mt-8">
            <TabsList className="bg-zinc-100 justify-start p-1 w-full rounded-none">
                <TabsTrigger
                    value="services"
                    className="relative h-10 px-6 rounded-none text-sm font-medium uppercase tracking-widest text-zinc-400 data-[state=active]:text-white data-[state=active]:bg-black data-[state=active]:shadow-none hover:bg-zinc-200 transition-colors"
                >
                    Services
                </TabsTrigger>
                <TabsTrigger
                    value="products"
                    className="relative h-10 px-6 rounded-none text-sm font-medium uppercase tracking-widest text-zinc-400 data-[state=active]:text-white data-[state=active]:bg-black data-[state=active]:shadow-none hover:bg-zinc-200 transition-colors"
                >
                    Products
                </TabsTrigger>
            </TabsList>
            
            <ScrollArea className="flex-1 -mr-4 pr-4 mt-8">
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
                    {isLoading ? renderSkeletons() : itemsToShow?.map((item) => {
                        const isProduct = 'stock' in item;
                        const isService = 'price' in item;
                        const cartItem = cart.find(ci => ci.type !== 'custom' && ci.id === item.id);
                        const cartQuantity = cartItem?.quantity ?? 0;
                        const stock = isProduct ? (item as WithId<Product>).stock : Infinity;
                        const isOutOfStock = stock <= 0;
                        const cartLimitReached = isProduct && cartQuantity >= stock;
                        const isDisabled = isOutOfStock || cartLimitReached;
                        const CategoryIcon = isService && item.vehicleCategory ? categoryIcons[item.vehicleCategory] : null;

                        return (
                            <button 
                                key={item.id} 
                                onClick={() => addToCart(item, activeTab === 'services' ? 'service' : 'product')} 
                                disabled={isDisabled}
                                className={cn(
                                    "group relative flex flex-col justify-between h-[180px] p-5 border border-zinc-200 bg-white text-left transition-all duration-200",
                                    !isDisabled && "hover:border-black hover:z-10",
                                    isDisabled && "bg-zinc-50 opacity-60 cursor-not-allowed"
                                )}
                            >
                                <div className="flex justify-between items-start w-full">
                                    <div className='flex items-center gap-2'>
                                        {CategoryIcon && <CategoryIcon className="w-4 h-4 text-zinc-400" />}
                                        <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-300 group-hover:text-black transition-colors border border-zinc-100 group-hover:border-zinc-900 px-1.5 py-0.5 rounded-sm">
                                            {isService ? 'SVC' : 'PRD'}
                                        </span>
                                    </div>
                                    <span className="font-mono text-lg font-medium text-zinc-900">
                                        {formatPrice(getItemPrice(item as any))}
                                    </span>
                                </div>
                                
                                <div className="flex-1 flex flex-col justify-center py-2">
                                    <h3 className="text-xl font-medium leading-tight tracking-tight line-clamp-2 text-zinc-800 group-hover:text-black">
                                        {item.name}
                                    </h3>
                                    {isService && (item as WithId<Service>).description && (
                                        <p className="text-xs text-zinc-400 mt-1 line-clamp-1">{ (item as WithId<Service>).description }</p>
                                    )}
                                </div>

                                <div className="w-full flex justify-between items-end border-t border-zinc-100 pt-3 mt-1 group-hover:border-zinc-200 transition-colors">
                                     <div className='flex items-center gap-2'>
                                        <span className="font-mono text-[10px] text-zinc-300">
                                            #{item.id ? item.id.substring(0, 5).toUpperCase() : '000'}
                                        </span>
                                        {isProduct && (
                                            <div className={cn("flex items-center gap-1 text-xs", stock < item.stockThreshold ? 'text-red-500' : 'text-zinc-400')}>
                                                <Archive className="w-3 h-3" />
                                                <span>{stock}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                                        {isDisabled ? (
                                             <span className="text-[9px] uppercase tracking-widest font-bold text-red-500">
                                                {isOutOfStock ? "Out of Stock" : "Limit Reached"}
                                             </span>
                                        ): (
                                            <>
                                                <span className="text-[9px] uppercase tracking-widest font-bold">Add</span>
                                                <span className="text-sm leading-none mb-0.5">+</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                     {!isLoading && itemsToShow?.length === 0 && (
                        <div className="col-span-full text-center py-20 text-zinc-400 text-sm uppercase tracking-widest">
                            No items match your filter
                        </div>
                    )}
                </div>
            </ScrollArea>
        </Tabs>
      </div>

      {/* RIGHT: INVOICE (45%) */}
      <div className="relative z-20 w-[45%] flex flex-col bg-white border-l border-zinc-100 h-full">
        
        <div className="pt-8 px-10 pb-4">
                <div className="flex flex-col w-full mb-6">
                 <div className="flex items-end gap-3 w-full">
                     <div className="relative w-[30%] group">
                         <div className="text-[10px] uppercase tracking-wider text-zinc-400 mb-1">Mobile</div>
                         <input
                            type="text"
                            placeholder="Mobile"
                            value={mobileInput}
                            onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                                setMobileInput(val);
                            }}
                            className="w-full bg-transparent border-b border-zinc-200 py-1.5 text-sm outline-none placeholder:text-zinc-300 placeholder:uppercase placeholder:tracking-wider focus:border-black transition-colors focus:placeholder-transparent font-mono"
                         />
                         {isCustomerLoading && <Loader2 className="absolute right-0 bottom-2 h-3 w-3 animate-spin text-zinc-400"/>}
                     </div>

                    <div className="w-[35%]">
                        <div className="text-[10px] uppercase tracking-wider text-zinc-400 mb-1">Customer Name</div>
                        <input
                            type="text"
                            placeholder="Name"
                            value={nameInput}
                            disabled={mobileInput.length !== 10 || selectedCustomer !== null}
                            onChange={(e) => setNameInput(e.target.value)}
                             className={cn(
                                "w-full bg-transparent border-b border-zinc-200 py-1.5 text-sm outline-none placeholder:text-zinc-300 placeholder:uppercase placeholder:tracking-wider focus:border-black transition-colors focus:placeholder-transparent disabled:opacity-50 disabled:cursor-not-allowed uppercase",
                                selectedCustomer && "text-zinc-600"
                             )}
                        />
                    </div>

                    <div className="w-[35%]">
                        <div className="text-[10px] uppercase tracking-wider text-zinc-400 mb-1">Vehicle Model</div>
                        {isVehicleSelect ? (
                            <div className="relative">
                                {/* Using a native select for simplicity within the restricted layout or a custom dropdown. 
                                    Given shadcn/ui Select might need more space/overlay behavior, let's use a simple styled select 
                                    or toggle back to input for "New".
                                */}
                                <select 
                                    className="w-full bg-transparent border-b border-zinc-200 py-1.5 text-sm outline-none focus:border-black transition-colors uppercase cursor-pointer"
                                    value={selectedVehicle ? selectedVehicle.id : ""}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === 'new') {
                                            setIsVehicleSelect(false);
                                            setSelectedVehicle(null);
                                            setVehicleInput('');
                                        } else {
                                            const v = customerVehicles.find(v => v.id === val);
                                            setSelectedVehicle(v || null);
                                        }
                                    }}
                                >
                                    <option value="" disabled>Select Vehicle</option>
                                    {customerVehicles.map(v => (
                                        <option key={v.id} value={v.id}>{v.model}</option>
                                    ))}
                                    <option value="new" className="font-bold text-black">+ Add New</option>
                                </select>
                             </div>
                        ) : (
                             <div className="relative flex items-center">
                                <input
                                    type="text"
                                    placeholder="Vehicle (Optional)"
                                    value={vehicleInput}
                                    disabled={mobileInput.length !== 10}
                                    onChange={(e) => setVehicleInput(e.target.value)}
                                     className="w-full bg-transparent border-b border-zinc-200 py-1.5 text-sm outline-none placeholder:text-zinc-300 placeholder:uppercase placeholder:tracking-wider focus:border-black transition-colors focus:placeholder-transparent disabled:opacity-30 disabled:cursor-not-allowed uppercase pr-6"
                                />
                                {customerVehicles.length > 0 && (
                                     <button 
                                        onClick={() => setIsVehicleSelect(true)}
                                        className="absolute right-0 text-xs text-zinc-400 hover:text-black uppercase tracking-wider"
                                     >
                                        Cancel
                                     </button>
                                )}
                             </div>
                        )}
                    </div>
                 </div>
            </div>
             <div className="w-full h-px bg-zinc-200" />
            <div className="flex justify-between items-baseline my-4">
                <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">Job By</span>
                <Popover open={employeePopoverOpen} onOpenChange={setEmployeePopoverOpen} modal={true}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="link"
                      role="combobox"
                      aria-expanded={employeePopoverOpen}
                      className="p-0 h-auto text-sm text-zinc-400 hover:text-black focus:text-black w-[180px] justify-between text-left"
                    >
                      <span className="truncate">
                        {selectedEmployees.length > 0 
                            ? selectedEmployees.map(e => e.name).join(", ") 
                            : "Select Employees"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0" align="start">
                    <div className="p-2">
                      <Input 
                        placeholder="Search employee..." 
                        className="h-8 mb-2 focus-visible:ring-0 focus-visible:ring-offset-0 border-zinc-200" 
                        value={employeeSearchQuery}
                        onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                        autoFocus
                      />
                      <div className="max-h-[200px] overflow-y-auto space-y-1">
                        {employees
                            ?.filter(e => e.name.toLowerCase().includes(employeeSearchQuery.toLowerCase()))
                            .map((employee) => {
                                const isSelected = selectedEmployees.some(e => e.id === employee.id);
                                return (
                                   <div
                                      key={employee.id}
                                      className={cn(
                                        "flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm cursor-pointer hover:bg-zinc-100 transition-colors",
                                        isSelected && "bg-zinc-50"
                                      )}
                                      onClick={() => {
                                        setSelectedEmployees(prev => {
                                            const exists = prev.some(e => e.id === employee.id);
                                            if (exists) {
                                                return prev.filter(e => e.id !== employee.id);
                                            } else {
                                                return [...prev, employee];
                                            }
                                        });
                                        // setEmployeePopoverOpen(false); // Creating multi-select, so keep open
                                        // setEmployeeSearchQuery(''); // Keep search query for multiple additions
                                      }}
                                   >
                                      <div className={cn(
                                          "h-4 w-4 border border-zinc-300 rounded-sm flex items-center justify-center transition-colors",
                                          isSelected ? "bg-black border-black text-white" : "bg-white"
                                      )}>
                                          {isSelected && <Check className="h-3 w-3" />}
                                      </div>
                                      {employee.name}
                                   </div>
                                );
                            })}
                         {employees?.filter(e => e.name.toLowerCase().includes(employeeSearchQuery.toLowerCase())).length === 0 && (
                            <div className="text-xs text-center text-zinc-400 py-4">No employees found</div>
                         )}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
            </div>
            <div className="w-full h-px bg-zinc-900" />
        </div>
        
        <CartTotals 
          cart={cart}
          customNameInputRef={customNameInputRef}
          onUpdateCartItem={updateCartItem}
          onRemoveFromCart={removeFromCart}
          onAddCustomJob={addCustomJob}
          formatPrice={formatPrice}
          globalDiscountPercent={globalDiscountPercent}
          setGlobalDiscountPercent={setGlobalDiscountPercent}
          totals={totals}
          onProcessPayment={handleProcessPayment}
          isProcessButtonDisabled={cart.length === 0 || (!selectedCustomer && (mobileInput.length !== 10 || !nameInput.trim())) || selectedEmployees.length === 0}
        />
        
        {/* SMS Notification Checkbox */}
        <div className="flex items-center gap-2 px-1 py-2">
          <Checkbox 
            id="sms-notification" 
            checked={sendSmsNotification}
            onCheckedChange={(checked) => setSendSmsNotification(checked === true)}
          />
          <label 
            htmlFor="sms-notification" 
            className="text-xs text-zinc-600 cursor-pointer flex items-center gap-1.5"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Send SMS notification to customer
          </label>
        </div>
          <PaymentDialog
            isOpen={isPaymentDialogOpen}
            onOpenChange={setPaymentDialogOpen}
            totalAmount={totals.total}
            onConfirmPayment={handleConfirmPayment}
            isProcessing={isProcessing}
          />
          <InvoiceDetailsDialog 
            invoice={lastInvoice} 
            isOpen={showInvoiceDialog} 
            onOpenChange={setShowInvoiceDialog}
            receiptOnOpen={true}
          />
      </div>
    </div>
  );
}

