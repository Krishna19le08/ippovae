import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }) {
  return <div data-slot="skeleton" className={cn("animate-pulse rounded-md bg-slate-100 motion-reduce:animate-none", className)} {...props} />
}

export { Skeleton }
