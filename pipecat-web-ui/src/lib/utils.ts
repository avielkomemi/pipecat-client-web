import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatLatency(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`
  }
  return `${(ms / 1000).toFixed(1)}s`
}

export function getLatencyColor(ms: number): string {
  if (ms < 100) return "bg-green-500"
  if (ms < 300) return "bg-yellow-500"
  return "bg-red-500"
}