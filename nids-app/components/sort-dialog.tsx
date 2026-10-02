"use client"

import * as React from "react"
import { ArrowDownZA, ArrowUpAZ, ArrowUpDown, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useDictionary } from "@/components/dictionary-provider"
import type { SortColumnOption, SortLevel } from "@/hooks/use-table-data"

interface SortDialogProps {
  sortLevels: SortLevel[]
  sortColumns: SortColumnOption[]
  onSortLevelsChange: (levels: SortLevel[]) => void
  disabled?: boolean
}

function createLevelId() {
  return `sort-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Shared multi-level sort dialog used across module pages. Edits are held as a
 * local draft and only committed on "Apply", so the table refetches once per
 * applied change rather than on every select toggle.
 */
export function SortDialog({
  sortLevels,
  sortColumns,
  onSortLevelsChange,
  disabled = false,
}: SortDialogProps) {
  const { dict } = useDictionary()
  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState<SortLevel[]>(sortLevels)

  const handleOpenChange = (next: boolean) => {
    if (next) setDraft(sortLevels)
    setOpen(next)
  }

  const addLevel = () => {
    const first = sortColumns[0]
    setDraft((prev) => [
      ...prev,
      {
        id: createLevelId(),
        column: first?.value ?? "",
        direction: first?.defaultDirection ?? "asc",
      },
    ])
  }

  const removeLevel = (id: string) => {
    setDraft((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.id !== id)))
  }

  const updateLevel = (id: string, field: keyof SortLevel, value: string) => {
    setDraft((prev) =>
      prev.map((l) =>
        l.id === id ? ({ ...l, [field]: value } as SortLevel) : l
      )
    )
  }

  const apply = () => {
    onSortLevelsChange(draft)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          title={dict.LABEL_SORT}
          aria-label={dict.LABEL_SORT}
          disabled={disabled}
          className="md:h-9 md:w-auto md:gap-1.5 md:px-2.5"
        >
          <ArrowUpDown className="size-4" />
          <span className="hidden md:inline">{dict.LABEL_SORT}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{dict.TITLE_SORT_SETTINGS}</DialogTitle>
          <DialogDescription />
        </DialogHeader>
        <div className="flex flex-col gap-4 p-5">
          {draft.map((level, index) => (
            <div key={level.id} className="flex items-center gap-3">
              <div className="w-17 shrink-0 text-sm font-semibold text-muted-foreground">
                {index === 0 ? dict.LABEL_SORT_BY : dict.LABEL_THEN_BY}
              </div>
              <Select
                value={level.column}
                onValueChange={(val) => updateLevel(level.id, "column", val)}
              >
                <SelectTrigger className="h-9 flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortColumns.map((col) => (
                    <SelectItem key={col.value} value={col.value}>
                      {col.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                title={
                  level.direction === "asc"
                    ? dict.LABEL_ASCENDING
                    : dict.LABEL_DESCENDING
                }
                aria-label={
                  level.direction === "asc"
                    ? dict.LABEL_ASCENDING
                    : dict.LABEL_DESCENDING
                }
                onClick={() =>
                  updateLevel(
                    level.id,
                    "direction",
                    level.direction === "asc" ? "desc" : "asc"
                  )
                }
              >
                {level.direction === "asc" ? (
                  <ArrowUpAZ className="size-4" />
                ) : (
                  <ArrowDownZA className="size-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 text-destructive"
                disabled={draft.length <= 1}
                onClick={() => removeLevel(level.id)}
                title={dict.BUTTON_DELETE_LEVEL}
                aria-label={dict.BUTTON_DELETE_LEVEL}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-fit"
            onClick={addLevel}
          >
            <Plus className="mr-2 size-4" />
            {dict.BUTTON_ADD_LEVEL}
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {dict.BUTTON_CANCEL}
          </Button>
          <Button onClick={apply}>{dict.BUTTON_APPLY}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
