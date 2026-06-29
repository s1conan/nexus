"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useDictionary } from "@/components/dictionary-provider"
import { useAuth } from "@/components/auth-provider"
import { createClient } from "@/lib/supabase"
import { useDebounce } from "@/hooks/use-debounce"
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
  X,
  Plus,
  Search,
  Pencil,
  Save,
  Printer,
  Trash2,
  ChevronDown,
  CheckCircle2,
  Truck,
  Calendar,
  User as UserIcon,
  Car,
  Hash,
  Package,
  AlertCircle,
  MapPin,
  Phone,
  ArrowUpDown,
  ArrowUpAZ,
  ArrowDownZA,
  RefreshCw,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { NumberInput } from "@/components/number-input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { cn, constructMultiWordSearch } from "@/lib/utils"
import { SectionLoader } from "@/components/section-loader"
import { notify } from "@/lib/notifications"
import { RichTextEditor } from "@/components/rich-text-editor"
import { LiveSearch } from "@/components/live-search"
import { format } from "date-fns"
import { generateStandardDeliveryOrderPDF } from "@/lib/pdf-generator"
import dynamic from "next/dynamic"
import { ButtonLoader } from "@/components/button-loader"
import { DeleteConfirmationDialog } from "@/components/confirmation-dialog"

const Gallery = dynamic(() => import("@/components/Gallery"), { ssr: false })

const PAGE_SIZE = 50

interface SortLevel {
  id: string
  column: string
  direction: "asc" | "desc"
}

export default function DeliveryOrdersPage() {
  const { dict, lang } = useDictionary()
  const { hasPermission, profile, loading: authLoading } = useAuth()
  const supabase = createClient()

  const [orders, setOrders] = useState<any[]>([])
  const [companyInfo, setCompanyInfo] = useState<any>(null)
  const [previewDoc, setPreviewDoc] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const [isSaving, setIsSaving] = useState(false)

  // Dialog State
  const [isOpen, setIsOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [viewOnly, setViewOnly] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string
    name: string
  } | null>(null)

  // Filter States
  const [searchQuery, setSearchQuery] = useState("")
  const debouncedSearchQuery = useDebounce(searchQuery, 300)
  const [isSortOpen, setIsSortOpen] = useState(false)
  const [sortLevels, setSortLevels] = useState<SortLevel[]>([
    { id: "1", column: "created_at", direction: "desc" },
  ])

  const observerTarget = useRef(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const statusStyles: Record<string, string> = {
    Draft:
      "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20",
    Shipped:
      "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20",
    Delivered:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
    Cancelled:
      "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
  }

  // Tracking info for LiveSearch / Display
  const [selectedCompanyInfo, setSelectedCompanyInfo] = useState<any>(null)
  const [selectedSupplierInfo, setSelectedSupplierInfo] = useState<any>(null)
  const [selectedTransporterInfo, setSelectedTransporterInfo] =
    useState<any>(null)
  const [selectedPOInfo, setSelectedPOInfo] = useState<any>(null)
  const [selectedProductInfo, setSelectedProductInfo] = useState<any>(null)
  const [selectedVehicleInfo, setSelectedVehicleInfo] = useState<any>(null)
  const [availableStock, setAvailableStock] = useState<number | null>(null)
  const [remainingSOQty, setRemainingSOQty] = useState<number | null>(null)
  const sealNumberCache = useRef<Record<number, string>>({})

  // Form State
  const [formData, setFormData] = useState(() => ({
    do_number: "",
    company_id: "",
    supplier_id: "",
    transporter_id: "",
    so_id: "",
    product_id: "",
    do_date: format(new Date(), "yyyy-MM-dd"),
    quantity: 0,
    driver_info: { name: "", phone: "" },
    vehicle_id: "",
    vehicle_number: "",
    delivery_address: "",
    status: "Draft",
    note: "",
    is_note_enabled: true,
    compartment_details: [] as {
      compartment_number: number
      seal_number: string
      quantity: number
    }[],
  }))

  // Fetch Data
  const fetchData = useCallback(
    async (isInitial = false) => {
      if (isInitial) {
        setLoading(true)
        setOffset(0)
      } else {
        setLoadingMore(true)
      }

      try {
        const currentOffset = isInitial ? 0 : offset

        if (isInitial) {
          const { data: sRes } = await supabase
            .from("app_settings")
            .select("*")
            .eq("category", "company")
          if (sRes) {
            const info: any = {}
            sRes.forEach((r: any) => {
              info[r.name] = r.value
            })
            setCompanyInfo(info)
          }
        }

        let query = supabase
          .from("delivery_orders")
          .select(
            "*, company:companies!delivery_orders_company_id_fkey(id, name, details), supplier:companies!delivery_orders_supplier_id_fkey(id, name), transporter:companies!delivery_orders_transporter_id_fkey(id, name), po:sales_orders(id, so_number, po_number, quantity, so_date, delivery_address), product:products(id, sku, name), vehicle:vehicles(id, license_number)"
          )
          .range(currentOffset, currentOffset + PAGE_SIZE - 1)

        // Dynamic sorting
        sortLevels.forEach((level) => {
          const [relation, col] = level.column.split(".")
          if (!col) {
            query = query.order(level.column, {
              ascending: level.direction === "asc",
            })
          }
        })
        query = query.order("created_at", { ascending: false })

        if (debouncedSearchQuery) {
          const searchStr = constructMultiWordSearch(debouncedSearchQuery, [
            "do_number",
            "company.name",
            "product.sku",
            "driver_info->>name",
            "vehicle_number",
          ])
          if (searchStr) query = query.or(searchStr)
        }

        const { data, error } = await query
        if (error) throw error

        if (data) {
          if (isInitial) {
            setOrders(data)
          } else {
            setOrders((prev) => {
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
      sortLevels,
      dict.MSG_DATA_FETCH_FAILED,
    ]
  )

  const handleRefresh = () => {
    fetchData(true)
  }

  useEffect(() => {
    fetchData(true)
  }, [debouncedSearchQuery, sortLevels])

  // Ordinary Infinite Scroll
  useEffect(() => {
    const rootElement = containerRef.current
    if (!rootElement) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry.isIntersecting && hasMore && !loading && !loadingMore) {
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

  // Fetch Stock for selected supplier and product
  useEffect(() => {
    async function fetchStock() {
      if (formData.supplier_id && formData.product_id) {
        const { data, error } = await supabase
          .from("supplier_stock_summary")
          .select("current_stock")
          .eq("supplier_id", formData.supplier_id)
          .eq("product_id", formData.product_id)
          .single()
        console.log("data:", data);
        console.log("error:", error);
        if (error && error.code !== "PGRST116") {
          console.error("Error fetching stock:", error)
        }
        setAvailableStock(data?.current_stock || 0)
      } else {
        setAvailableStock(null)
      }
    }
    fetchStock()
  }, [formData.supplier_id, formData.product_id])

  // Compute remaining SO qty: SO total qty - sum of existing DO qties (excluding current DO if editing)
  useEffect(() => {
    async function fetchRemainingSOQty() {
      if (!formData.so_id || !selectedPOInfo?.quantity) {
        setRemainingSOQty(null)
        return
      }
      let query = supabase
        .from("delivery_orders")
        .select("quantity")
        .eq("so_id", formData.so_id)
      // Exclude current DO when editing to avoid counting it twice
      if (editingItem) {
        query = query.neq("id", editingItem.id)
      }
      const { data } = await query
      const delivered = (data || []).reduce(
        (sum: number, d: any) => sum + (d.quantity || 0),
        0
      )
      const remaining = Number(selectedPOInfo.quantity) - delivered
      setRemainingSOQty(remaining > 0 ? remaining : 0)
    }
    fetchRemainingSOQty()
  }, [formData.so_id, selectedPOInfo?.quantity, editingItem])

  // Sync seal numbers to cache whenever compartment_details changes
  useEffect(() => {
    for (const c of formData.compartment_details) {
      if (c.seal_number)
        sealNumberCache.current[c.compartment_number] = c.seal_number
    }
  }, [formData.compartment_details])

  // When vehicle changes, auto-fill compartments
  const handleVehicleSelect = (vId: string, vehicle?: any) => {
    if (vehicle) {
      setSelectedVehicleInfo(vehicle)
      const compartments = (vehicle.compartments || []).sort(
        (a: any, b: any) => a.number - b.number
      )
      setFormData((prev) => ({
        ...prev,
        vehicle_id: vId,
        vehicle_number: vehicle.license_number,
        compartment_details: compartments.map((c: any) => ({
          compartment_number: c.number,
          seal_number: sealNumberCache.current[c.number] || "",
          quantity: c.capacity || 0,
        })),
      }))
    } else {
      setSelectedVehicleInfo(null)
      setFormData((prev) => ({
        ...prev,
        vehicle_id: vId,
        vehicle_number: "",
        compartment_details: [],
      }))
    }
  }

  // Permission Checks
  const canView = hasPermission("delivery-order", "view")
  const canInsert = hasPermission("delivery-order", "insert")
  const canEdit = hasPermission("delivery-order", "edit")
  const canDelete = hasPermission("delivery-order", "delete")
  const canPrint = hasPermission("delivery-order", "print")

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

  // Open Dialog
  const handleOpenDialog = (item: any = null, isViewOnly = false) => {
    setViewOnly(isViewOnly)
    if (item) {
      setEditingItem(item)
      setSelectedCompanyInfo(item.company)
      setSelectedSupplierInfo(item.supplier)
      setSelectedTransporterInfo(item.transporter)
      setSelectedPOInfo(item.po)
      setSelectedProductInfo(item.product)
      setSelectedVehicleInfo(item.vehicle)

      setFormData({
        do_number: item.do_number,
        company_id: item.company_id,
        supplier_id: item.supplier_id || "",
        transporter_id: item.transporter_id || "",
        so_id: item.so_id || "",
        product_id: item.product_id,
        do_date: item.do_date,
        quantity: item.quantity,
        driver_info: item.driver_info || {
          name: item.driver_name || "",
          phone: item.driver_phone || "",
        },
        vehicle_id: item.vehicle_id || "",
        vehicle_number:
          item.vehicle?.license_number || item.vehicle_number || "",
        delivery_address: item.delivery_address || "",
        status: item.status,
        note: item.note || "",
        is_note_enabled: item.is_note_enabled ?? true,
        compartment_details: (item.compartments || []).map((c: any) => ({
          compartment_number: c.compartment_number,
          seal_number: c.seal_number,
          quantity: c.quantity,
        })),
      })
    } else {
      if (!canInsert) return
      setEditingItem(null)
      setSelectedCompanyInfo(null)
      setSelectedSupplierInfo(null)
      setSelectedTransporterInfo(null)
      setSelectedPOInfo(null)
      setSelectedProductInfo(null)
      setSelectedVehicleInfo(null)
      setAvailableStock(null)
      setRemainingSOQty(null)

      setFormData({
        do_number: "", // Will be auto-generated on save if empty
        company_id: "",
        supplier_id: "",
        transporter_id: "",
        so_id: "",
        product_id: "",
        do_date: format(new Date(), "yyyy-MM-dd"),
        quantity: 0,
        driver_info: { name: "", phone: "" },
        vehicle_id: "",
        vehicle_number: "",
        delivery_address: "",
        status: "Draft",
        note: "",
        is_note_enabled: true,
        compartment_details: [],
      })
    }
    setIsOpen(true)
  }

  // Actions
  const handleSave = async () => {
    // Check if note is empty and disable if so
    const isNoteEmpty = !formData.note || formData.note.replace(/<[^>]*>/g, "").trim() === ""
    if (isNoteEmpty) {
      setFormData((prev) => ({ ...prev, is_note_enabled: false }))
    }

    // Field validation
    const errors: string[] = []
    if (!formData.so_id) errors.push(dict.MSG_SO_REQUIRED)
    if (!formData.company_id) errors.push("Perusahaan harus dipilih.")
    if (!formData.product_id) errors.push("Produk harus dipilih.")
    if (!formData.quantity || formData.quantity <= 0)
      errors.push("Jumlah harus diisi.")
    if (!formData.supplier_id) errors.push("Supplier harus dipilih.")
    if (!formData.transporter_id) errors.push("Transporter harus dipilih.")
    if (!formData.vehicle_id) errors.push("Kendaraan harus dipilih.")
    if (availableStock !== null && formData.quantity > availableStock) {
      errors.push("Stok dari supplier tidak mencukupi.")
    }
    if (remainingSOQty !== null && formData.quantity > remainingSOQty) {
      errors.push(
        `Jumlah melebihi sisa SO (${remainingSOQty.toLocaleString()} L).`
      )
    }

    if (errors.length > 0) {
      notify.error("Validasi Gagal", errors.join("\n"))
      return
    }

    setIsSaving(true)
    try {
      const { compartment_details, ...payload } = formData
      const dbPayload = { ...payload, compartments: compartment_details } as any

      // Generate document number if empty (for new orders)
      if (!editingItem && !dbPayload.do_number) {
        const { data, error: rpcError } = await supabase.rpc(
          "generate_document_number",
          { p_doc_type: "delivery-order" }
        )
        if (rpcError) throw rpcError
        dbPayload.do_number = data
      }

      if (editingItem) {
        const { error } = await supabase
          .from("delivery_orders")
          .update(dbPayload)
          .eq("id", editingItem.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from("delivery_orders")
          .insert([dbPayload])
        if (error) throw error
      }

      if (editingItem) {
        // Fetch updated row to keep local state in sync with relations
        const { data: updatedRow, error: fetchError } = await supabase
          .from("delivery_orders")
          .select(
            "*, company:companies!delivery_orders_company_id_fkey(id, name, details), supplier:companies!delivery_orders_supplier_id_fkey(id, name), transporter:companies!delivery_orders_transporter_id_fkey(id, name), po:sales_orders(id, so_number, quantity, so_date, delivery_address), product:products(id, sku, name), vehicle:vehicles(id, license_number)"
          )
          .eq("id", editingItem.id)
          .single()

        if (!fetchError && updatedRow) {
          setOrders((prev) =>
            prev.map((o) => (o.id === editingItem.id ? updatedRow : o))
          )
        } else {
          fetchData(true)
        }
      } else {
        fetchData(true)
      }

      // Automatically update Sales Order Status
      if (dbPayload.so_id) {
        const { data: allDOs } = await supabase
          .from("delivery_orders")
          .select("quantity")
          .eq("so_id", dbPayload.so_id)
        const totalDOQty = (allDOs || []).reduce(
          (sum: number, doItem: any) => sum + (doItem.quantity || 0),
          0
        )

        const { data: so } = await supabase
          .from("sales_orders")
          .select("quantity, status")
          .eq("id", dbPayload.so_id)
          .single()
        if (so) {
          let newStatus = so.status
          if (totalDOQty >= so.quantity) newStatus = "Fulfilled"
          else if (totalDOQty > 0) newStatus = "Partial"
          else newStatus = "Approved"

          if (so.status !== newStatus) {
            await supabase
              .from("sales_orders")
              .update({ status: newStatus })
              .eq("id", dbPayload.so_id)
          }
        }
      }

      const docLabel = `[${dbPayload.do_number || formData.do_number}]`
      if (editingItem) {
        notify.success(
          dict.MSG_UPDATE_SUCCESS.replace("%data%", docLabel),
          dict.MSG_SUCCESS_UPDATE_DESC.replace(
            "%entity%",
            "delivery order"
          ).replace("%company%", `[${selectedCompanyInfo?.name || ""}]`),
          undefined,
          true
        )
      } else {
        notify.success(
          dict.MSG_DO_SAVED.replace("%data%", docLabel),
          dict.MSG_SUCCESS_SAVE_DESC.replace(
            "%entity%",
            "delivery order"
          ).replace("%company%", `[${selectedCompanyInfo?.name || ""}]`),
          undefined,
          true
        )
      }
      setIsOpen(false)
    } catch (err: any) {
      const docLabel = `[${formData.do_number}]`
      notify.error(
        dict.MSG_SAVE_FAILED.replace("%data%", docLabel),
        err.message
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    const item = orders.find((d) => d.id === id)
    if (item) {
      setDeleteConfirm({ id: item.id, name: item.do_number })
    }
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return
    const id = deleteConfirm.id
    const deleteConfirmName = deleteConfirm.name
    const item = orders.find((d) => d.id === id)
    const companyName = item?.company?.name || ""
    const docLabel = `[${deleteConfirmName}]`
    try {
      const { error } = await supabase
        .from("delivery_orders")
        .delete()
        .eq("id", id)
      if (error) throw error

      setOrders((prev) => prev.filter((o) => o.id !== id))
      notify.deleted(
        dict.MSG_DO_DELETED.replace("%data%", docLabel),
        dict.MSG_SUCCESS_DELETE_DESC.replace(
          "%entity%",
          "delivery order"
        ).replace("%company%", `[${companyName}]`),
        undefined,
        true
      )
    } catch (err: any) {
      notify.error(
        dict.MSG_SAVE_FAILED.replace("%data%", docLabel),
        err.message
      )
    } finally {
      setDeleteConfirm(null)
    }
  }

  const updateStatus = async (id: string, status: string) => {
    const item = orders.find((o) => o.id === id)
    if (!item) return
    const docLabel = `[${item.do_number}]`
    const companyName = item.company?.name || ""
    try {
      const { error } = await supabase
        .from("delivery_orders")
        .update({ status })
        .eq("id", id)
      if (error) throw error

      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)))
      notify.success(
        dict.MSG_DO_STATUS_UPDATED.replace("%data%", docLabel),
        dict.MSG_SUCCESS_STATUS_DESC.replace("%status%", `[${status}]`).replace(
          "%company%",
          `[${companyName}]`
        ),
        undefined,
        true
      )
    } catch (err: any) {
      notify.error(
        dict.MSG_UPDATE_FAILED.replace("%data%", docLabel),
        err.message
      )
    }
  }

  const handlePrint = async (o: any) => {
    if (!companyInfo) {
      notify.error(dict.MSG_SAVE_FAILED, "Company information not loaded yet.")
      return
    }

    const dataUri = await generateStandardDeliveryOrderPDF(companyInfo, o, {
      save: false,
      output: "datauri",
    })
    const contacts = o.company?.details?.contact_persons?.length
      ? o.company.details.contact_persons
      : [
        {
          name: o.company?.details?.contact_person || "-",
          email: o.company?.details?.email || o.company?.email || "",
        },
      ]
    setPreviewDoc({
      id: o.id,
      title: o.do_number,
      description: `${dict.LABEL_COMPANY_NAME}: ${o.company?.name || "-"}`,
      images: [],
      pdf: dataUri,
      customerEmail: contacts[0]?.email || "",
      contacts: contacts,
      raw: o,
    })
  }

  const handleSendEmail = async (doc: any) => {
    try {
      const doRecord = doc.raw || doc
      const { data: ccData } = await supabase
        .from("app_settings")
        .select("value")
        .eq("category", "email")
        .eq("name", "cc_quotation")
        .single()
      const ccList = ccData?.value
        ? ccData.value
          .split(",")
          .map((email: string) => email.trim())
          .filter((e: string) => e !== "")
        : []
      const pdfDataUri = await generateStandardDeliveryOrderPDF(
        companyInfo,
        doRecord,
        { save: false, output: "datauri" }
      )
      if (!pdfDataUri) throw new Error("Failed to generate PDF for attachment.")
      const attachments = [
        {
          filename: `DO_${doc.title}.pdf`,
          content: (pdfDataUri as string).split(",")[1],
        },
      ]

      // Build email HTML
      const customerName =
        doRecord.company?.details?.contact_person ||
        doRecord.company?.name ||
        "Valued Customer"
      const deliveryDate = doRecord.do_date
        ? new Date(doRecord.do_date).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
        : "-"
      const vehicleNumber =
        doRecord.vehicle?.license_number || doRecord.vehicle_number || "-"
      const driverName =
        doRecord.driver_info?.name || doRecord.driver_name || "-"
      const driverPhone =
        doRecord.driver_info?.phone || doRecord.driver_phone || "-"

      const emailHtml = `<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 800px; margin: 0 auto; padding: 0; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
        <div style="background: #0082ec; padding: 32px 40px; text-align: center;">
          <h1 style="color: #ffffff; font-size: 28px; margin: 0 0 4px 0; font-weight: 700; letter-spacing: -0.5px;">PT Anugerah Buana Sriwijaya</h1>
          <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 0;">Industrial Fuel Distributor</p>
        </div>
        <div style="background: #f8fafc; padding: 20px 40px; border-bottom: 1px solid #e2e8f0; text-align: center;">
          <span style="display: inline-block; background: #0082ec; color: white; padding: 8px 24px; border-radius: 20px; font-size: 14px; font-weight: 600; letter-spacing: 0.5px;">DELIVERY ORDER</span>
        </div>
        <div style="padding: 40px;">
          <p style="color: #1e293b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">Dear <strong style="color: #0082ec;">${customerName}</strong>,</p>
          <p style="color: #475569; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0;">We are pleased to inform you that your order is ready for delivery. Please find attached the Delivery Order document for your reference and records.</p>
          <div style="background: #f8fafc; border-radius: 8px; padding: 24px; margin: 24px 0; border-left: 4px solid #0082ec;">
            <h3 style="color: #1e293b; font-size: 16px; margin: 0 0 16px 0; font-weight: 600;">Document Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 35%;">Delivery Order No.</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${doRecord.do_number || "-"}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Delivery Date</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${deliveryDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Vehicle License</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${vehicleNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Driver Name</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${driverName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Driver Phone</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${driverPhone}</td>
              </tr>
            </table>
          </div>
          <h3 style="color: #1e293b; font-size: 16px; margin: 32px 0 16px 0; font-weight: 600;">Delivery Items</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <thead>
              <tr style="background: #f1f5f9;">
                <th style="padding: 12px 16px; text-align: left; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-radius: 4px 0 0 4px;">Product</th>
                <th style="padding: 12px 16px; text-align: right; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Quantity</th>
                <th style="padding: 12px 16px; text-align: right; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-radius: 0 4px 4px 0;">Unit</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 12px 16px; color: #1e293b; font-size: 14px;">${doRecord.product?.name || doRecord.product_name || "-"}</td>
                <td style="padding: 12px 16px; color: #1e293b; font-size: 14px; text-align: right;">${doRecord.quantity?.toLocaleString("id-ID") || 0}</td>
                <td style="padding: 12px 16px; color: #64748b; font-size: 14px; text-align: right;">MT</td>
              </tr>
            </tbody>
          </table>
          ${doRecord.note ? `<div style="background: #fef9c3; border-radius: 8px; padding: 16px; margin: 24px 0;"><p style="color: #854d0e; font-size: 14px; margin: 0;"><strong>Notes:</strong> ${doRecord.note}</p></div>` : ""}
          <p style="color: #475569; font-size: 15px; line-height: 1.7; margin: 24px 0;">Please ensure someone is available at the delivery location to receive the shipment. If you have any questions or need further assistance, please do not hesitate to contact us.</p>
          <p style="color: #475569; font-size: 15px; line-height: 1.7; margin: 24px 0 32px 0;">Thank you for your continued trust in our services.</p>
          <p style="color: #1e293b; font-size: 15px; line-height: 1.6; margin: 0;">Best regards,<br><strong style="font-size: 16px;">PT Anugerah Buana Sriwijaya</strong><br><span style="color: #64748b; font-size: 14px;">Operations Team</span></p>
        </div>
        <div style="background: #f8fafc; padding: 24px 40px; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0; line-height: 1.6;">This is an automated message from PT Anugerah Buana Sriwijaya.<br>Please do not reply directly to this email.<br><br>&copy; ${new Date().getFullYear()} PT Anugerah Buana Sriwijaya. All rights reserved.</p>
        </div>
      </div>`

      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: doc.customerEmail,
          cc: ccList,
          subject: `Delivery Order ${doc.title} - PT Anugerah Buana Sriwijaya`,
          html: emailHtml,
          attachments,
        }),
      })
      const result = await res.json()
      if (result.success) {
        notify.success(
          dict.MSG_EMAIL_SENT_SUCCESS || "Email Sent",
          dict.MSG_EMAIL_SENT_SUCCESS_DESC?.replace(
            "%data%",
            `[${doc.title}]`
          ) || `Successfully sent email for [${doc.title}].`,
          undefined,
          true
        )
      } else throw new Error(result.error)
    } catch (err: any) {
      notify.error("Failed to send email", err.message)
    }
  }

  // Recalculate total quantity from compartments
  useEffect(() => {
    if (formData.compartment_details.length > 0) {
      const total = formData.compartment_details.reduce(
        (sum, c) => sum + (c.quantity || 0),
        0
      )
      if (total !== formData.quantity && total > 0) {
        setFormData((prev) => ({ ...prev, quantity: total }))
      }
    }
  }, [formData.compartment_details])

  const handleSOSelect = (val: string, item: any) => {
    if (item) {
      setFormData((prev) => ({
        ...prev,
        so_id: val,
        company_id: item.company_id,
        product_id: item.product_id,
        quantity: item.quantity || 0,
        delivery_address: item.delivery_address || "",
      }))
      setSelectedPOInfo(item)
      setSelectedCompanyInfo(item.company)
      setSelectedProductInfo(item.product)
    } else {
      // Clearing SO should also clear company since it messes with filtering
      setFormData((prev) => ({
        ...prev,
        so_id: "",
        company_id: "",
        product_id: "",
        quantity: 0,
        delivery_address: "",
      }))
      setSelectedPOInfo(null)
      setSelectedProductInfo(null)
      setSelectedCompanyInfo(null)
    }
  }

  const isFromSO = !!formData.so_id

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header shrink-0">
        <h1 className="page-title">
          <Truck className="mr-2 inline-block size-5 text-primary" />
          {dict.MENU_DELIVERY_ORDER}
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
              <Button
                size="sm"
                onClick={() => handleOpenDialog()}
                disabled={!canInsert}
              >
                <Plus data-icon="inline-start" />
                {dict.BUTTON_NEW_DO}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-5xl">
              <DialogHeader>
                <DialogTitle>
                  <Truck className="mr-2 inline-block size-5" />
                  {viewOnly
                    ? formData.do_number
                    : editingItem
                      ? dict.BUTTON_EDIT + " DO"
                      : dict.BUTTON_NEW_DO}
                </DialogTitle>
                <DialogDescription />
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSave()
                }}
                id="do-form"
                className="max-h-[70vh] overflow-y-auto relative"
              >
                <div className={cn(`flex flex-col p-5 gap-6 relative w-full ${viewOnly ? "rounded-bl-xl border-2 border-orange-500" : ""}`)}>
                  {viewOnly && (
                    <div className="absolute inset-0 z-20"></div>
                  )}
                  <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                    {/* Group 1: SO Information */}
                    <div className="space-y-6 lg:col-span-1">
                      <div className="space-y-4">
                        <h3 className="flex items-center gap-2 border-b pb-2 text-base font-semibold">
                          <Hash className="size-4 text-primary" />{" "}
                          {dict.LABEL_SO_INFORMATION}
                        </h3>

                        <div className="grid gap-2">
                          <Label htmlFor="donum">{dict.LABEL_DO_NUMBER}</Label>
                          <Input
                            id="donum"
                            value={formData.do_number}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                do_number: e.target.value,
                              })
                            }
                            disabled={
                              editingItem &&
                              !hasPermission("delivery-order", "edit")
                            }
                            placeholder={dict.LABEL_AUTO_GENERATED}
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label className="font-bold text-primary">
                            {dict.LABEL_SO_REQUIRED} *
                          </Label>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <LiveSearch
                                key="so-search"
                                data={
                                  selectedPOInfo
                                    ? [
                                      {
                                        ...selectedPOInfo,
                                        company_name: selectedCompanyInfo?.name,
                                      },
                                    ]
                                    : []
                                }
                                fetchData={async (query) => {
                                  let q = supabase
                                    .from("sales_orders")
                                    .select(
                                      "id, so_number, quantity, so_date, delivery_address, product_id, company_id, company:companies(id, name), product:products(id, sku, name)"
                                    )
                                    .in("status", ["Approved", "Partial"])
                                    .limit(8)
                                  if (query) {
                                    const soSearch = constructMultiWordSearch(query, ["so_number"])
                                    const companySearch = constructMultiWordSearch(query, ["name"])
                                    const { data: companies } = companySearch
                                      ? await supabase
                                        .from("companies")
                                        .select("id")
                                        .contains("type", ["Customer"])
                                        .or(companySearch)
                                      : { data: [] }
                                    const companyIds = (companies || []).map(
                                      (c: any) => c.id
                                    )
                                    const orConditions: string[] = []
                                    if (soSearch)
                                      orConditions.push(soSearch)
                                    if (companyIds.length > 0)
                                      orConditions.push(
                                        `company_id.in.(${companyIds.join(",")})`
                                      )
                                    if (orConditions.length > 0)
                                      q = q.or(orConditions.join(","))
                                    // if (searchStr) q = q.or(searchStr)
                                  }
                                  const { data } = await q
                                  return data || []
                                  // return (data || []).map((d: any) => ({
                                  //   ...d,
                                  //   company_name: d.company?.name || "",
                                  // }))
                                }}
                                value={formData.so_id}
                                onSelect={handleSOSelect}
                                keyField="id"
                                displayField="so_number"
                                defaultDisplay={selectedPOInfo?.so_number || ""}
                                searchColumns={["so_number", "name"]}
                                visualColumns={[
                                  {
                                    key: "so_number",
                                    header: dict.LABEL_SO_NUMBER,
                                    className: "w-1/2",
                                    primary: true,
                                  },
                                  {
                                    key: "company.name",
                                    header: dict.LABEL_COMPANY_NAME,
                                    className: "w-1/2",
                                  },
                                ]}
                                placeholder={dict.PLACEHOLDER_SELECT_SO}
                                emptyMessage={dict.NO_DATA}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-2">
                          <Label>{dict.LABEL_COMPANY_NAME}</Label>
                          <LiveSearch
                            data={
                              selectedCompanyInfo ? [selectedCompanyInfo] : []
                            }
                            disabled={true}
                            fetchData={async () => []}
                            value={formData.company_id}
                            onSelect={() => { }}
                            keyField="id"
                            displayField="name"
                            defaultDisplay={selectedCompanyInfo?.name || ""}
                            searchColumns={[]}
                            visualColumns={[]}
                            placeholder={dict.PLACEHOLDER_FROM_SO}
                            emptyMessage={dict.NO_DATA}
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label className="text-xs">{dict.LABEL_SO_DATE}</Label>
                          <Input
                            value={
                              isFromSO && selectedPOInfo?.so_date
                                ? format(
                                  new Date(selectedPOInfo.so_date),
                                  "dd MMM yyyy"
                                )
                                : ""
                            }
                            disabled
                            className="bg-muted"
                            placeholder={dict.PLACEHOLDER_FROM_SO}
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label>{dict.LABEL_SKU}</Label>
                          <LiveSearch
                            data={
                              selectedProductInfo ? [selectedProductInfo] : []
                            }
                            disabled={true} // Disabled as it's from SO
                            fetchData={async () => []}
                            value={formData.product_id}
                            onSelect={() => { }}
                            keyField="id"
                            displayField={(p) => `${p.sku} - ${p.name}`}
                            defaultDisplay={
                              selectedProductInfo
                                ? selectedProductInfo.sku &&
                                  selectedProductInfo.name
                                  ? `${selectedProductInfo.sku} - ${selectedProductInfo.name}`
                                  : selectedProductInfo.name ||
                                  selectedProductInfo.sku ||
                                  ""
                                : ""
                            }
                            searchColumns={[]}
                            visualColumns={[]}
                            placeholder={dict.PLACEHOLDER_FROM_SO}
                            emptyMessage={dict.NO_DATA}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label>{dict.LABEL_SO_TOTAL_QTY}</Label>
                            <NumberInput
                              value={selectedPOInfo?.quantity || 0}
                              onChange={() => { }}
                              disabled
                              rightBadge="L"
                            />
                          </div>
                          <div className="grid gap-2">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="qty">
                                {dict.LABEL_QTY_DELIVERED}
                              </Label>
                              {remainingSOQty !== null && (
                                <span
                                  className={cn(
                                    "rounded px-2 text-[10px] font-bold",
                                    remainingSOQty > 0
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-red-100 text-red-700"
                                  )}
                                >
                                  {remainingSOQty.toLocaleString()}
                                </span>
                              )}
                            </div>
                            <NumberInput
                              id="qty"
                              value={formData.quantity}
                              onChange={(val) =>
                                setFormData({ ...formData, quantity: val })
                              }
                              rightBadge="L"
                            />
                          </div>
                        </div>

                        <div className="grid gap-2">
                          <Label className="flex items-center gap-2">
                            <MapPin className="size-4" />{" "}
                            {dict.LABEL_DELIVERY_ADDRESS}
                          </Label>
                          {isFromSO &&
                            selectedCompanyInfo?.details?.addresses?.length > 0 ? (
                            <div className="rounded-md border border-input bg-muted px-3 py-2">
                              {(() => {
                                const addrs = selectedCompanyInfo.details
                                  .addresses as {
                                    label: string
                                    address: string
                                  }[]
                                const matched = addrs.find(
                                  (a: any) =>
                                    a.address === formData.delivery_address
                                )
                                return matched ? (
                                  <div className="flex flex-col">
                                    <span className="text-xs font-medium">
                                      {matched.label}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                      {matched.address}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-sm text-muted-foreground">
                                    {formData.delivery_address ||
                                      dict.PLACEHOLDER_FROM_SO}
                                  </span>
                                )
                              })()}
                            </div>
                          ) : (
                            <Input
                              value={formData.delivery_address}
                              disabled={true}
                              className="h-12 bg-muted"
                              placeholder={dict.PLACEHOLDER_FROM_SO}
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Group 2 & 3: Delivery Details & Compartments */}
                    <div className="space-y-6 lg:col-span-2">
                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div className="space-y-4">
                          <h3 className="flex items-center gap-2 border-b pb-2 text-base font-semibold">
                            <Calendar className="size-4 text-primary" />{" "}
                            {dict.LABEL_DELIVERY_DETAILS}
                          </h3>

                          <div className="grid gap-2">
                            <Label className="text-xs">
                              {dict.LABEL_DO_DATE}
                            </Label>
                            <Input
                              type="date"
                              value={formData.do_date}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  do_date: e.target.value,
                                })
                              }
                            />
                          </div>

                          <div className="grid gap-2">
                            <Label>{dict.LABEL_TRANSPORTER}</Label>
                            <LiveSearch
                              data={
                                selectedTransporterInfo
                                  ? [selectedTransporterInfo]
                                  : []
                              }
                              fetchData={async (query) => {
                                let q = supabase
                                  .from("companies")
                                  .select("id, name")
                                  .contains("type", ["Transporter"])
                                  .limit(8)
                                if (query) {
                                  const searchStr = constructMultiWordSearch(query, ["name"])
                                  if (searchStr) q = q.or(searchStr)
                                }
                                const { data } = await q
                                return data || []
                              }}
                              value={formData.transporter_id}
                              onSelect={(val, item) => {
                                setFormData({ ...formData, transporter_id: val })
                                setSelectedTransporterInfo(item)
                              }}
                              keyField="id"
                              displayField="name"
                              defaultDisplay={selectedTransporterInfo?.name || ""}
                              searchColumns={["name"]}
                              visualColumns={[
                                {
                                  key: "name",
                                  header: dict.LABEL_TRANSPORTER,
                                  className: "w-full font-medium",
                                  primary: true,
                                },
                              ]}
                              placeholder={dict.PLACEHOLDER_SELECT_TRANSPORTER}
                              emptyMessage={dict.NO_DATA}
                            />
                          </div>

                          <div className="grid gap-2">
                            <Label className="flex items-center gap-2">
                              <UserIcon className="size-4" />{" "}
                              {dict.LABEL_DRIVER_NAME}
                            </Label>
                            <LiveSearch
                              data={
                                formData.driver_info?.name
                                  ? [
                                    {
                                      name: formData.driver_info.name,
                                      phone: formData.driver_info.phone,
                                    },
                                  ]
                                  : []
                              }
                              fetchData={async (query) => {
                                let q = supabase
                                  .from("delivery_orders")
                                  .select("driver_info")
                                  .limit(50)
                                if (query) {
                                  const searchStr = constructMultiWordSearch(query, [
                                    "driver_info->>name",
                                    "driver_info->>phone",
                                  ])
                                  if (searchStr) q = q.or(searchStr)
                                }
                                const { data } = await q
                                const uniqueDrivers = new Map()
                                  ; (data || []).forEach((d: any) => {
                                    if (
                                      d.driver_info &&
                                      d.driver_info.name &&
                                      !uniqueDrivers.has(d.driver_info.name)
                                    ) {
                                      uniqueDrivers.set(
                                        d.driver_info.name,
                                        d.driver_info
                                      )
                                    }
                                  })
                                return Array.from(uniqueDrivers.values()).slice(
                                  0,
                                  8
                                )
                              }}
                              value={formData.driver_info?.name || ""}
                              onSelect={(val, item) => {
                                setFormData({
                                  ...formData,
                                  driver_info: item || { name: val, phone: "" },
                                })
                              }}
                              keyField="name"
                              displayField="name"
                              defaultDisplay={formData.driver_info?.name || ""}
                              searchColumns={["name", "phone"]}
                              visualColumns={[
                                {
                                  key: "name",
                                  header: "Name",
                                  className: "w-1/2 font-medium",
                                  primary: true,
                                },
                                {
                                  key: "phone",
                                  header: "Phone",
                                  className: "w-1/2 text-xs",
                                },
                              ]}
                              placeholder={dict.PLACEHOLDER_SELECT_DRIVER}
                              emptyMessage={dict.MSG_TYPE_DRIVER_HINT}
                              allowCustomValue={true}
                              onCustomValue={(val) =>
                                setFormData({
                                  ...formData,
                                  driver_info: {
                                    name: val,
                                    phone: formData.driver_info?.phone || "",
                                  },
                                })
                              }
                            />
                          </div>

                          <div className="grid gap-2">
                            <Label className="flex items-center gap-2">
                              <Phone className="size-4" />{" "}
                              {dict.LABEL_DRIVER_PHONE}
                            </Label>
                            <Input
                              value={formData.driver_info?.phone || ""}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  driver_info: {
                                    ...(formData.driver_info || {}),
                                    name: formData.driver_info?.name || "",
                                    phone: e.target.value,
                                  },
                                })
                              }
                              placeholder={dict.PLACEHOLDER_ENTER_DRIVER_PHONE}
                            />
                          </div>
                          <div className="space-y-4">
                            <RichTextEditor
                              label={dict.LABEL_ADDITIONAL_NOTES}
                              value={formData.note}
                              onChange={(val) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  note: val || "",
                                }))
                              }
                              isEnabled={formData.is_note_enabled}
                              onToggleEnabled={(val) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  is_note_enabled: val,
                                }))
                              }
                              placeholder="..."
                            />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h3 className="flex items-center gap-2 border-b pb-2 text-base font-semibold">
                            <Package className="size-4 text-primary" />{" "}
                            {dict.LABEL_LOGISTICS}
                          </h3>

                          <div className="grid gap-2">
                            <div className="flex items-center justify-between">
                              <Label>{dict.LABEL_SUPPLIER_ORIGIN}</Label>
                              {availableStock !== null && (
                                <span
                                  className={cn(
                                    "rounded px-2 text-[10px] font-bold",
                                    availableStock > 0
                                      ? "bg-green-100 text-green-700"
                                      : "bg-red-100 text-red-700"
                                  )}
                                >
                                  {dict.LABEL_STOCK}:{" "}
                                  {availableStock.toLocaleString()}
                                </span>
                              )}
                            </div>
                            <LiveSearch
                              key={`supplier-search-${formData.product_id || "no-prod"}`}
                              data={
                                selectedSupplierInfo ? [selectedSupplierInfo] : []
                              }
                              fetchData={async (query) => {
                                if (!formData.product_id) return []
                                let q = supabase
                                  .from("supplier_stock_summary")
                                  .select("supplier_id, name, product_id, current_stock")
                                  .eq("product_id", formData.product_id)
                                  .gt("current_stock", 0)
                                  .order("current_stock", { ascending: false })
                                  .limit(8)
                                if (query) {
                                  const searchStr = constructMultiWordSearch(query, ["name"])
                                  if (searchStr) q = q.or(searchStr)
                                }
                                // q = q.or(
                                //   `sku.ilike.%${query}%,name.ilike.%${query}%`
                                // )
                                const { data } = await q
                                return data || []
                                // Get stock data first
                                // const { data: stockData } = await stockQ
                                // if (!stockData?.length) return []
                                // availableStock

                                // Then filter suppliers by name if query provided
                                // let supplierIds = stockData.map((s: any) => s.supplier_id)
                                // if (query) {
                                //   const searchStr = constructMultiWordSearch(query, ["name"])
                                //   const { data: matchingCompanies } = searchStr
                                //     ? await supabase
                                //       .from("companies")
                                //       .select("id")
                                //       .contains("type", ["Supplier"])
                                //       .or(searchStr)
                                //     : { data: [] }
                                //   const matchingIds = (matchingCompanies || []).map((c: any) => c.id)
                                //   supplierIds = supplierIds.filter((id: string) => matchingIds.includes(id))
                                // }
                                // if (supplierIds.length === 0) return []

                                // const { data: suppliers } = await supabase
                                //   .from("companies")
                                //   .select("id, name")
                                //   .in("id", supplierIds)
                                // const supplierMap = new Map(
                                //   (suppliers || []).map((c: any) => [c.id, c.name])
                                // )
                                // return stockData
                                //   .filter((s: any) => supplierMap.has(s.supplier_id))
                                //   .map((s: any) => ({
                                //     id: s.supplier_id,
                                //     name: supplierMap.get(s.supplier_id) || "-",
                                //     current_stock: s.current_stock.toLocaleString(),
                                //   }))
                              }}
                              value={formData.supplier_id}
                              onSelect={(val, item) => {
                                setFormData({ ...formData, supplier_id: val })
                                setSelectedSupplierInfo(item)
                              }}
                              keyField="supplier_id"
                              displayField="name"
                              defaultDisplay={selectedSupplierInfo?.name || ""}
                              searchColumns={["name"]}
                              visualColumns={[
                                {
                                  key: "name",
                                  header: dict.LABEL_SUPPLIER_ORIGIN,
                                  className: "w-3/4",
                                  primary: true,
                                },
                                {
                                  key: "current_stock",
                                  header: "Stock",
                                  className: "w-1/4 font-mono text-right",
                                },
                              ]}
                              placeholder={dict.PLACEHOLDER_SELECT_SUPPLIER}
                              emptyMessage={dict.NO_DATA}
                            />
                          </div>

                          <div className="grid gap-2">
                            <Label className="flex items-center gap-2">
                              <Car className="size-4" /> {dict.LABEL_VEHICLE}
                            </Label>
                            <LiveSearch
                              data={
                                selectedVehicleInfo ? [selectedVehicleInfo] : []
                              }
                              fetchData={async (query) => {
                                let q = supabase
                                  .from("vehicles")
                                  .select("*")
                                  .limit(8)
                                if (query) {
                                  const searchStr = constructMultiWordSearch(query, [
                                    "license_number",
                                    "vehicle_type",
                                  ])
                                  if (searchStr) q = q.or(searchStr)
                                }
                                const { data } = await q
                                return data || []
                              }}
                              value={formData.vehicle_id}
                              onSelect={handleVehicleSelect}
                              keyField="id"
                              displayField="license_number"
                              defaultDisplay={
                                selectedVehicleInfo?.license_number || ""
                              }
                              searchColumns={["license_number", "vehicle_type"]}
                              visualColumns={[
                                {
                                  key: "license_number",
                                  header: "License",
                                  className: "w-1/2 font-bold",
                                  primary: true,
                                },
                                {
                                  key: "vehicle_type",
                                  header: "Type",
                                  className: "w-1/2",
                                },
                              ]}
                              placeholder={dict.PLACEHOLDER_SELECT_VEHICLE}
                              emptyMessage={dict.MSG_NO_VEHICLES}
                            />
                          </div>

                          <div className="h-[220px] space-y-3 overflow-y-auto">
                            {formData.compartment_details.length === 0 ? (
                              <div className="rounded-lg border-2 border-dashed p-2 text-center text-muted-foreground">
                                {dict.MSG_SELECT_VEHICLE}
                              </div>
                            ) : (
                              formData.compartment_details.map((comp, idx) => (
                                <Card
                                  key={idx}
                                  className="m-2 p-0 shadow-none ring-0"
                                >
                                  <div className="mb-2 flex items-center gap-3">
                                    <span className="mt-4 text-xl font-bold text-primary">
                                      #{comp.compartment_number}
                                    </span>
                                    <div className="grid w-full gap-1">
                                      <Label className="text-[10px] uppercase">
                                        {dict.LABEL_SEAL_NUMBER}
                                      </Label>
                                      <Input
                                        size={1}
                                        value={comp.seal_number}
                                        onChange={(e) => {
                                          const newDetails = [
                                            ...formData.compartment_details,
                                          ]
                                          newDetails[idx].seal_number =
                                            e.target.value
                                          setFormData({
                                            ...formData,
                                            compartment_details: newDetails,
                                          })
                                        }}
                                      />
                                    </div>
                                    <div className="grid gap-1">
                                      <Label className="text-[10px] uppercase">
                                        {dict.LABEL_QUANTITY}
                                      </Label>
                                      <NumberInput
                                        value={comp.quantity}
                                        onChange={(val) => {
                                          const newDetails = [
                                            ...formData.compartment_details,
                                          ]
                                          newDetails[idx].quantity = val
                                          setFormData({
                                            ...formData,
                                            compartment_details: newDetails,
                                          })
                                        }}
                                        rightBadge="L"
                                      />
                                    </div>
                                  </div>
                                </Card>
                              ))
                            )}
                          </div>
                        </div>
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
                    form="do-form"
                    onClick={() => handleSave()}
                    disabled={isSaving || (editingItem ? !canEdit : !canInsert)}
                  >
                    {isSaving ? (
                      <ButtonLoader />
                    ) : (
                      <Save data-icon="inline-start" />
                    )}{" "}
                    {dict.BUTTON_SAVE_DO}
                  </Button>
                </DialogFooter>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Action Bar / Filters */}
      <div className="action-bar flex shrink-0 flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div className="relative w-full max-w-sm flex-1">
          <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder={dict.PLACEHOLDER_SEARCH}
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Dialog open={isSortOpen} onOpenChange={setIsSortOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              <ArrowUpDown className="mr-2 size-4" />
              {dict.LABEL_SORT}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{dict.TITLE_SORT_SETTINGS}</DialogTitle>
              <DialogDescription />
            </DialogHeader>
            <div className="flex flex-col gap-4 p-5">
              {sortLevels.map((level, index) => (
                <div key={level.id} className="flex items-center gap-3">
                  <div className="w-17 shrink-0 text-sm font-semibold text-muted-foreground">
                    {index === 0 ? dict.LABEL_SORT_BY : dict.LABEL_THEN_BY}
                  </div>
                  <Select
                    value={level.column}
                    onValueChange={(val) =>
                      setSortLevels(
                        sortLevels.map((l) =>
                          l.id === level.id ? { ...l, column: val } : l
                        )
                      )
                    }
                  >
                    <SelectTrigger className="h-9 flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_at">
                        {dict.LABEL_DO_DATE}
                      </SelectItem>
                      <SelectItem value="do_number">
                        {dict.LABEL_DO_NUMBER}
                      </SelectItem>
                      <SelectItem value="quantity">
                        {dict.LABEL_QUANTITY}
                      </SelectItem>
                      <SelectItem value="status">
                        {dict.LABEL_STATUS}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={() =>
                      setSortLevels(
                        sortLevels.map((l) =>
                          l.id === level.id
                            ? {
                              ...l,
                              direction:
                                l.direction === "asc" ? "desc" : "asc",
                            }
                            : l
                        )
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
                    disabled={sortLevels.length <= 1}
                    onClick={() => {
                      if (sortLevels.length > 1)
                        setSortLevels(
                          sortLevels.filter((l) => l.id !== level.id)
                        )
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="mt-2 w-fit"
                onClick={() =>
                  setSortLevels([
                    ...sortLevels,
                    {
                      id: Math.random().toString(),
                      column: "created_at",
                      direction: "asc",
                    },
                  ])
                }
              >
                <Plus className="mr-2 size-4" />
                {dict.BUTTON_ADD_LEVEL}
              </Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsSortOpen(false)}>
                {dict.BUTTON_CANCEL}
              </Button>
              <Button onClick={() => setIsSortOpen(false)}>
                {dict.LABEL_APPLY}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Data Area */}
      <Card
        ref={containerRef}
        className="data-card custom-scrollbar flex-1 overflow-auto"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-7">{dict.LABEL_DO_NUMBER}</TableHead>
              <TableHead>{dict.LABEL_COMPANY_NAME}</TableHead>
              <TableHead>{dict.LABEL_DO_DATE}</TableHead>
              <TableHead>{dict.LABEL_VEHICLE}</TableHead>
              <TableHead className="text-right">
                {dict.LABEL_QUANTITY}
              </TableHead>
              <TableHead className="text-center">{dict.LABEL_STATUS}</TableHead>
              <TableHead className="text-right"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="p-0">
                  <SectionLoader />
                </TableCell>
              </TableRow>
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-10 text-center text-muted-foreground"
                >
                  {dict.NO_DATA}
                </TableCell>
              </TableRow>
            ) : (
              orders.map((o) => (
                <TableRow
                  key={o.id}
                  className="group cursor-pointer"
                  onDoubleClick={() => handleOpenDialog(o, true)}
                >
                  <TableCell className="font-medium">{o.do_number}</TableCell>
                  <TableCell>{o.company?.name || "-"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(o.do_date), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium">
                        {o.vehicle?.license_number || o.vehicle_number || "-"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {o.driver_info?.name || o.driver_name || "-"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {o.quantity.toLocaleString()}
                  </TableCell>
                  <TableCell className="align-middle text-center">
                    <div
                      className={cn(
                        "inline-flex items-center justify-center w-20 rounded-full px-2 py-1 text-[10px] font-bold uppercase",
                        statusStyles[o.status] || statusStyles.Draft
                      )}
                    >
                      {o.status}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="table_action"
                        size="sm"
                        onClick={() => handleOpenDialog(o)}
                        disabled={!canEdit}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="table_action"
                        size="sm"
                        onClick={() => handlePrint(o)}
                        disabled={!canPrint}
                      >
                        <Printer className="size-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="secondary"
                            size="icon"
                            className="size-8"
                          >
                            <ChevronDown className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <CheckCircle2 className="mr-2 size-4" />{" "}
                              {dict.LABEL_STATUS}
                            </DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                              <DropdownMenuSubContent>
                                <DropdownMenuItem
                                  onClick={() => updateStatus(o.id, "Draft")}
                                  className="font-medium text-zinc-600 dark:text-zinc-400"
                                  disabled={!canEdit}
                                >
                                  Draft
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => updateStatus(o.id, "Shipped")}
                                  className="font-medium text-blue-600 dark:text-blue-400"
                                  disabled={!canEdit}
                                >
                                  Shipped
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    updateStatus(o.id, "Delivered")
                                  }
                                  className="font-medium text-emerald-600 dark:text-emerald-400"
                                  disabled={!canEdit}
                                >
                                  Delivered
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    updateStatus(o.id, "Cancelled")
                                  }
                                  className="font-medium text-rose-600 dark:text-rose-400"
                                  disabled={!canEdit}
                                >
                                  Cancelled
                                </DropdownMenuItem>
                              </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                          </DropdownMenuSub>
                          {canDelete && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                onClick={() => handleDelete(o.id)}
                              >
                                <Trash2 className="mr-2 size-4" />{" "}
                                {dict.BUTTON_DELETE}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}

            {/* Infinite Scroll Sentinel & Loader */}
            <TableRow ref={observerTarget} className="border-0">
              <TableCell colSpan={7} className="overflow-hidden border-0 p-0">
                {loadingMore && (
                  <div className="relative h-24 w-full">
                    <SectionLoader />
                  </div>
                )}
                {!hasMore && orders.length > 0 && !loading && (
                  <div className="py-3 text-center text-xs text-danger/70 select-none">
                    — End of data —
                  </div>
                )}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>

      {previewDoc && (
        <Gallery
          docs={[previewDoc]}
          initialIndex={0}
          labels={{
            previewDocument: dict.LABEL_PREVIEW_DO,
            clickToPreview: dict.LABEL_CLICK_PREVIEW,
            previousPage: dict.LABEL_PREVIOUS,
            nextPage: dict.LABEL_NEXT,
            pageLabel: dict.LABEL_PAGE,
            closePreview: dict.LABEL_CLOSE,
            download: dict.LABEL_DOWNLOAD_PDF,
            sendEmail: dict.LABEL_SEND_EMAIL,
            confirmEmail: dict.MSG_CONFIRM_EMAIL_DO,
          }}
          onDownload={(doc) => {
            if (!doc.pdf) return
            const link = document.createElement("a")
            link.href = doc.pdf
            link.download = `DO_${doc.title}.pdf`
            link.click()
            notify.success(
              dict.MSG_PRINT_SUCCESS,
              dict.MSG_PRINT_SUCCESS_DESC.replace("%data%", `[${doc.title}]`),
              undefined,
              false
            )
          }}
          onSendEmail={handleSendEmail}
          onClose={() => setPreviewDoc(null)}
        />
      )}

      <DeleteConfirmationDialog
        isOpen={deleteConfirm !== null}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        onConfirm={confirmDelete}
        title={dict.TITLE_DELETE || "Confirm Delete"}
        description={
          dict.MSG_DELETE_CONFIRM?.split("%data%")[0] ||
          "Are you sure you want to delete this item? This action cannot be undone."
        }
        dataName={deleteConfirm?.name}
        confirmText={dict.BUTTON_DELETE || "Delete"}
      />
    </div>
  )
}
