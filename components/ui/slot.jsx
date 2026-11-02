import * as React from "react"

// Renders its single child element in place of a wrapper, passing its own props onto it (the `asChild` pattern).
// Merge rules match the Radix Slot it replaces: className is joined, style is merged, and event handlers are
// composed (child first, then slot). Every other prop on the child wins over the slot's.
function mergeProps(slotProps, childProps) {
  const merged = { ...slotProps, ...childProps }
  for (const key in childProps) {
    const slotValue = slotProps[key]
    const childValue = childProps[key]
    if (/^on[A-Z]/.test(key) && typeof slotValue === "function" && typeof childValue === "function") {
      merged[key] = (...args) => {
        childValue(...args)
        slotValue(...args)
      }
    } else if (key === "style") {
      merged[key] = { ...slotValue, ...childValue }
    } else if (key === "className") {
      merged[key] = [slotValue, childValue].filter(Boolean).join(" ")
    }
  }
  return merged
}

function Slot({ children, ...slotProps }) {
  const child = React.Children.only(children)
  if (!React.isValidElement(child)) return null
  return React.cloneElement(child, mergeProps(slotProps, child.props))
}

export { Slot }
