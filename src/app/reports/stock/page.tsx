'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { DateRange } from 'react-day-picker';
import { format, startOfDay, endOfDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, Search, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { StockReportItem } from '@/app/api/reports/stock/route';

export default function StockReportPage() {
  const { toast } = useToast();

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfDay(new Date(new Date().setDate(new Date().getDate() - 30))),
    to: endOfDay(new Date()),
  });

  const [reportData, setReportData] = useState<StockReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchReportData = useCallback(async (signal: AbortSignal) => {
    if (!dateRange?.from || !dateRange?.to) return;
    
    setIsLoading(true);
    try {
        const params = new URLSearchParams({
            startDate: format(dateRange.from, 'yyyy-MM-dd'),
            endDate: format(dateRange.to, 'yyyy-MM-dd'),
        });

        const res = await fetch(`/api/reports/stock?${params.toString()}`, { signal });
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Failed to generate report');
        }
        
        setReportData(await res.json());

    } catch (err: any) {
        if (err.name === 'AbortError') return;
        toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
        setIsLoading(false);
    }
  }, [dateRange, toast]);

  useEffect(() => {
    const controller = new AbortController();
    fetchReportData(controller.signal);
    return () => controller.abort();
  }, [fetchReportData]);

  const filteredData = useMemo(() => {
      let items = reportData;

      if (!searchQuery) return items;
      
      const lowercasedQuery = searchQuery.toLowerCase();
      return items.filter(item => 
        item.productName.toLowerCase().includes(lowercasedQuery)
      );
  }, [reportData, searchQuery]);

  const handleExportCSV = () => {
    if (filteredData.length === 0) return;
    
    const headers = ['Product', 'Stock In (Added)', 'Stock Out (Removed)', 'Current Stock'];
    const rows = filteredData.map(item => [
      `"${item.productName.replace(/"/g, '""')}"`,
      item.stockIn,
      item.stockOut,
      item.currentStock,
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stock_report_aggregated_${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
  };

  const renderSkeleton = () => (
    Array.from({ length: 15 }).map((_, i) => (
       <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
    ))
  );

  return (
    <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 pt-8 pb-12">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start mb-8 gap-6">
            <div>
                <h1 className="text-4xl lg:text-5xl font-light tracking-tighter mb-3 text-zinc-900">STOCK MOVEMENT REPORT</h1>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-medium">Aggregated product stock analysis</p>
            </div>
            <div className="flex items-center gap-3 w-full lg:w-auto flex-wrap">
                 <div className="relative group flex-1 lg:flex-none">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <Input
                        type="search"
                        placeholder="SEARCH PRODUCT..."
                        className="w-full lg:w-56 bg-white border-zinc-200 py-2.5 pl-10 text-sm outline-none placeholder:text-zinc-400 focus:border-black transition-colors h-11 rounded-md"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <DateRangePicker dateRange={dateRange} onDateChange={setDateRange} />
                <Button variant="outline" size="icon" onClick={handleExportCSV} disabled={filteredData.length === 0} title="Export CSV">
                    <Download className="h-4 w-4 text-zinc-600" />
                </Button>
            </div>
        </div>

        {/* Report Table */}
        <div className="border border-zinc-200 bg-white shadow-sm rounded-sm">
             <div className="p-4 bg-zinc-50/50 border-b border-zinc-200 flex justify-between items-center">
                 <h3 className="text-xs uppercase tracking-widest font-semibold text-zinc-500">Product Movement Summary</h3>
                 <span className="text-xs text-zinc-400">
                    {dateRange?.from ? format(dateRange.from, 'MMM d, yyyy') : ''} - {dateRange?.to ? format(dateRange.to, 'MMM d, yyyy') : ''}
                 </span>
             </div>
             <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent border-b-zinc-200">
                            <TableHead className="w-[40%]">Product</TableHead>
                            <TableHead className="text-center text-green-700">Stock In (Added)</TableHead>
                            <TableHead className="text-center text-red-700">Stock Out (Removed)</TableHead>
                            <TableHead className="text-center font-bold">Current Stock</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? renderSkeleton() : filteredData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-64 text-center text-zinc-400">
                                    <div className="flex flex-col items-center gap-2">
                                        <AlertTriangle className="h-8 w-8 opacity-20" />
                                        <p className="text-sm uppercase tracking-widest">No stock movement found for these products</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredData.map((item) => (
                                <TableRow key={item.productId} className="border-b-zinc-100">
                                    <TableCell className="font-medium text-zinc-700">{item.productName}</TableCell>
                                    <TableCell className="text-center text-green-600 font-mono">
                                        {item.stockIn > 0 ? `+${item.stockIn}` : '-'}
                                    </TableCell>
                                    <TableCell className="text-center text-red-600 font-mono">
                                        {item.stockOut > 0 ? `-${item.stockOut}` : '-'}
                                    </TableCell>
                                    <TableCell className="text-center font-bold font-mono text-zinc-900">
                                        {item.currentStock}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
             </div>
        </div>
    </div>
  );
}
