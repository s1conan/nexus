"use client"

import * as React from "react"
import { Check, ChevronRight } from "lucide-react"
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

export interface SearchColumn<T> {
  key: keyof T
  header: string
  className: string // Made required to enforce explicit widths
  primary?: boolean
}

interface LiveSearchProps<T> {
  data: T[]
  value: string
  onSelect: (value: string) => void
  keyField: keyof T
  displayField: keyof T | ((item: T) => string)
  searchColumns: (keyof T)[]
  visualColumns?: SearchColumn<T>[]
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  className?: string
  disabled?: boolean
}

export function LiveSearch<T extends Record<string, any>>({
  data,
  value,
  onSelect,
  keyField,
  displayField,
  searchColumns,
  visualColumns,
  placeholder = "Select item...",
  searchPlaceholder = "Search...",
  emptyMessage = "No items found.",
  className,
  disabled = false,
}: LiveSearchProps<T>) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")

  const selectedItem = data.find((item) => String(item[keyField]) === value)

  const getDisplayText = (item: T) => {
    if (typeof displayField === 'function') {
      return displayField(item)
    }
    return String(item[displayField] || "")
  }

  // Multi-column search logic
  const filteredData = React.useMemo(() => {
    if (!searchQuery) return data
    const lowerQuery = searchQuery.toLowerCase()
    
    return data.filter((item) => {
      // Return true if ANY of the specified search columns contain the query
      return searchColumns.some((col) => {
        const val = item[col]
        return val !== null && val !== undefined && String(val).toLowerCase().includes(lowerQuery)
      })
    })
  }, [data, searchQuery, searchColumns])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
          disabled={disabled}
        >
          <span className="truncate">
            {selectedItem ? getDisplayText(selectedItem) : placeholder}
          </span>
          <ChevronRight className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[var(--radix-popover-trigger-width)] p-0" 
        align="start"
      >
        {/* We disable cmdk's internal filter so we can use our multi-column filteredData */}
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder={searchPlaceholder} 
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {/* Optional multi-column visual header */}
              {visualColumns && filteredData.length > 0 && (
                <div className="flex px-2 py-1.5 text-[10px] uppercase font-bold text-muted-foreground border-b mb-1 gap-2 w-full">
                  <div className="size-4 shrink-0" /> {/* Space for checkmark */}
                  {visualColumns.map((col) => (
                    <div key={String(col.key)} className={cn("truncate", col.className, col.primary ? "" : "")}>
                      {col.header}
                    </div>
                  ))}
                </div>
              )}
              
              {filteredData.map((item) => {
                const itemValue = String(item[keyField])
                const isSelected = value === itemValue
                
                return (
                  <CommandItem
                    key={itemValue}
                    value={itemValue}
                    onSelect={() => {
                      onSelect(isSelected ? "" : itemValue)
                      setOpen(false)
                      setSearchQuery("") // Reset search on select
                    }}
                    className="flex items-center gap-2 w-full"
                  >
                    <Check
                      className={cn(
                        "size-4 shrink-0",
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
