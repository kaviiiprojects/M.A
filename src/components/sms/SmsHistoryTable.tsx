'use client';

import { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { History, CheckCircle2, XCircle, Clock, Loader2, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

type SmsLog = {
    id: string;
    mobile: string;
    message: string;
    status: string;
    createdAt: string;
};

// ... (types)

export function SmsHistoryTable() {
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchLogs = async () => {
    try {
        const res = await fetch('/api/sms/logs');
        if (res.ok) {
            const data = await res.json();
            setLogs(data);
        }
    } catch (e) {
        console.error("Failed to fetch logs", e);
    } finally {
        setLoading(false);
    }
  };

  const handleClearHistory = async () => {
      if (!confirm("Are you sure you want to clear the entire SMS history? This cannot be undone.")) {
          return;
      }

      try {
          const res = await fetch('/api/sms/logs', { method: 'DELETE' });
          if (res.ok) {
              toast({ title: "History Cleared", description: "All SMS logs have been deleted." });
              setLogs([]);
          } else {
              throw new Error("Failed to clear");
          }
      } catch (e) {
          toast({ variant: "destructive", title: "Error", description: "Could not clear history." });
      }
  };

  useEffect(() => {
    fetchLogs();
    
    // Listen for new SMS sent events to auto-refresh
    const handleRefresh = () => fetchLogs();
    window.addEventListener('sms-sent', handleRefresh);
    return () => window.removeEventListener('sms-sent', handleRefresh);
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DELIVERED': return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" /> Delivered</Badge>;
      case 'SENT': return <Badge className="bg-blue-500 hover:bg-blue-600"><Clock className="w-3 h-3 mr-1" /> Sent</Badge>;
      case 'FAILED': return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
      default: return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" /> Recent History
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={handleClearHistory} title="Clear History">
            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin h-6 w-6 text-zinc-400" /></div>
        ) : (
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead>Mobile</TableHead>
                <TableHead className="w-[40%]">Message</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Time</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {logs.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">No SMS history found.</TableCell>
                    </TableRow>
                ) : logs.map((log) => (
                <TableRow key={log.id}>
                    <TableCell className="font-mono">{log.mobile}</TableCell>
                    <TableCell className="truncate max-w-[200px]" title={log.message}>{log.message}</TableCell>
                    <TableCell>{getStatusBadge(log.status)}</TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                        {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                    </TableCell>
                </TableRow>
                ))}
            </TableBody>
            </Table>
        )}
      </CardContent>
    </Card>
  );
}
