"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useAuth } from "@/components/auth-provider"
import { useDictionary } from "@/components/dictionary-provider"
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
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Save,
  X,
  Clock,
  Pencil,
  UserCog,
  AlertCircle,
  Users,
  UserPlus,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SummaryCard } from "@/components/summary-card"
import { DeleteConfirmationDialog } from "@/components/confirmation-dialog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

import { SectionLoader } from "@/components/section-loader"
import { ButtonLoader } from "@/components/button-loader"
import { usePersistedState } from "@/hooks/use-persisted-state"

import { formatDateTime } from "@/lib/formatters"
import { cn } from "@/lib/utils"
import { notify } from "@/lib/notifications"

const supabase = createClient()

export default function UsersPage() {
  const { dict, lang } = useDictionary()
  const { profile, loading: authLoading, hasPermission } = useAuth()

  const [users, setUsers] = useState<any[]>([])
  const [roles, setRoles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    pendingUsers: 0,
  })

  const [isDialogOpen, setIsDialogOpen] = usePersistedState(
    "users_dialog_open",
    false
  )
  const [editingUser, setEditingUser] = usePersistedState<any>(
    "users_editing_data",
    null
  )
  const [isCustomizing, setIsCustomizing] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string
    name: string
    type: "approve" | "revoke"
  } | null>(null)

  const moduleCategories = [
    {
      label: dict.MENU_GROUP_MASTER || "Master Data",
      modules: ["companies", "products", "vehicles", "funders"],
    },
    {
      label: dict.MENU_TRANSACTION || "Transactions",
      modules: [
        "quotation",
        "sales-order",
        "delivery-order",
        "deposit",
        "invoice",
        "payments",
      ],
    },
    {
      label: dict.MENU_GROUP_REPORTS || "Reports",
      modules: ["inventory", "shipments"],
    },
    {
      label: dict.MENU_GROUP_SYSTEM || "System",
      modules: ["users", "settings", "component-test"],
    },
  ]
  const actions = ["view", "insert", "edit", "delete", "print"]

  // Permission Checks
  const canView = hasPermission("users", "view")
  const canEdit = hasPermission("users", "edit")
  const canDelete = hasPermission("users", "delete")

  const fetchStats = useCallback(async () => {
    try {
      const [
        { count: totalCount },
        { count: activeCount },
        { count: pendingCount },
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true),
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .is("last_login", null)
          .eq("is_active", false),
      ])

      setStats({
        totalUsers: totalCount || 0,
        activeUsers: activeCount || 0,
        pendingUsers: pendingCount || 0,
      })
    } catch (err) {
      console.error("Fetch Users Stats Error:", err)
    }
  }, [])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      fetchStats()
      const [userRes, roleRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.from("role_permissions").select("role"),
      ])

      if (userRes.data) {
        const sortedUsers = [...userRes.data].sort((a, b) => {
          const getStatusScore = (u: any) => {
            if (!u.last_login && !u.is_active) return 0 // Pending
            if (u.last_login && !u.is_active) return 1 // Deactivated
            return 2 // Active
          }
          const scoreA = getStatusScore(a)
          const scoreB = getStatusScore(b)
          if (scoreA !== scoreB) return scoreA - scoreB
          return (a.role || "").localeCompare(b.role || "")
        })
        setUsers(sortedUsers)

        // Use functional update to avoid dependency on editingUser
        setEditingUser((prev: any) => {
          if (!prev) return prev
          const updated = sortedUsers.find((u) => u.id === prev.id)
          return updated ? { ...updated } : prev
        })
      }

      if (roleRes.data) {
        setRoles(roleRes.data.map((r: any) => r.role))
      }
    } catch (err) {
      console.error("Users: Fetch data unexpected error:", err)
    } finally {
      setLoading(false)
    }
  }, [setEditingUser])

  useEffect(() => {
    if (profile && canView) {
      fetchData()
    }
  }, [profile, canView, fetchData])

  const getStatusInfo = (user: any) => {
    if (!user.last_login && !user.is_active) {
      return {
        label: dict.LABEL_PENDING,
        color: "text-amber-600 dark:text-amber-400",
        icon: ShieldAlert,
        bg: "bg-amber-100 dark:bg-amber-900/30",
      }
    }
    if (user.last_login && !user.is_active) {
      return {
        label: dict.LABEL_DEACTIVATED,
        color: "text-red-600 dark:text-red-400",
        icon: ShieldX,
        bg: "bg-red-100 dark:bg-red-900/30",
      }
    }
    return {
      label: dict.LABEL_ACTIVE,
      color: "text-emerald-600 dark:text-emerald-400",
      icon: ShieldCheck,
      bg: "bg-emerald-100 dark:bg-emerald-900/30",
    }
  }

  const handleEdit = (user: any) => {
    setEditingUser({ ...user, role: user.role || undefined })
    setIsCustomizing(!!user.permissions) // If permissions field is not null, customization is ON
    setIsDialogOpen(true)
  }

  const handlePermissionChange = (
    module: string,
    action: string,
    value: boolean
  ) => {
    if (!isCustomizing) return
    const updatedPermissions = { ...editingUser.permissions }
    if (!updatedPermissions[module]) {
      updatedPermissions[module] = {
        view: false,
        insert: false,
        edit: false,
        delete: false,
        print: false,
      }
    }

    const modulePerms = { ...updatedPermissions[module] }

    if (action === "view" && !value) {
      // Logic: Unchecking "view" unchecks all permissions for this module
      actions.forEach((a) => {
        modulePerms[a] = false
      })
    } else {
      // Update the target action
      modulePerms[action] = value

      // Logic: Checking any other permission automatically checks "view"
      if (value && action !== "view") {
        modulePerms.view = true
      }
    }

    updatedPermissions[module] = modulePerms
    setEditingUser({ ...editingUser, permissions: updatedPermissions })
  }

  const handleRoleChange = async (role: string) => {
    try {
      const { data: roleInfo } = await supabase
        .from("role_permissions")
        .select("permissions")
        .eq("role", role)
        .single()

      setEditingUser((prev: any) => ({
        ...prev,
        role: role,
        // If customizing, we keep current permissions, if not, it will be null on save anyway
        // But for UI preview, we might want to show role perms if not customizing
        permissions: isCustomizing
          ? prev.permissions
          : roleInfo?.permissions || prev.permissions,
      }))
    } catch (err) {
      console.error("Unexpected error in handleRoleChange:", err)
    }
  }

  const handleCustomizationToggle = (checked: boolean) => {
    setIsCustomizing(checked)
    // If turning ON, we keep whatever was there or initialize with current role permissions if possible
    // If turning OFF, UI will disable but we don't nullify until SAVE
  }

  const handleApproveToggle = async () => {
    if (!editingUser) return
    setDeleteConfirm({
      id: editingUser.id,
      name: editingUser.full_name || editingUser.username,
      type: editingUser.is_active ? "revoke" : "approve",
    })
  }

  const confirmApproveToggle = async () => {
    if (!deleteConfirm || !editingUser) return
    setIsApproving(true)
    try {
      const response = await fetch("/api/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: editingUser.id,
          email: editingUser.email,
          fullName: editingUser.full_name,
          phone: editingUser.phone,
          action: deleteConfirm.type,
        }),
      })
      const result = await response.json()
      if (result.error) {
        alert(result.error)
      } else {
        await fetchData()
      }
    } catch (err) {
      console.error("Approval Toggle Unexpected Error:", err)
      alert("An unexpected error occurred.")
    } finally {
      setIsApproving(false)
      setDeleteConfirm(null)
    }
  }

  const handleSave = async () => {
    // Validate required fields
    if (!editingUser?.full_name?.trim()) {
      notify.error("Validation Error", "Full name is required.")
      return
    }
    if (!editingUser?.phone?.trim()) {
      notify.error("Validation Error", "Phone is required.")
      return
    }
    if (!editingUser?.role) {
      notify.error("Validation Error", "Role is required.")
      return
    }

    try {
      setIsSaving(true)
      const trimmed = (editingUser.phone || "").trim()
      let formattedPhone = ""
      if (trimmed.startsWith("+")) {
        formattedPhone = "+" + trimmed.replace(/\D/g, "")
      } else {
        let digits = trimmed.replace(/\D/g, "")
        if (digits.startsWith("0")) {
          formattedPhone = "+62" + digits.substring(1)
        } else if (digits.startsWith("62")) {
          formattedPhone = "+" + digits
        } else if (digits.length > 0) {
          formattedPhone = "+62" + digits
        }
      }

      const updateData = {
        role: editingUser.role,
        // If customizing is OFF, save null to fallback to role permissions
        permissions: isCustomizing ? editingUser.permissions : null,
        full_name: editingUser.full_name,
        phone: formattedPhone,
      }

      console.log("Users: [DEBUG] Attempting update for ID:", editingUser.id)
      console.log("Users: [DEBUG] Update payload:", updateData)

      const { data, error, status, statusText } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", editingUser.id)
        .select()

      console.log(
        "Users: [DEBUG] Supabase response status:",
        status,
        statusText
      )

      if (error) {
        console.error("Users: [DEBUG] Update error:", error)
        throw error
      }

      if (!data || data.length === 0) {
        console.warn(
          "Users: [DEBUG] Update succeeded but no rows were affected. Check RLS policies."
        )
      } else {
        console.log("Users: [DEBUG] Update successful, row affected:", data[0])
      }

      setIsDialogOpen(false)
      await fetchData()
    } catch (err: any) {
      console.error("Users: Save error:", err)
      alert(err.message || "Failed to save user.")
    } finally {
      setIsSaving(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <SectionLoader />
      </div>
    )
  }

  if (!canView) {
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
      <div className="page-header">
        <h1 className="page-title">
          <UserCog className="mr-2 inline-block size-5 text-primary" />
          {dict.TITLE_USER_MGMT}
        </h1>
      </div>

      <div className="mb-6 grid shrink-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard
          label={dict.LABEL_TOTAL_USERS || "Total Users"}
          value={stats.totalUsers}
          icon={Users}
          color="primary"
        />
        <SummaryCard
          label={dict.LABEL_ACTIVE || "Active Users"}
          value={stats.activeUsers}
          icon={ShieldCheck}
          color="green"
        />
        <SummaryCard
          label={dict.LABEL_PENDING || "Pending Approval"}
          value={stats.pendingUsers}
          icon={ShieldAlert}
          color="amber"
        />
      </div>

      {/* Data Area */}
      <Card className="data-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-7">
                {dict.LABEL_USERNAME_FIELD || "Username"}
              </TableHead>
              <TableHead>{dict.LABEL_EMAIL}</TableHead>
              <TableHead>{dict.LABEL_FULL_NAME}</TableHead>
              <TableHead>{dict.LABEL_ROLE}</TableHead>
              <TableHead>{dict.LABEL_STATUS}</TableHead>
              <TableHead className="text-right"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="p-0">
                  <SectionLoader />
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center">
                  {dict.NO_DATA}
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => {
                const status = getStatusInfo(u)
                const StatusIcon = status.icon

                return (
                  <TableRow key={u.id} className="group">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "size-2 rounded-full",
                            u.is_active
                              ? "bg-green-500"
                              : "bg-muted-foreground/30"
                          )}
                        />
                        <span>{u.username}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {u.email}
                    </TableCell>
                    <TableCell className="text-sm">{u.full_name}</TableCell>
                    <TableCell>
                      <span className="rounded-md bg-secondary/50 px-2 py-0.5 text-xs font-semibold capitalize">
                        {u.role}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${status.bg} ${status.color}`}
                      >
                        <StatusIcon className="mr-1.5 size-3" />
                        {status.label}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="table_action"
                        size="sm"
                        onClick={() => handleEdit(u)}
                        disabled={!canEdit}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* User Management Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              <UserCog className="mr-2 inline-block size-5" />
              {dict.TITLE_MANAGE_USER}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid gap-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>{dict.LABEL_USERNAME_FIELD || "Username"}</Label>
                  <Input
                    value={editingUser?.username || ""}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>{dict.LABEL_EMAIL || "Email"}</Label>
                  <Input
                    value={editingUser?.email || ""}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>
                    {dict.LABEL_FULL_NAME}
                    <span className="text-destructive ml-0.5">*</span>
                  </Label>
                  <Input
                    value={editingUser?.full_name || ""}
                    onChange={(e) =>
                      setEditingUser({
                        ...editingUser,
                        full_name: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>
                    {dict.LABEL_PHONE}
                    <span className="text-destructive ml-0.5">*</span>
                  </Label>
                  <Input
                    value={editingUser?.phone || ""}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, phone: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label>
                  {dict.LABEL_ROLE}
                  <span className="text-destructive ml-0.5">*</span>
                </Label>
                <Select
                  value={editingUser?.role}
                  onValueChange={handleRoleChange}
                >
                  <SelectTrigger className="w-full capitalize">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r} value={r} className="capitalize">
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-4 rounded-lg border bg-muted/30 p-4">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold">
                    {dict.LABEL_ACC_APPROVAL}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {editingUser?.auth_id === profile?.auth_id
                      ? "You cannot revoke your own account access."
                      : dict.DESC_ACC_APPROVAL}
                  </p>
                </div>
                <Button
                  variant={editingUser?.is_active ? "destructive" : "default"}
                  onClick={handleApproveToggle}
                  disabled={
                    isApproving ||
                    editingUser?.auth_id === profile?.auth_id ||
                    !canEdit
                  }
                >
                  {isApproving ? (
                    <ButtonLoader />
                  ) : editingUser?.is_active ? (
                    dict.BUTTON_REVOKE
                  ) : (
                    dict.BUTTON_APPROVE
                  )}
                </Button>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="font-bold">{dict.LABEL_GRANULAR_PERMS}</h3>
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="customize-toggle"
                      className="cursor-pointer text-xs font-semibold"
                    >
                      {lang === "id"
                        ? "Sesuaikan Izin"
                        : "Customize Permission"}
                    </Label>
                    <Switch
                      id="customize-toggle"
                      checked={isCustomizing}
                      onCheckedChange={handleCustomizationToggle}
                      disabled={!canEdit}
                    />
                  </div>
                </div>

                <div
                  className={cn(
                    "mb-2 grid grid-cols-[150px_repeat(5,1fr)] gap-2 px-2 text-center text-xs font-bold text-muted-foreground",
                    !isCustomizing && "opacity-50"
                  )}
                >
                  <div className="text-left">{dict.LABEL_MODULE}</div>
                  {actions.map((a) => (
                    <div key={a} className="capitalize">
                      {a}
                    </div>
                  ))}
                </div>

                {moduleCategories.map((cat, catIdx) => (
                  <div key={catIdx} className="space-y-1">
                    <div className="rounded bg-muted/50 px-2 py-1 text-[10px] font-black tracking-widest text-muted-foreground uppercase">
                      {cat.label}
                    </div>
                    {cat.modules.map((m) => (
                      <div
                        key={m}
                        className={cn(
                          "grid grid-cols-[150px_repeat(5,1fr)] items-center gap-2 border-b border-muted/30 px-2 py-2 transition-opacity hover:bg-muted/10",
                          !isCustomizing && "opacity-50 grayscale-[0.5]"
                        )}
                      >
                        <div className="text-sm font-medium capitalize">
                          {m.replace("-", " ")}
                        </div>
                        {actions.map((a) => (
                          <div key={a} className="flex justify-center">
                            <input
                              type="checkbox"
                              className="size-4 cursor-pointer accent-primary disabled:cursor-not-allowed"
                              checked={
                                editingUser?.permissions?.[m]?.[a] || false
                              }
                              onChange={(e) =>
                                handlePermissionChange(m, a, e.target.checked)
                              }
                              disabled={!canEdit || !isCustomizing}
                            />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t p-6">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              className="flex-1"
            >
              <X className="mr-2 size-4" /> {dict.BUTTON_CANCEL}
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1"
              disabled={isSaving || !canEdit}
            >
              {isSaving ? <ButtonLoader /> : <Save className="mr-2 size-4" />}
              {dict.BUTTON_SAVE}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        isOpen={deleteConfirm !== null}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        onConfirm={confirmApproveToggle}
        title={
          deleteConfirm?.type === "revoke"
            ? dict.BUTTON_REVOKE || "Revoke Access"
            : dict.BUTTON_APPROVE || "Approve Access"
        }
        description={
          deleteConfirm?.type === "revoke"
            ? `Are you sure you want to revoke access for this user?`
            : `Are you sure you want to approve access for this user?`
        }
        dataName={deleteConfirm?.name}
        confirmText={
          deleteConfirm?.type === "revoke"
            ? dict.BUTTON_REVOKE || "Revoke"
            : dict.BUTTON_APPROVE || "Approve"
        }
        cancelText={dict.BUTTON_CANCEL || "Cancel"}
        variant={deleteConfirm?.type === "revoke" ? "destructive" : "default"}
      />
    </div>
  )
}
