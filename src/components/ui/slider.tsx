"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

interface SliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  trackHeight?: string
  thumbSize?: string
  // The thumb carries role="slider", so the name and the description go on it
  thumbLabel?: string
  thumbDescribedBy?: string
  // What a screen reader says for the value, with its unit, instead of the raw number
  thumbValueText?: string
  thumbKeyShortcuts?: string
  rangeClassName?: string
  rangeStyle?: React.CSSProperties
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, trackHeight = "h-1", thumbSize = "h-4 w-4", thumbLabel, thumbDescribedBy, thumbValueText, thumbKeyShortcuts, rangeClassName, rangeStyle, ...props }, ref) => {
  return (
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
        <SliderPrimitive.Range className={cn("absolute h-full bg-neon-cyan", rangeClassName)} style={rangeStyle} />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={thumbLabel}
        aria-describedby={thumbDescribedBy}
        aria-valuetext={thumbValueText}
        aria-keyshortcuts={thumbKeyShortcuts}
        className={cn(
          "block rounded-full bg-neon-cyan transition-all focus-visible:outline-none focus-visible:ring-0 disabled:pointer-events-none disabled:opacity-50 cursor-pointer shadow-[0_0_10px_theme(colors.neon-cyan)] hover:shadow-[0_0_15px_theme(colors.neon-cyan)]",
          thumbSize
        )}
      />
    </SliderPrimitive.Root>
  )
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
export type { SliderProps }
