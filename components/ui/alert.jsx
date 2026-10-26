import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

// shadcn/ui Alert (new-york). "info" is the lime-tint note; "destructive" is for errors.
const alertVariants = cva(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "border-border bg-card text-card-foreground",
        info: "border-foreground/15 bg-accent text-foreground [&>svg]:text-foreground",
        success: "border-green-300 bg-[#dcfce7] text-[#166534] [&>svg]:text-[#166534]",
        warning: "border-[#d97706] bg-[#fef3c7] text-[#92400e] [&>svg]:text-[#92400e]",
        destructive: "border-red-200 bg-red-50 text-red-800 [&>svg]:text-red-700",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

// role defaults to "alert"; pass role="note" (or role="status") for a message that should not interrupt
function Alert({ className, variant, role = "alert", ...props }) {
  return <div data-slot="alert" role={role} className={cn(alertVariants({ variant }), className)} {...props} />
}
function AlertTitle({ className, ...props }) {
  return <div data-slot="alert-title" className={cn("col-start-2 min-h-4 font-semibold tracking-tight", className)} {...props} />
}
function AlertDescription({ className, ...props }) {
  return <div data-slot="alert-description" className={cn("col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed", className)} {...props} />
}

export { Alert, AlertDescription, AlertTitle }
