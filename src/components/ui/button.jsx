import * as React from "react"
import { cn } from "@/lib/utils"
import { Slot } from "@/components/ui/slot"

const base =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-semibold whitespace-nowrap transition-all active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

const variants = {
  default:
    "btn-fx bg-primary text-primary-foreground border border-ink shadow-[0_6px_16px_-8px_rgb(11_11_11/.35)] hover:bg-lime-hover active:bg-lime-active",
  ink: "bg-ink text-white hover:bg-slate-800",
  destructive:
    "bg-destructive text-white hover:bg-destructive/90 focus-visible:outline-destructive dark:bg-destructive/60",
  outline:
    "border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground",
  secondary:
    "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  ghost:
    "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
  link: "text-foreground underline underline-offset-4",
}

const sizes = {
  default: "h-9 px-4 py-2 has-[>svg]:px-3",
  xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
  sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
  lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
  icon: "size-9",
  "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
  "icon-sm": "size-8",
  "icon-lg": "size-10",
}

function buttonVariants({ variant = "default", size = "default", className } = {}) {
  return cn(base, variants[variant], sizes[size], className)
}

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  )
}

export { Button, buttonVariants }
