
'use client';

import { usePathname } from 'next/navigation';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Wrench,
  LayoutDashboard,
  Package,
  ShoppingCart,
  LogOut,
  Users,
  Car,
  FileText,
  BarChart2,
  ChevronDown,
  ChevronsRight,
  PanelLeftClose,
  MessageSquare
} from 'lucide-react';
import Link from 'next/link';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from '@/components/AuthProvider';
import type { UserRole } from '@/lib/auth';

// All menu items with role restrictions
const allMenuItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin'] as UserRole[] },
  { href: '/pos', label: 'POS', icon: ShoppingCart, roles: ['admin', 'user'] as UserRole[] },
  { href: '/invoices', label: 'Invoices', icon: FileText, roles: ['admin', 'user'] as UserRole[] },
  { href: '/inventory', label: 'Inventory', icon: Package, roles: ['admin', 'user'] as UserRole[] },
  { href: '/customers', label: 'Customers', icon: Car, roles: ['admin', 'user'] as UserRole[] },
  { href: '/employees', label: 'Employees', icon: Users, roles: ['admin'] as UserRole[] },
];

const reportMenuItems = [
    { href: "/reports/profit-loss", label: "Profit & Loss" },
    { href: "/reports/day-end", label: "Day End Report" },
    { href: "/reports/stock", label: "Stock Report" },
    { href: "/reports/employee", label: "Employee Report" },
]

export default function DashboardSidebar() {
  const pathname = usePathname();
  const { state, toggleSidebar } = useSidebar();
  const { user, logout } = useAuth();
  const isCollapsed = state === 'collapsed';
  
  const isReportsActive = reportMenuItems.some(item => pathname === item.href);
  const isSmsActive = pathname === '/sms';
  
  // Filter menu items based on user role
  const menuItems = allMenuItems.filter(item => 
    user && item.roles.includes(user.role)
  );
  
  // Only admin can see reports
  const canSeeReports = user?.role === 'admin';

  const handleLogout = () => {
    logout();
  };

  return (
    <Sidebar
      variant="inset"
      collapsible="icon"
      className="bg-sidebar-background border-r border-sidebar-border transition-all duration-300 ease-in-out "
    >
      <SidebarHeader className="px-3 py-4 border-b border-sidebar-border h-[56px] flex items-start">
        <div className={cn('flex items-center gap-2', isCollapsed && 'justify-center w-full')}>
          <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Wrench className="h-4 w-4" />
          </div>
          {!isCollapsed && (
            <span className="text-sm font-semibold tracking-tight text-sidebar-foreground whitespace-nowrap">
              MAHESH AUTO
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="p-2 flex-1 ">
        <SidebarMenu className="space-y-1">
          {menuItems.map((item) => {
            const active = pathname === item.href;
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  tooltip={item.label}
                  className={cn(`
                      h-9 rounded-lg text-xs tracking-tight justify-start
                      data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground
                      hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground
                      text-sidebar-foreground/70`,
                      isCollapsed && 'justify-center'
                  )}
                >
                  <Link href={item.href}>
                    <item.icon className="w-4 h-4 shrink-0" />
                    {!isCollapsed && <span>{item.label}</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}


          {/* Reports Dropdown Menu - Admin Only */}
          {canSeeReports && (
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    isActive={isReportsActive}
                    tooltip="Reports"
                    className={cn(`
                        h-9 rounded-lg text-xs tracking-tight justify-start
                        data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground
                        hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground
                        text-sidebar-foreground/70 `,
                        isCollapsed && "justify-center"
                    )}
                  >
                    <BarChart2 className="w-4 h-4 shrink-0" />
                    {!isCollapsed && (
                      <div className="w-full flex justify-between items-center">
                          <span>Reports</span>
                          <ChevronDown className="w-3 h-3" />
                      </div>
                    )}
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  side={isCollapsed ? "right" : "bottom"} 
                  align={isCollapsed ? "start" : "center"}
                  sideOffset={10}
                  className="bg-sidebar-background border-sidebar-border text-sidebar-foreground rounded-sm w-48 bg-black"
                >
                  {reportMenuItems.map(item => (
                      <DropdownMenuItem key={item.href} asChild>
                          <Link 
                              href={item.href} 
                              className={cn(
                                  "cursor-pointer focus:bg-sidebar-accent focus:text-sidebar-accent-foreground",
                                  pathname === item.href && "bg-sidebar-accent"
                              )}
                          >
                              {item.label}
                          </Link>
                      </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          )}

          <SidebarMenuItem className="mt-10">
            <SidebarMenuButton
              asChild
              isActive={isSmsActive}
              tooltip="SMS Gateway"
              className={cn(`
                  h-9 rounded-lg text-xs tracking-tight justify-start
                  data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground
                  hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground
                  text-sidebar-foreground/70`,
                  isCollapsed && 'justify-center'
              )}
            >
              <Link href="/sms">
                <MessageSquare className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>SMS Gateway</span>}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-2 border-t border-sidebar-border space-y-1">
        <div className={cn(
          'flex items-center gap-2 p-2 rounded-lg hover:bg-sidebar-accent',
           isCollapsed && 'justify-center'
        )}>
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-xs">
              {user?.username.charAt(0).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>

          {!isCollapsed && (
            <div className="leading-tight text-sidebar-foreground whitespace-nowrap">
              <span className="text-xs font-medium capitalize">{user?.username || 'User'}</span>
              <span className="block text-[10px] text-sidebar-foreground/60 capitalize">
                {user?.role || 'Guest'}
              </span>
            </div>
          )}
        </div>

        <SidebarMenuButton
          onClick={handleLogout}
          tooltip={isCollapsed ? "Log Out" : undefined}
          className={cn(
            'h-9 rounded-lg text-xs text-sidebar-foreground/70 hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground justify-start',
            isCollapsed && 'justify-center'
          )}
        >
          <LogOut className="w-4 h-4" />
          {!isCollapsed && <span>Log Out</span>}
        </SidebarMenuButton>

        {/* Toggle Expand/Collapse Button */}
        <SidebarMenuButton
          tooltip={isCollapsed ? "Expand Sidebar" : undefined}
          onClick={toggleSidebar}
          className={cn(
            'h-9 rounded-lg text-xs text-sidebar-foreground/70 hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground justify-start',
            isCollapsed && 'justify-center'
          )}
        >
          {isCollapsed ? (
            <ChevronsRight className="w-4 h-4" />
          ) : (
            <>
              <PanelLeftClose className="w-4 h-4" />
              <span>Collapse</span>
            </>
          )}
        </SidebarMenuButton>
      </SidebarFooter>
    </Sidebar>
  );
}
