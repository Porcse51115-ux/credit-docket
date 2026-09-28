import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * cn — merge Tailwind classnames intelligently.
 * Handles conflict resolution (e.g. `cn("px-2", "px-4")` returns `"px-4"`)
 * and falsy filtering. Every shadcn component uses this.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
