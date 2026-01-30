'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Wrench, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim() || !password.trim()) {
      toast({
        variant: 'destructive',
        title: 'Missing Credentials',
        description: 'Please enter both username and password.',
      });
      return;
    }

    setIsLoading(true);
    
    // Small delay for UX
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const success = login(username, password);
    
    if (!success) {
      toast({
        variant: 'destructive',
        title: 'Invalid Credentials',
        description: 'Username or password is incorrect.',
      });
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/login-bg.png')" }}
      />
      
      {/* Dark Overlay for better contrast */}
      <div className="absolute inset-0 bg-black/40" />
      
      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl shadow-2xl p-8">
          
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 mb-4">
              <Wrench className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">MAHESH AUTO</h1>
            <p className="text-xs uppercase tracking-[0.2em] text-white/60 mt-1">
              Management System
            </p>
          </div>
          
          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-xs uppercase tracking-wider text-white/70">
                Username
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/20"
                autoComplete="username"
                autoFocus
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs uppercase tracking-wider text-white/70">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/20"
                autoComplete="current-password"
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full h-12 bg-white text-black hover:bg-white/90 font-semibold tracking-wide transition-all duration-300 hover:shadow-lg hover:shadow-white/20"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
          
          <p className="mt-6 text-center text-xs text-white/40">
            Internal Use Only
          </p>
        </div>
      </div>
    </div>
  );
}
