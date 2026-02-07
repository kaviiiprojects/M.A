'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';

import StatCard from "@/components/dashboard/StatCard";
import RevenueChart from "@/components/dashboard/RevenueChart";
import LowStockItems from "@/components/dashboard/LowStockItems";
import RecentInvoices from "@/components/dashboard/RecentInvoices";
import { DollarSign, Archive, Users, BarChart } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import type { RevenueData } from '@/lib/data';
import { cn } from '@/lib/utils';

// --- Types for API Response ---
type Stat = {
  title: string;
  value: string;
  icon: 'DollarSign' | 'Archive' | 'Users' | 'BarChart'; // Use string literal for icon name
};

type RecentInvoice = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  date: number;
  total: number;
  paymentStatus: 'Paid' | 'Partial' | 'Unpaid';
};

type LowStockItem = {
    id: string;
    name: string;
    stock: number;
    stockThreshold: number;
};

type DashboardData = {
  stats: Stat[];
  revenueData: RevenueData[];
  lowStockItems: LowStockItem[];
  recentInvoices: RecentInvoice[];
};

const iconMap = {
  DollarSign,
  Archive,
  Users,
  BarChart,
};


export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = useCallback(async (signal: AbortSignal) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/dashboard', { signal });
      if (!res.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      const dashboardData = await res.json();
      setData(dashboardData);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not load dashboard data.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);


  const renderStatSkeletons = () => (
    Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="bg-background p-8">
        <div className="flex flex-row items-center justify-between space-y-0 pb-4">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-5 w-5 rounded-sm" />
        </div>
        <div>
          <Skeleton className="h-8 w-1/2" />
        </div>
      </div>
    ))
  );

  return (
    <div className="relative z-10 w-full max-w-7xl mx-auto px-12 pt-8 pb-12">
        
      {/* --- HEADER --- */}
      <div className="flex justify-between items-start mb-16 gap-8">
        <div>
          <h1 className="text-5xl font-light tracking-tighter mb-2">DASHBOARD</h1>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Today's snapshot & vital metrics</p>
        </div>
      </div>
      
      {/* --- STATS GRID --- */}
      <div className="grid grid-cols-4 gap-6"> 
        {isLoading || !data ? renderStatSkeletons() : data.stats.map((stat, i) => (
          <StatCard 
            key={stat.title} 
            title={stat.title} 
            value={stat.value} 
            icon={iconMap[stat.icon]} 
            variant={i === 0 ? 'dark' : 'default'} // First card (Revenue) is dark
            className={cn(
                "rounded-2xl transition-all duration-300 cursor-pointer border border-transparent",
                i === 0 
                  ? "shadow-2xl hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)] scale-105 z-10 hover:scale-110" 
                  : "bg-white shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-zinc-100"
            )}
          />
        ))}
      </div>
      
      {/* --- CHARTS & LISTS --- */}
      <div className="grid grid-cols-3 gap-8 mt-10">
        <div className="col-span-2 bg-white p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-shadow duration-500">
          {isLoading || !data ? <Skeleton className="h-[250px] w-full" /> : <RevenueChart data={data.revenueData} />}
        </div>
        <div className="bg-white p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-shadow duration-500 h-[400px] overflow-hidden">
          {isLoading || !data ? <Skeleton className="h-[250px] w-full" /> : <LowStockItems data={data.lowStockItems} />}
        </div>
      </div>
      <div className="mt-10">
        <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden p-1">
             {isLoading || !data ? <Skeleton className="h-[300px] w-full" /> : <RecentInvoices data={data.recentInvoices} />}
        </div>
      </div>
    </div>
  );
}
