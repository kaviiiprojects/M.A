
import type { Metadata } from "next";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";
import { Inter } from "next/font/google";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import { DesktopOnlyWrapper } from "@/components/DesktopOnlyWrapper";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Mahesh Auto accessories",
  description: "Mahesh Auto accessories managment system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased bg-noise`}>
          <DesktopOnlyWrapper>
            <SidebarProvider defaultOpen={true}>
              <div className="flex min-h-screen w-full">
                <DashboardSidebar />
                <SidebarInset>
                  <div className="flex-1 flex flex-col">
                    {children}
                  </div>
                </SidebarInset>
              </div>
            </SidebarProvider>
          </DesktopOnlyWrapper>
        <Toaster />
      </body>
    </html>
  );
}
