'use client';

import { useState, useEffect } from 'react';

import { SmsCampaignForm } from '@/components/sms/SmsCampaignForm';
import { SmsHistoryTable } from '@/components/sms/SmsHistoryTable';
import { Separator } from '@/components/ui/separator';
import { Signal } from 'lucide-react';

export default function SmsPage() {
  return (
    <div className="relative z-10 w-full max-w-7xl mx-auto px-12 pt-8 pb-12">
      {/* HEADER */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-5xl font-light tracking-tighter mb-2">SMS GATEWAY</h1>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Manage Communications</p>
        </div>
        <div className="flex items-center gap-4">
             <div className="bg-green-50 text-green-700 px-4 py-2 rounded-full flex items-center gap-2 border border-green-200">
                <Signal className="h-4 w-4" />
                <span className="text-sm font-medium">Gateway Active</span>
             </div>
        </div>
      </div>

      <Separator className="mb-8" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT COLUMN: SEND FORM */}
        <div className="lg:col-span-1">
           <SmsCampaignForm />
        </div>

        {/* RIGHT COLUMN: HISTORY */}
        <div className="lg:col-span-2">
            <SmsHistoryTable />
        </div>
      </div>
    </div>
  );
}
