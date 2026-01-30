'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, Users, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CustomerSelectDialog } from './CustomerSelectDialog';

export function SmsCampaignForm() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  
  // Single SMS State
  const [mobile, setMobile] = useState('');
  const [message, setMessage] = useState('');

  // Bulk State
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [customRecipients, setCustomRecipients] = useState<string[]>([]);

  const handleCustomerSelect = (phone: string | string[], name: string) => {
    if (typeof phone === 'string') {
        setMobile(phone);
    }
  };

  const handleSendSingle = async () => {
    if (!mobile || !message) {
      toast({ variant: "destructive", title: "Error", description: "Mobile and message are required." });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, message, fromFlow: 'Dashboard Manual' })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send SMS");
      }
      
      toast({ title: "SMS Sent", description: "Message has been queued for delivery." });
      setMobile('');
      setMessage('');
      
      window.dispatchEvent(new Event('sms-sent'));

    } catch (error: any) {
       toast({ variant: "destructive", title: "Failed", description: error.message || "Could not send SMS." });
    } finally {
      setLoading(false);
    }
  };

  const handleSendBulk = async () => {
      if (!message) {
          toast({ variant: "destructive", title: "Error", description: "Message is required." });
          return;
      }

      setLoading(true);
      try {
          let recipients: string[] = [];
          
          if (selectedGroup === 'all') {
              // Fetch all customers first
              const res = await fetch('/api/customers?limit=10000'); 
              const customers = await res.json();
              // Extract unique valid phones
              recipients = customers
                .map((c: any) => c.phone)
                .filter((p: string) => p && p.match(/^\d{10}$/));
          } else if (selectedGroup === 'custom') {
              recipients = customRecipients;
          }

          if (recipients.length === 0) {
              throw new Error("No valid recipients found in this group.");
          }

          if (!confirm(`Are you sure you want to send this message to ${recipients.length} customers? Cost will be calculated accordingly.`)) {
             setLoading(false); 
             return;
          }

          // Send to API
          const res = await fetch('/api/sms/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                recipients, 
                message, 
                fromFlow: 'Bulk Dashboard' 
            })
          });

          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.error || "Failed to send Bulk SMS");
          }
          
          toast({ title: "Bulk Campaign Started", description: `Queued ${data.data.length} batches for delivery.` });
          setMessage('');
          
          window.dispatchEvent(new Event('sms-sent'));

      } catch (error: any) {
         toast({ variant: "destructive", title: "Failed", description: error.message || "Could not send Bulk SMS." });
      } finally {
         setLoading(false);
      }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" /> Send SMS
        </CardTitle>
        <CardDescription>Send transactional alerts or marketing campaigns.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="single">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="single">Single Message</TabsTrigger>
            <TabsTrigger value="bulk">Bulk Campaign</TabsTrigger>
          </TabsList>
          
          <TabsContent value="single" className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="mobile">Mobile Number</Label>
              <CustomerSelectDialog 
                currentMobile={mobile} 
                onSelect={handleCustomerSelect} 
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="message">Message</Label>
              <div className="relative">
                <Textarea 
                  id="message" 
                  placeholder="Type your message here..." 
                  className="min-h-[120px] resize-none pr-12"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={160} 
                />
                <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
                  {message.length}/160
                </div>
              </div>
            </div>

            <Button className="w-full" onClick={handleSendSingle} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send Message
            </Button>
          </TabsContent>
          
          <TabsContent value="bulk" className="space-y-4">
            <div className="grid gap-4">
                <div className="flex flex-col space-y-2">
                    <Label>Recipient Group</Label>
                    <div className="flex flex-wrap gap-2">
                         <Button 
                            variant={selectedGroup === 'all' ? 'default' : 'outline'} 
                            onClick={() => { setSelectedGroup('all'); setCustomRecipients([]); }}
                            className="flex-1"
                         >
                            <Users className="mr-2 h-4 w-4" /> All Customers
                         </Button>
                         
                         {selectedGroup === 'custom' ? (
                            <div className="flex-1">
                                <CustomerSelectDialog 
                                    onSelect={(phones) => {
                                        if (Array.isArray(phones)) {
                                            setCustomRecipients(phones);
                                        }
                                    }}
                                    currentMobile=""
                                    multiSelect={true} 
                                />
                            </div>
                         ) : (
                            <Button 
                                variant="outline" 
                                onClick={() => setSelectedGroup('custom')}
                                className="flex-1"
                            >
                                Custom List
                            </Button>
                         )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {selectedGroup === 'all' && "Will fetch and send to all registered customers."}
                        {selectedGroup === 'custom' && (customRecipients.length > 0 ? `Selected ${customRecipients.length} recipients.` : "Please select customers.")}
                    </p>
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="bulk-message">Campaign Message</Label>
                    <div className="relative">
                        <Textarea 
                            id="bulk-message" 
                            placeholder="Type your campaign message here..." 
                            className="min-h-[120px] resize-none pr-12"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            maxLength={160} 
                        />
                        <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
                            {message.length}/160
                        </div>
                    </div>
                </div>

                <Button className="w-full" onClick={handleSendBulk} disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Send Bulk Campaign
                </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
