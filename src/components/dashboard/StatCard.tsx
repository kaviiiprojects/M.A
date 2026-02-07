
import type { StatCardData } from "@/lib/data";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import React from "react";

export default function StatCard({
  title,
  value,
  icon: Icon,
  change,
  changeType,
  className,
  style,
  variant = 'default'
}: StatCardData & { className?: string, style?: React.CSSProperties, variant?: 'default' | 'dark' }) {
    const isDark = variant === 'dark';

  return (
    <Card className={cn(
        "rounded-none border-0 shadow-none p-8 transition-colors duration-200", 
        isDark ? "bg-black text-white" : "bg-background",
        className
    )} style={style}>
      <CardHeader className="p-0 flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className={cn(
            "text-sm uppercase tracking-widest font-medium",
            isDark ? "text-zinc-400" : "text-zinc-400" // Keep muted for title
        )}>{title}</CardTitle>
        <Icon className={cn("h-5 w-5", isDark ? "text-zinc-500" : "text-zinc-300")} />
      </CardHeader>
      <CardContent className="p-0">
        <div className={cn("text-3xl font-light tracking-tighter", isDark ? "text-white" : "text-foreground")}>{value}</div>
        {change && (
          <p className="text-xs text-zinc-400 mt-2">
            <span className={cn(
              changeType === "increase" && "text-green-600",
              changeType === "decrease" && "text-red-600"
            )}>
              {change}
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
