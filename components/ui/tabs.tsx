"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"

import { cn } from "@/lib/utils"

function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-4", className)}
      {...props}
    />
  )
}

function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "relative inline-flex items-center gap-0.5 overflow-x-auto rounded-lg border border-border bg-background p-0.5 text-sm",
        className,
      )}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md px-3 py-1 text-sm whitespace-nowrap transition-colors outline-none",
        "text-muted-foreground hover:bg-muted hover:text-foreground",
        "focus-visible:ring-2 focus-visible:ring-ring/40",
        "disabled:pointer-events-none disabled:opacity-50",
        // Selected state: full contrast inversion. Base UI's <Tabs.Tab>
        // marks the active tab with aria-selected="true" rather than a
        // data-selected attribute, so we target that directly here -
        // previously these styles never applied because data-[selected]
        // matched nothing.
        "aria-selected:bg-foreground aria-selected:text-background aria-selected:hover:bg-foreground aria-selected:hover:text-background",
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex flex-col gap-4 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
