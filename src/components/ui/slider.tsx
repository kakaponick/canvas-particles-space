"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

interface SliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  trackHeight?: string
  thumbSize?: string
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, trackHeight = "h-1", thumbSize = "h-4 w-4", ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center",
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track className={cn(
      "relative w-full grow overflow-hidden rounded-sm bg-[rgba(255,255,255,0.1)]",
      trackHeight
    )}>
      <SliderPrimitive.Range className="absolute h-full bg-[#00ffff]" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className={cn(
      "block rounded-full bg-[#00ffff] transition-all focus-visible:outline-none focus-visible:ring-0 disabled:pointer-events-none disabled:opacity-50 cursor-pointer shadow-[0_0_10px_#00ffff] hover:shadow-[0_0_15px_#00ffff]",
      thumbSize
    )} />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
export type { SliderProps }
