"use client"

import { useState, useEffect, useMemo } from "react"
import { useDictionary } from "@/components/dictionary-provider"
import { useAuth } from "@/components/auth-provider"
import { createClient } from "@/lib/supabase"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
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
  PlusCircle,
  MinusCircle
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { SectionLoader } from "@/components/section-loader"
import { notify } from "@/lib/notifications"

export default function VehiclesPage() {
  const { dict } = useDictionary()
  const { hasPermission, profile } = useAuth()
  const supabase = createClient()
  
  const [vehicles, setVehicles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Dialog State
  const [isOpen, setIsOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  
  // Filter States
  const [searchQuery, setSearchQuery] = useState("")

  // Form State
  const [formData, setFormData] = useState({
    license_number: "",
    vehicle_type: "Truck",
    capacity: 0,
    is_active: true,
    compartments: [] as { compartment_number: number; capacity: number }[]
  })

  // Fetch Data
  async function fetchData() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) throw error
      setVehicles(data || [])
    } catch (err: any) {
      notify.error(dict.MSG_DATA_FETCH_FAILED, err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Permission Checks
  const canEdit = hasPermission("vehicles", "edit") || profile?.role === "admin" || profile?.role === "boss"
  const canDelete = hasPermission("vehicles", "delete") || profile?.role === "admin" || profile?.role === "boss"

  // Open Dialog
  const handleOpenDialog = (item: any = null) => {
    if (item) {
      setEditingItem(item)
      setFormData({
        license_number: item.license_number,
        vehicle_type: item.vehicle_type || "Truck",
        capacity: item.capacity || 0,
        is_active: item.is_active ?? true,
        compartments: (item.compartments || []).map((c: any) => ({
          compartment_number: c.number,
          capacity: c.capacity
        }))
      })
    } else {
      setEditingItem(null)
      setFormData({
        license_number: "",
        vehicle_type: "Truck",
        capacity: 0,
        is_active: true,
        compartments: [{ compartment_number: 1, capacity: 8000 }]
      })
    }
    setIsOpen(true)
  }

  // Actions
  const handleSave = async () => {
    try {
      const payload = {
        license_number: formData.license_number,
        vehicle_type: formData.vehicle_type,
        capacity: formData.capacity,
        is_active: formData.is_active,
        compartments: formData.compartments.map(c => ({
          number: c.compartment_number,
          capacity: c.capacity
        }))
      }
      
      if (editingItem) {
        const { error } = await supabase.from("vehicles").update(payload).eq("id", editingItem.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from("vehicles").insert([payload])
        if (error) throw error
      }

      notify.success(dict.MSG_SAVE_SUCCESS.replace("%data%", dict.MENU_VEHICLES))
      setIsOpen(false)
      fetchData()
    } catch (err: any) {
      notify.error(dict.MSG_SAVE_FAILED, err.message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(dict.MSG_DELETE_CONFIRM)) return
    try {
      const { error } = await supabase.from("vehicles").delete().eq("id", id)
      if (error) throw error
      notify.success(dict.MSG_UPDATE_SUCCESS.replace("%data%", dict.MENU_VEHICLES))
      fetchData()
    } catch (err: any) {
      notify.error(dict.MSG_SAVE_FAILED, err.message)
    }
  }

  const addCompartment = () => {
    const nextNum = formData.compartments.length + 1
    setFormData({
      ...formData,
      compartments: [...formData.compartments, { compartment_number: nextNum, capacity: 0 }]
    })
  }

  const removeCompartment = (idx: number) => {
    const newComps = formData.compartments.filter((_, i) => i !== idx)
    // Re-index
    const reindexed = newComps.map((c, i) => ({ ...c, compartment_number: i + 1 }))
    setFormData({ ...formData, compartments: reindexed })
  }

  // Search filter
  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => 
      v.license_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.vehicle_type || "").toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [vehicles, searchQuery])

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <Truck className="size-5 text-primary" />
          {dict.MENU_VEHICLES}
        </h1>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="size-4 mr-2" />
          {dict.BUTTON_ADD}
        </Button>
      </div>

      <div className="action-bar flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative flex-1 w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input 
            placeholder={dict.SEARCH_PLACEHOLDER} 
            className="pl-9" 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Card className="data-card">
        <Table>
          <TableHeader className="bg-muted/30 sticky top-0 z-10">
            <TableRow>
              <TableHead>License Number</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Compartments</TableHead>
              <TableHead>Total Capacity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">{dict.LABEL_ACTIONS}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="p-0"><SectionLoader /></TableCell>
              </TableRow>
            ) : filteredVehicles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">{dict.NO_DATA}</TableCell>
              </TableRow>
            ) : filteredVehicles.map(v => (
              <TableRow key={v.id}>
                <TableCell className="font-bold">{v.license_number}</TableCell>
                <TableCell>{v.vehicle_type}</TableCell>
                <TableCell>{v.compartments?.length || 0} Comp.</TableCell>
                <TableCell>{v.capacity?.toLocaleString()}</TableCell>
                <TableCell>
                  <div className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase w-fit",
                    v.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  )}>
                    {v.is_active ? dict.LABEL_ACTIVE : dict.LABEL_DEACTIVATED}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => handleOpenDialog(v)}>
                      <Pencil className="size-4" />
                    </Button>
                    {canDelete && (
                      <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => handleDelete(v.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Vehicle Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="flex flex-col w-full max-w-2xl max-h-[90vh] rounded-xl bg-background text-sm ring-1 ring-border shadow-2xl overflow-hidden">
            <div className="flex flex-row items-center justify-between gap-2 bg-primary px-5 py-4 text-primary-foreground shrink-0">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Truck className="size-5" />
                {editingItem ? dict.BUTTON_EDIT : dict.BUTTON_ADD} {dict.MENU_VEHICLES}
              </h2>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsOpen(false)} 
                className="size-8 rounded-full hover:bg-white/20 text-white"
              >
                <X className="size-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="license">License Number</Label>
                  <Input
                    id="license"
                    value={formData.license_number}
                    onChange={e => setFormData({ ...formData, license_number: e.target.value.toUpperCase() })}
                    placeholder="B 1234 XYZ"
                    className="font-bold"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="type">Vehicle Type</Label>
                  <Input
                    id="type"
                    value={formData.vehicle_type}
                    onChange={e => setFormData({ ...formData, vehicle_type: e.target.value })}
                    placeholder="e.g. Tanker, Truck"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="total_cap">Total Capacity</Label>
                  <Input
                    id="total_cap"
                    type="number"
                    value={formData.capacity}
                    onChange={e => setFormData({ ...formData, capacity: Number(e.target.value) })}
                  />
                </div>
                <div className="flex items-center gap-2 mt-auto pb-2">
                  <input
                    type="checkbox"
                    id="active"
                    checked={formData.is_active}
                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                    className="size-4"
                  />
                  <Label htmlFor="active" className="cursor-pointer">Active</Label>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="font-semibold text-base flex items-center gap-2">
                    <Package className="size-4 text-primary" /> {dict.LABEL_COMPARTMENTS}
                  </h3>
                  <Button variant="outline" size="sm" onClick={addCompartment}>
                    <PlusCircle className="size-4 mr-1" /> Add
                  </Button>
                </div>

                <div className="space-y-3">
                  {formData.compartments.map((comp, idx) => (
                    <div key={idx} className="flex items-center gap-4 bg-muted/20 p-3 rounded-lg border border-border/50">
                      <div className="flex items-center gap-2 font-bold text-primary min-w-[80px]">
                        <Hash className="size-3" /> {comp.compartment_number}
                      </div>
                      <div className="flex-1 grid gap-1">
                        <Label className="text-[10px] uppercase">Capacity</Label>
                        <Input
                          type="number"
                          className="h-8"
                          value={comp.capacity}
                          onChange={e => {
                            const newComps = [...formData.compartments]
                            newComps[idx].capacity = Number(e.target.value)
                            setFormData({ ...formData, compartments: newComps })
                          }}
                        />
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="size-8 text-destructive self-end"
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

            <div className="flex flex-col sm:flex-row justify-end gap-3 border-t shrink-0 bg-muted/30 px-6 py-4">
              <Button variant="outline" onClick={() => setIsOpen(false)} className="px-8">{dict.BUTTON_CANCEL}</Button>
              <Button onClick={handleSave} className="px-10 font-bold">
                <Save className="size-4 mr-2" />
                {dict.BUTTON_SAVE}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
