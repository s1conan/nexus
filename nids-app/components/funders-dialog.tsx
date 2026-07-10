"use client"

import { useState, useEffect, useMemo } from "react"
import { useDictionary } from "@/components/dictionary-provider"
import { SITE_CONFIG } from "@/lib/site-content"
import { createClient } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { LiveSearch } from "@/components/live-search"
import { NumberInput } from "@/components/number-input"
import { X, Plus, Users } from "lucide-react"

export interface FunderEntry {
  funder_id: string
  funder_name: string
  amount: number
}

interface FundersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  totalAmount: number
  funders: FunderEntry[]
  onFundersChange: (funders: FunderEntry[]) => void
}

interface FunderOption {
  id: string
  name: string
}

export function FundersDialog({
  open,
  onOpenChange,
  totalAmount,
  funders,
  onFundersChange,
}: FundersDialogProps) {
  const { dict } = useDictionary()
  const supabase = createClient()

  const [companyName, setCompanyName] = useState<string>("")
  const [selectedFunder, setSelectedFunder] = useState<FunderOption | null>(null)
  const [funderAmount, setFunderAmount] = useState<number>(0)

  // Fetch company name from app_settings
  useEffect(() => {
    const fetchCompanyName = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("category", "company")
        .eq("name", "company_name")
        .single()

      if (data?.value) {
        setCompanyName(data.value)
      }
    }

    if (open) {
      fetchCompanyName()
    }
  }, [open, supabase])

  // Calculate totals
  const totalFundersAmount = useMemo(() => {
    return funders.reduce((sum, f) => sum + f.amount, 0)
  }, [funders])

  const remainingAmount = useMemo(() => {
    return Math.max(0, totalAmount - totalFundersAmount)
  }, [totalAmount, totalFundersAmount])

  const companyContribution = useMemo(() => {
    return Math.max(0, totalAmount - totalFundersAmount)
  }, [totalAmount, totalFundersAmount])

  // Get existing funder IDs to filter out duplicates
  const existingFunderIds = useMemo(() => {
    return new Set(funders.map((f) => f.funder_id))
  }, [funders])

  // Check if a funder is already added
  const isFunderAdded = (funderId: string) => existingFunderIds.has(funderId)

  // Handle funder selection
  const handleFunderSelect = (value: string, item?: FunderOption) => {
    if (item && isFunderAdded(item.id)) {
      // Funder already added, show feedback
      return
    }
    setSelectedFunder(item || null)
    setFunderAmount(remainingAmount > 0 ? remainingAmount : 0)
  }

  // Add funder to list
  const handleAddFunder = () => {
    if (!selectedFunder || funderAmount <= 0) return

    // Check if amount exceeds remaining
    if (funderAmount > remainingAmount) {
      setFunderAmount(remainingAmount)
      return
    }

    const newFunder: FunderEntry = {
      funder_id: selectedFunder.id,
      funder_name: selectedFunder.name,
      amount: funderAmount,
    }

    onFundersChange([...funders, newFunder])
    setSelectedFunder(null)
    setFunderAmount(0)
  }

  // Remove funder from list
  const handleRemoveFunder = (funderId: string) => {
    onFundersChange(funders.filter((f) => f.funder_id !== funderId))
  }

  // Handle amount change with validation
  const handleAmountChange = (value: number) => {
    if (totalAmount > 0 && value > remainingAmount) {
      setFunderAmount(remainingAmount)
    } else {
      setFunderAmount(value)
    }
  }

  // Reset internal state when dialog opens via key remounting
  const dialogKey = open ? "open" : "closed"

  return (
    <Dialog open={open} onOpenChange={onOpenChange} key={dialogKey}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            <Users className="mr-2 inline-block size-5" />
            {dict.LABEL_MANAGE_FUNDERS || "Manage Funders"}
          </DialogTitle>
          <DialogDescription />
        </DialogHeader>

        <div className="relative flex w-full flex-col gap-6 p-5">
          {/* Company Header */}
          <div className="rounded-lg border bg-primary/5 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {dict.LABEL_COMPANY_NAME || "Company"}
              </span>
              <span className="font-semibold text-primary">
                {companyName || SITE_CONFIG.companyName}
              </span>
            </div>
          </div>

          {/* Grand Total Display */}
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-2">
            <span className="text-sm font-medium text-muted-foreground">
              {dict.LABEL_GRAND_TOTAL || "Grand Total"}:
            </span>
            <span className="font-mono font-bold">
              {SITE_CONFIG.currencySymbol}{" "}
              {Math.round(totalAmount).toLocaleString()}
            </span>
          </div>

          {/* Funders List */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {dict.LABEL_FUNDERS || "Funders"} ({funders.length})
            </Label>

            {funders.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/20 py-6 text-center text-sm text-muted-foreground">
                {dict.LABEL_FUNDERS_LIST_EMPTY || "No funders added yet"}
                <br />
                <span className="text-xs">
                  {companyName || "Company"} covers all
                </span>
              </div>
            ) : (
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {funders.map((funder) => (
                  <div
                    key={funder.funder_id}
                    className="flex items-center justify-between rounded-lg border bg-background p-3 transition-colors hover:bg-muted/20"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium text-sm">
                        {funder.funder_name}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {SITE_CONFIG.currencySymbol}{" "}
                        {Math.round(funder.amount).toLocaleString()}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveFunder(funder.funder_id)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Funder Section */}
          <div className="space-y-3 rounded-lg border bg-muted/10 p-4">
            <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {dict.LABEL_ADD_FUNDER || "Add Funder"}
            </Label>

            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  {dict.LABEL_FUNDER_NAME || "Funder"}
                </Label>
                <LiveSearch<FunderOption>
                  data={selectedFunder ? [selectedFunder] : []}
                  fetchData={async (query) => {
                    let q = supabase
                      .from("funders")
                      .select("id, name")
                      .eq("is_active", true)
                      .order("name", { ascending: true })
                      .limit(8)

                    if (query) {
                      q = q.ilike("name", `%${query}%`)
                    }

                    const { data } = await q

                    // Filter out already added funders
                    return ((data as FunderOption[]) || []).filter(
                      (f) => !isFunderAdded(f.id)
                    )
                  }}
                  value={selectedFunder?.id || ""}
                  onSelect={handleFunderSelect}
                  keyField="id"
                  displayField="name"
                  defaultDisplay={selectedFunder?.name || ""}
                  searchColumns={["name"]}
                  visualColumns={[
                    {
                      key: "name" as keyof FunderOption,
                      header:
                        dict.LABEL_NAME || "Name",
                      className: "w-full",
                      primary: true,
                    },
                  ]}
                  placeholder={
                    dict.PLACEHOLDER_SEARCH || "Search funders..."
                  }
                  emptyMessage={dict.NO_DATA || "No funders found"}
                />
              </div>

              <div className="grid gap-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">
                    {dict.LABEL_FUNDER_AMOUNT || "Amount"}
                  </Label>
                  {totalAmount > 0 && (
                    <span className="text-xs text-muted-foreground">
                      Max: {SITE_CONFIG.currencySymbol}{" "}
                      {Math.round(remainingAmount).toLocaleString()}
                    </span>
                  )}
                </div>
                <NumberInput
                  value={funderAmount}
                  onChange={handleAmountChange}
                  leftBadge={SITE_CONFIG.currencySymbol}
                  min={0}
                  max={totalAmount > 0 ? remainingAmount : Infinity}
                />
              </div>

              <Button
                type="button"
                variant="default"
                size="sm"
                className="w-full"
                onClick={handleAddFunder}
                disabled={
                  !selectedFunder ||
                  funderAmount <= 0 ||
                  (totalAmount > 0 && funderAmount > remainingAmount)
                }
              >
                <Plus className="size-4" data-icon="inline-start" />
                {dict.BUTTON_ADD || "Add"}
              </Button>
            </div>
          </div>

          {/* Summary */}
          <div className="space-y-2 rounded-lg border-t pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {dict.LABEL_TOTAL_FUNDERS || "Total Funders"}:
              </span>
              <span className="font-mono font-medium">
                {SITE_CONFIG.currencySymbol}{" "}
                {Math.round(totalFundersAmount).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {dict.LABEL_COMPANY_CONTRIBUTION || "Company Covers"}:
              </span>
              <span
                className={cn(
                  "font-mono font-semibold",
                  companyContribution > 0
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                {SITE_CONFIG.currencySymbol}{" "}
                {Math.round(companyContribution).toLocaleString()}
              </span>
            </div>

            {/* Visual progress bar */}
            {totalAmount > 0 && (
              <div className="mt-3">
                <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                  {funders.map((funder) => (
                    <div
                      key={funder.funder_id}
                      className="bg-primary/60 transition-all"
                      style={{
                        width: `${(funder.amount / totalAmount) * 100}%`,
                      }}
                      title={`${funder.funder_name}: ${SITE_CONFIG.currencySymbol} ${Math.round(funder.amount).toLocaleString()}`}
                    />
                  ))}
                  {companyContribution > 0 && (
                    <div
                      className="bg-muted-foreground/30 transition-all"
                      style={{
                        width: `${(companyContribution / totalAmount) * 100}%`,
                      }}
                      title={`Company: ${SITE_CONFIG.currencySymbol} ${Math.round(companyContribution).toLocaleString()}`}
                    />
                  )}
                </div>
                <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
                  <span>{dict.LABEL_FUNDERS || "Funders"}</span>
                  <span>{companyName || "Company"}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
