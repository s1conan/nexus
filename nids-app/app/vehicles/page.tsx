"use client"

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  startTransition,
} from "react"
import { useDictionary } from "@/components/dictionary-provider"
import { useAuth } from "@/components/auth-provider"
import { createClient } from "@/lib/supabase"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Plus,
  Search,
  Pencil,
  Save,
  X,
  Trash2,
  Truck,
  Hash,
  Package,
  MinusCircle,
  RefreshCw,
  AlertCircle,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { SummaryCard } from "@/components/summary-card"
import { DeleteConfirmationDialog } from "@/components/confirmation-dialog"

import { cn, sanitizePostgrestValue } from "@/lib/utils"
import { SectionLoader } from "@/components/section-loader"
import { notify } from "@/lib/notifications"
import { usePersistedState } from "@/hooks/use-persisted-state"
import { ButtonLoader } from "@/components/button-loader"
import { NumberInput } from "@/components/number-input"
import { useDebounce } from "@/hooks/use-debounce"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"

const PAGE_SIZE = 50

export default function VehiclesPage() {
  const { dict } = useDictionary()
  const { hasPermission, loading: authLoading } = useAuth()
  const supabase = createClient()

  const [vehicles, setVehicles] = useState<any[]>([])
  const [updatedRowId, setUpdatedRowId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [viewOnly, setViewOnly] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string
    name: string
  } | null>(null)

  const [stats, setStats] = useState({
    totalVehicles: 0,
    activeVehicles: 0,
    totalCapacity: 0,
  })

  // Dialog State
  const [isOpen, setIsOpen] = usePersistedState("vehicles_dialog_open", false)
  const [editingItem, setEditingItem] = usePersistedState<any>(
    "vehicles_editing_data",
    null
  )

  // Filter States
  const [searchQuery, setSearchQuery] = usePersistedState("vehicles_search", "")
  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  const observerTarget = useRef(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Form State
  const [formData, setFormData] = usePersistedState("vehicles_form_data", {
    license_number: "",
    vehicle_type: "Truck",
    capacity: 0,
    is_active: true,
    compartments: [{ compartment_number: 1, capacity: 8000 }] as {
      compartment_number: number
      capacity: number
    }[],
  })

  // Permission Checks
  const canView = hasPermission("vehicles", "view")
  const canInsert = hasPermission("vehicles", "insert")
  const canEdit = hasPermission("vehicles", "edit")
  const canDelete = hasPermission("vehicles", "delete")

  const fetchStats = useCallback(async () => {
    try {
      const [
        { count: totalCount },
        { count: activeCount },
        { data: capacities },
      ] = await Promise.all([
        supabase.from("vehicles").select("*", { count: "exact", head: true }),
        supabase
          .from("vehicles")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true),
        supabase.from("vehicles").select("capacity"),
      ])

      const totalCap =
        capacities?.reduce(
          (acc: number, v: any) => acc + (v.capacity || 0),
          0
        ) || 0

      setStats({
        totalVehicles: totalCount || 0,
        activeVehicles: activeCount || 0,
        totalCapacity: totalCap,
      })
    } catch (err) {
      console.error("Fetch Vehicles Stats Error:", err)
    }
  }, [supabase])

  // Fetch Data
  const fetchData = useCallback(
    async (isInitial = false) => {
      if (isInitial) {
        setLoading(true)
        setOffset(0)
        fetchStats()
      } else {
        setLoadingMore(true)
      }

      try {
        const currentOffset = isInitial ? 0 : offset
        let query = supabase
          .from("vehicles")
          .select("*")
          .order("is_active", { ascending: false })
          .order("vehicle_type", { ascending: true })
          .order("license_number", { ascending: true })
          .range(currentOffset, currentOffset + PAGE_SIZE - 1)

        if (debouncedSearchQuery) {
          query = query.or(
            `license_number.ilike.%${sanitizePostgrestValue(debouncedSearchQuery)}%,vehicle_type.ilike.%${sanitizePostgrestValue(debouncedSearchQuery)}%`
          )
        }

        const { data, error } = await query

        if (error) throw error

        if (data) {
          if (isInitial) {
            setVehicles(data)
          } else {
            setVehicles((prev) => {
              const newItems = data.filter(
                (item: any) => !prev.some((p) => p.id === item.id)
              )
              return [...prev, ...newItems]
            })
          }
          setHasMore(data.length === PAGE_SIZE)
          setOffset(currentOffset + data.length)
        }
      } catch (err: any) {
        notify.error(dict.MSG_DATA_FETCH_FAILED, err.message)
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [
      supabase,
      offset,
      debouncedSearchQuery,
      dict.MSG_DATA_FETCH_FAILED,
      fetchStats,
    ]
  )

  useEffect(() => {
    startTransition(() => {
      fetchData(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchQuery])

  useEffect(() => {
    const rootElement = containerRef.current
    if (!rootElement) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          fetchData(false)
        }
      },
      {
        root: rootElement,
        rootMargin: "400px",
        threshold: 0,
      }
    )

    if (observerTarget.current) {
      observer.observe(observerTarget.current)
    }

    return () => observer.disconnect()
  }, [fetchData, hasMore, loading, loadingMore])

  const handleRefresh = () => {
    fetchData(true)
  }

  // Open Dialog
  const handleOpenDialog = (item: any = null, isViewOnly = false) => {
    setViewOnly(isViewOnly)
    if (item) {
      setEditingItem(item)
      setFormData({
        license_number: item.license_number,
        vehicle_type: item.vehicle_type || "Truck",
        capacity: item.capacity || 0,
        is_active: item.is_active ?? true,
        compartments: (item.compartments || []).map((c: any) => ({
          compartment_number: c.number,
          capacity: c.capacity,
        })),
      })
    } else {
      if (!canInsert) return
      setEditingItem(null)
      setFormData({
        license_number: "",
        vehicle_type: "Truck",
        capacity: 0,
        is_active: true,
        compartments: [{ compartment_number: 1, capacity: 8000 }],
      })
    }
    setIsOpen(true)
  }

  // Actions
  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isSubmitting) return

    // Validate required fields
    if (!formData.license_number?.trim()) {
      notify.error("Validation Error", "License number is required.")
      return
    }
    if (!formData.vehicle_type?.trim()) {
      notify.error("Validation Error", "Vehicle type is required.")
      return
    }

    setIsSubmitting(true)

    try {
      const payload = {
        license_number: formData.license_number,
        vehicle_type: formData.vehicle_type,
        capacity: formData.capacity,
        is_active: formData.is_active,
        compartments: formData.compartments.map((c) => ({
          number: c.compartment_number,
          capacity: c.capacity,
        })),
      }

      if (editingItem) {
        const { data, error } = await supabase
          .from("vehicles")
          .update(payload)
          .eq("id", editingItem.id)
          .select()
          .single()
        if (error) throw error
        setVehicles((prev) =>
          prev.map((v) => (v.id === editingItem.id ? data : v))
        )
        setUpdatedRowId(editingItem.id)
        notify.success(
          dict.MSG_UPDATE_SUCCESS.replace(
            "%data%",
            `[${formData.license_number}]`
          ),
          dict.MSG_SUCCESS_UPDATE_DESC_NO_COMPANY.replace(
            "%entity%",
            `vehicle [${formData.license_number}]`
          ),
          undefined,
          true
        )
      } else {
        const { data, error } = await supabase
          .from("vehicles")
          .insert([payload])
          .select()
          .single()
        if (error) throw error
        setVehicles((prev) => [data, ...prev])
        notify.success(
          dict.MSG_SAVE_SUCCESS.replace(
            "%data%",
            `[${formData.license_number}]`
          ),
          dict.MSG_SUCCESS_SAVE_DESC_NO_COMPANY.replace(
            "%entity%",
            `vehicle [${formData.license_number}]`
          ),
          undefined,
          true
        )
      }
      fetchStats()
      setIsOpen(false)
    } catch (err: any) {
      notify.error(
        dict.MSG_SAVE_FAILED.replace("%data%", `[${formData.license_number}]`),
        err.message
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    const vehicle = vehicles.find((v) => v.id === id)
    if (!vehicle) return
    setDeleteConfirm({ id: vehicle.id, name: vehicle.license_number })
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return
    try {
      const { error } = await supabase
        .from("vehicles")
        .delete()
        .eq("id", deleteConfirm.id)
      if (error) throw error
      notify.deleted(
        dict.MSG_DELETE_SUCCESS.replace("%data%", `[${deleteConfirm.name}]`),
        dict.MSG_SUCCESS_DELETE_DESC_NO_COMPANY.replace(
          "%entity%",
          `vehicle [${deleteConfirm.name}]`
        ),
        undefined,
        true
      )
      setVehicles((prev) => prev.filter((v) => v.id !== deleteConfirm.id))
      fetchStats()
    } catch (err: any) {
      notify.error(
        dict.MSG_SAVE_FAILED.replace("%data%", `[${deleteConfirm.name}]`),
        err.message
      )
    } finally {
      setDeleteConfirm(null)
    }
  }

  const addCompartment = () => {
    const nextNum = formData.compartments.length + 1
    const newComps = [
      ...formData.compartments,
      { compartment_number: nextNum, capacity: 0 },
    ]
    const newTotal = newComps.reduce((acc, c) => acc + (c.capacity || 0), 0)
    setFormData({ ...formData, compartments: newComps, capacity: newTotal })
  }

  const removeCompartment = (idx: number) => {
    const newComps = formData.compartments.filter((_, i) => i !== idx)
    const reindexed = newComps.map((c, i) => ({
      ...c,
      compartment_number: i + 1,
    }))
    const newTotal = reindexed.reduce((acc, c) => acc + (c.capacity || 0), 0)
    setFormData({ ...formData, compartments: reindexed, capacity: newTotal })
  }

  if (!canView && !loading && !authLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="space-y-2 text-center">
          <AlertCircle className="mx-auto size-8 text-destructive" />
          <h2 className="text-lg font-semibold">
            {dict.MSG_ACCESS_DENIED || "Access Denied"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {dict.MSG_NO_PERMISSION ||
              "You do not have permission to view this page."}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header shrink-0">
        <h1 className="page-title">
          <Truck className="mr-2 inline-block size-5 text-primary" />
          {dict.MENU_VEHICLES}
        </h1>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={loading || loadingMore}
            title="Refresh Data"
          >
            <RefreshCw
              className={cn(
                "size-4",
                (loading || loadingMore) && "animate-spin"
              )}
            />
          </Button>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} disabled={!canInsert}>
                <Plus data-icon="inline-start" />
                {dict.BUTTON_ADD}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  <Truck className="mr-2 inline-block size-5" />{" "}
                  {viewOnly
                    ? formData.license_number
                    : editingItem
                      ? `${dict.BUTTON_EDIT} ${dict.MENU_VEHICLES}`
                      : `${dict.BUTTON_ADD} ${dict.MENU_VEHICLES}`}
                </DialogTitle>
              </DialogHeader>

              <form
                onSubmit={handleSave}
                id="vehicles-form"
                className="relative max-h-[70vh] overflow-y-auto"
              >
                <div
                  className={cn(
                    `relative flex w-full flex-col gap-6 p-5 ${viewOnly ? "rounded-b-xl border-2 border-orange-500" : ""}`
                  )}
                >
                  {viewOnly && <div className="absolute inset-0 z-20"></div>}
                  <div className="flex-1 space-y-6 py-2">
                    <div className="grid grid-cols-2 gap-4 pl-1">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="license">
                          {dict.LABEL_LICENSE_NUMBER}
                          <span className="ml-0.5 text-destructive">*</span>
                        </Label>
                        <input
                          id="license"
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm font-bold shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                          value={formData.license_number}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              license_number: e.target.value.toUpperCase(),
                            })
                          }
                          placeholder="B 1234 XYZ"
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="type">
                          {dict.LABEL_VEHICLE_TYPE}
                          <span className="ml-0.5 text-destructive">*</span>
                        </Label>
                        <div className="flex items-center gap-3">
                          <Input
                            id="type"
                            value={formData.vehicle_type}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                vehicle_type: e.target.value,
                              })
                            }
                            placeholder="e.g. Tanker, Truck"
                            required
                          />
                          <div className="flex min-w-[60px] flex-col items-center gap-0.5">
                            <Switch
                              id="is_active"
                              checked={formData.is_active}
                              onCheckedChange={(checked) =>
                                setFormData({ ...formData, is_active: checked })
                              }
                            />
                            <span className="mt-1.5 text-[10px] leading-none font-bold text-muted-foreground uppercase">
                              {formData.is_active
                                ? dict.LABEL_IS_ACTIVE || "Active"
                                : dict.LABEL_IS_INACTIVE || "Inactive"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pl-1">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="total_cap">
                          {dict.LABEL_TOTAL_CAPACITY}
                        </Label>
                        <NumberInput
                          id="total_cap"
                          value={formData.capacity}
                          onChange={(val) =>
                            setFormData({ ...formData, capacity: val })
                          }
                          badge="L"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b pb-2">
                        <h3 className="flex items-center gap-2 text-base font-semibold">
                          <Package className="size-4 text-primary" />{" "}
                          {dict.LABEL_COMPARTMENTS}
                        </h3>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addCompartment}
                        >
                          <Plus className="size-4" />
                        </Button>
                      </div>

                      <div className="max-h-[40vh] space-y-3 overflow-y-auto pr-2">
                        {formData.compartments.map((comp, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-4 rounded-lg border border-border/50 bg-muted/20 p-3"
                          >
                            <Label
                              htmlFor={`compartment-${idx}`}
                              className="flex min-w-[60px] items-center gap-2 font-bold text-primary"
                            >
                              <Hash className="size-4" />{" "}
                              {comp.compartment_number}
                            </Label>
                            <div className="flex-1">
                              <NumberInput
                                id={`compartment-${idx}`}
                                value={comp.capacity}
                                onChange={(val) => {
                                  const newComps = [...formData.compartments]
                                  newComps[idx].capacity = val
                                  const newTotal = newComps.reduce(
                                    (acc, c) => acc + (c.capacity || 0),
                                    0
                                  )
                                  setFormData({
                                    ...formData,
                                    compartments: newComps,
                                    capacity: newTotal,
                                  })
                                }}
                                badge="L"
                                required
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 text-destructive"
                              onClick={() => removeCompartment(idx)}
                              disabled={formData.compartments.length === 1}
                            >
                              <MinusCircle className="size-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </form>
              {!viewOnly && (
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsOpen(false)}
                  >
                    <X data-icon="inline-start" />
                    {dict.BUTTON_CANCEL}
                  </Button>
                  <Button
                    type="submit"
                    form="vehicles-form"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <ButtonLoader />
                    ) : (
                      <Save data-icon="inline-start" />
                    )}
                    {dict.BUTTON_SAVE}
                  </Button>
                </DialogFooter>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Action Bar / Filters */}
      <div className="action-bar shrink-0">
        <div className="relative w-full max-w-sm flex-1 max-sm:w-full">
          <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder={dict.PLACEHOLDER_SEARCH}
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Data Area */}
      <Card
        ref={containerRef}
        className="data-card custom-scrollbar flex-1 overflow-auto"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-7">
                {dict.LABEL_LICENSE_NUMBER}
              </TableHead>
              <TableHead>{dict.LABEL_VEHICLE_TYPE}</TableHead>
              <TableHead>{dict.LABEL_COMPARTMENTS}</TableHead>
              <TableHead className="text-right">
                {dict.LABEL_TOTAL_CAPACITY}
              </TableHead>
              <TableHead className="text-right"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="p-0">
                  <SectionLoader />
                </TableCell>
              </TableRow>
            ) : (
              <>
                {vehicles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center">
                      {dict.NO_DATA}
                    </TableCell>
                  </TableRow>
                ) : (
                  vehicles.map((v) => (
                    <TableRow
                      key={v.id}
                      className={cn(
                        "group cursor-pointer",
                        updatedRowId === v.id && "animate-row-highlight"
                      )}
                      onDoubleClick={() => handleOpenDialog(v, true)}
                      onAnimationEnd={() => {
                        if (updatedRowId === v.id) setUpdatedRowId(null)
                      }}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "size-2 rounded-full",
                              v.is_active
                                ? "bg-green-500"
                                : "bg-muted-foreground/30"
                            )}
                          />
                          <span>{v.license_number}</span>
                        </div>
                      </TableCell>
                      <TableCell>{v.vehicle_type}</TableCell>
                      <TableCell>{v.compartments?.length || 0} Comp.</TableCell>
                      <TableCell className="text-right font-mono">
                        {v.capacity?.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="table_action"
                            size="sm"
                            onClick={() => handleOpenDialog(v)}
                            disabled={!canEdit}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          {canDelete && (
                            <Button
                              variant="table_action"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => handleDelete(v.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </>
            )}

            {/* Infinite Scroll Sentinel & Loader */}
            <TableRow ref={observerTarget} className="border-0">
              <TableCell colSpan={5} className="overflow-hidden border-0 p-0">
                {loadingMore && (
                  <div className="relative h-24 w-full">
                    <SectionLoader />
                  </div>
                )}
                {!hasMore && vehicles.length > 0 && !loading && (
                  <div className="py-3 text-center text-xs text-danger/70 select-none">
                    — End of data —
                  </div>
                )}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
      <div className="mb-1 grid shrink-0 grid-cols-3 gap-2 md:gap-4">
        <SummaryCard
          label={dict.LABEL_TOTAL_VEHICLES || "Total Vehicles"}
          value={stats.totalVehicles}
          icon={Truck}
          color="primary"
        />
        <SummaryCard
          label={dict.LABEL_ACTIVE_VEHICLES || "Active Vehicles"}
          value={stats.activeVehicles}
          icon={Truck}
          color="green"
        />
        <SummaryCard
          label={dict.LABEL_TOTAL_CAPACITY || "Total Capacity"}
          value={`${stats.totalCapacity.toLocaleString()} L`}
          icon={Package}
          color="blue"
        />
      </div>

      <DeleteConfirmationDialog
        isOpen={deleteConfirm !== null}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        onConfirm={confirmDelete}
        title={dict.TITLE_DELETE || "Confirm Delete"}
        description={
          dict.MSG_DELETE_CONFIRM?.split("%data%")[0] ||
          "Are you sure you want to delete this vehicle? This action cannot be undone."
        }
        dataName={deleteConfirm?.name}
        confirmText={dict.BUTTON_DELETE || "Delete"}
        cancelText={dict.BUTTON_CANCEL || "Cancel"}
        variant="destructive"
      />
    </div>
  )
}
