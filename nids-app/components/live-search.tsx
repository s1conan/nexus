"use client"

import * as React from "react"
import { Check, ChevronRight, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useDebounce } from "@/hooks/use-debounce"

export interface SearchColumn<T> {
  key: keyof T
  header: string
  className: string // Made required to enforce explicit widths
  primary?: boolean
}

interface LiveSearchProps<T> {
  data?: T[] // Fallback static data or context for the selected item
  fetchData?: (query: string) => Promise<T[]> // Async fetch function
  value: string
  onSelect: (value: string, item?: T) => void
  keyField: keyof T
  displayField: keyof T | ((item: T) => string)
  searchColumns?: (keyof T)[] // Optional if fetchData handles the search logic entirely
  visualColumns?: SearchColumn<T>[]
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  className?: string
  disabled?: boolean
  defaultDisplay?: string // Initial text to show before data is fetched/available
}

export function LiveSearch<T extends Record<string, any>>({
  data = [],
  fetchData,
  value,
  onSelect,
  keyField,
  displayField,
  searchColumns = [],
  visualColumns,
  placeholder = "Select item...",
  searchPlaceholder = "Search...",
  emptyMessage = "No items found.",
  className,
  disabled = false,
  defaultDisplay,
}: LiveSearchProps<T>) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [results, setResults] = React.useState<T[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  
  const debouncedQuery = useDebounce(searchQuery, 300)

  // Store latest fetchData to avoid infinite loops from inline functions in parents
  const fetchRef = React.useRef(fetchData)
  React.useEffect(() => {
    fetchRef.current = fetchData
  }, [fetchData])

  // Handle dynamic fetching immediately on mount and query change
  React.useEffect(() => {
    if (fetchRef.current) {
      let isMounted = true
      setIsLoading(true)
      
      fetchRef.current(debouncedQuery)
        .then(res => {
          if (isMounted) {
            setResults(res)
          }
        })
        .catch(err => {
          console.error("LiveSearch fetch error:", err)
        })
        .finally(() => {
          if (isMounted) {
            setIsLoading(false)
          }
        })
        
      return () => { isMounted = false }
    }
  }, [debouncedQuery])

  // Combine static data and fetched results to find the currently selected item
  const allKnownItems = React.useMemo(() => {
    const map = new Map<string, T>()
    data.forEach(item => map.set(String(item[keyField]), item))
    results.forEach(item => map.set(String(item[keyField]), item))
    return Array.from(map.values())
  }, [data, results, keyField])

  const selectedItem = allKnownItems.find((item) => String(item[keyField]) === value)

  const getDisplayText = (item: T) => {
    if (!item) return ""
    if (typeof displayField === 'function') {
      return displayField(item)
    }
    return String(item[displayField] || "")
  }

  // Multi-column search logic OR simple top-8 slice
  const displayData = React.useMemo(() => {
    if (fetchData) {
      // If fetching dynamically, just return the top 8 results returned by the API
      return results.slice(0, 8)
    }

    // Static fallback
    if (!searchQuery) return data.slice(0, 8)
    const words = searchQuery.toLowerCase().split(/\s+/).filter(Boolean)
    if (words.length === 0) return data.slice(0, 8)
    
    return data.filter((item) => {
      // Return true if ANY column contains ALL words
      return searchColumns.some((col) => {
        const val = String(item[col] || "").toLowerCase()
        return words.every(word => val.includes(word))
      })
    }).slice(0, 8)
  }, [data, results, searchQuery, searchColumns, fetchData])

  const triggerText = React.useMemo(() => {
    if (selectedItem) return getDisplayText(selectedItem)
    if (value && defaultDisplay) return defaultDisplay
    return placeholder
  }, [selectedItem, value, defaultDisplay, placeholder])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal bg-background hover:bg-background/80 transition-colors", className)}
          disabled={disabled}
        >
          <span className="truncate">
            {triggerText}
          </span>
          <ChevronRight className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[var(--radix-popover-trigger-width)] p-0 border shadow-lg" 
        align="start"
      >
        <Command shouldFilter={false}>
          <div className="relative">
            <CommandInput 
              placeholder={searchPlaceholder} 
              value={searchQuery}
              onValueChange={setSearchQuery}
              className="border-none focus:ring-0"
              onKeyDownCapture={(e) => {
                // Prevent cmdk from hijacking Home and End keys for native user input
                if ((e.key === "Home" || e.key === "End") && e.isTrusted) {
                  e.stopPropagation()
                }
                
                // Map PageUp and PageDown to cmdk's Home and End behaviors
                if (e.key === "PageUp" || e.key === "PageDown") {
                  e.preventDefault()
                  e.stopPropagation()
                  const event = new KeyboardEvent("keydown", {
                    key: e.key === "PageUp" ? "Home" : "End",
                    code: e.key === "PageUp" ? "Home" : "End",
                    bubbles: true,
                    cancelable: true,
                  })
                  e.currentTarget.dispatchEvent(event)
                }
              }}
            />
            {isLoading && (
              <Loader2 className="absolute right-3 top-3 size-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <CommandList className="max-h-[300px] overflow-y-auto">
            {!isLoading && displayData.length === 0 && (
              <CommandEmpty className="py-4 text-sm text-center text-muted-foreground">{emptyMessage}</CommandEmpty>
            )}
            <CommandGroup>
              {/* Optional multi-column visual header */}
              {visualColumns && displayData.length > 0 && (
                <div className="flex px-2 py-1.5 text-[10px] uppercase font-bold text-muted-foreground border-b mb-1 gap-2 w-full">
                  <div className="size-4 shrink-0" /> {/* Space for checkmark */}
                  {visualColumns.map((col) => (
                    <div key={String(col.key)} className={cn("truncate", col.className, col.primary ? "" : "")}>
                      {col.header}
                    </div>
                  ))}
                </div>
              )}
              
              {displayData.map((item) => {
                const itemValue = String(item[keyField])
                const isSelected = value === itemValue
                
                return (
                  <CommandItem
                    key={itemValue}
                    value={itemValue}
                    onSelect={() => {
                      onSelect(itemValue, item)
                      setOpen(false)
                      setSearchQuery("") // Reset search on select
                    }}
                    className="flex items-center gap-2 w-full cursor-pointer aria-selected:bg-primary/5"
                  >
                    <Check
                      className={cn(
                        "size-4 shrink-0 text-primary",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    
                    {/* Render visual columns OR fallback to simple display field */}
                    {visualColumns ? (
                      visualColumns.map((col) => (
                        <div 
                          key={String(col.key)} 
                          className={cn(
                            "truncate", 
                            col.className,
                            col.primary ? "font-medium" : "text-muted-foreground"
                          )}
                        >
                          {String(item[col.key] || "-")}
                        </div>
                      ))
                    ) : (
                      <span className="truncate flex-1">{getDisplayText(item)}</span>
                    )}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}