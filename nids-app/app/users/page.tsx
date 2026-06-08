"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { useDictionary } from "@/components/dictionary-provider"
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
import { ShieldCheck, ShieldAlert, ShieldX, Save, X, Clock, Pencil, UserCog } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"

import { SectionLoader } from "@/components/section-loader"
import { ButtonLoader } from "@/components/button-loader"
import { usePersistedState } from "@/hooks/use-persisted-state"

import { formatDateTime } from "@/lib/formatters"
import { cn } from "@/lib/utils"

const supabase = createClient()

export default function UsersPage() {
  const { dict } = useDictionary()
  const { profile, loading: authLoading, hasPermission } = useAuth()

  const [users, setUsers] = useState<any[]>([])
  const [roles, setRoles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = usePersistedState("users_dialog_open", false)
  const [editingUser, setEditingUser] = usePersistedState<any>("users_editing_data", null)

  const modules = ['companies', 'products', 'deposit', 'quotation', 'purchase-order', 'delivery-order', 'invoice', 'payments', 'shipments', 'users', 'settings', 'component-test']
  const actions = ['view', 'insert', 'edit', 'delete', 'print']

  const getStatusInfo = (user: any) => {
    if (!user.last_login && !user.is_active) {
      return {
        label: dict.LABEL_PENDING,
        color: "text-amber-600 dark:text-amber-400",
        icon: ShieldAlert,
        bg: "bg-amber-100 dark:bg-amber-900/30"
      }
    }
    if (user.last_login && !user.is_active) {
      return {
        label: dict.LABEL_DEACTIVATED,
        color: "text-red-600 dark:text-red-400",
        icon: ShieldX,
        bg: "bg-red-100 dark:bg-red-900/30"
      }
    }
    return {
      label: dict.LABEL_ACTIVE,
      color: "text-emerald-600 dark:text-emerald-400",
      icon: ShieldCheck,
      bg: "bg-emerald-100 dark:bg-emerald-900/30"
    }
  }

  const [isApproving, setIsApproving] = useState(false)

  async function fetchData() {
    try {
      setLoading(true)
      const [userRes, roleRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('role_permissions').select('role')
      ])

      if (userRes.data) {
        const sortedUsers = [...userRes.data].sort((a, b) => {
          const getStatusScore = (u: any) => {
            if (!u.last_login && !u.is_active) return 0 // Pending
            if (u.last_login && !u.is_active) return 1  // Deactivated
            return 2 // Active
          }
          const scoreA = getStatusScore(a)
          const scoreB = getStatusScore(b)
          if (scoreA !== scoreB) return scoreA - scoreB
          return (a.role || "").localeCompare(b.role || "")
        })
        setUsers(sortedUsers)
        if (editingUser) {
          const updated = sortedUsers.find(u => u.id === editingUser.id)
          if (updated) setEditingUser(updated)
        }
      }

      if (roleRes.data) {
        setRoles(roleRes.data.map((r: any) => r.role))
      }
    } catch (err) {
      console.error("Users: Fetch data unexpected error:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (profile && hasPermission('users', 'view')) {
      fetchData()
    }
  }, [profile])

  const handleEdit = (user: any) => {
    setEditingUser({ ...user, role: user.role || undefined })
    setIsDialogOpen(true)
  }

  const handlePermissionChange = (module: string, action: string, value: boolean) => {
    const updatedPermissions = { ...editingUser.permissions }
    if (!updatedPermissions[module]) {
      updatedPermissions[module] = { view: false, insert: false, edit: false, delete: false, print: false }
    }
    updatedPermissions[module][action] = value
    setEditingUser({ ...editingUser, permissions: updatedPermissions })
  }

  const handleRoleChange = async (role: string) => {
    try {
      const { data: roleInfo } = await supabase
        .from('role_permissions')
        .select('permissions')
        .eq('role', role)
        .single()

      setEditingUser((prev: any) => ({
        ...prev,
        role: role,
        permissions: roleInfo?.permissions || prev.permissions
      }))
    } catch (err) {
      console.error("Unexpected error in handleRoleChange:", err)
    }
  }

  const handleApproveToggle = async () => {
    if (!editingUser) return
    setIsApproving(true)
    try {
      const response = await fetch('/api/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: editingUser.id,
          email: editingUser.email,
          fullName: editingUser.full_name,
          phone: editingUser.phone,
          action: editingUser.is_active ? 'revoke' : 'approve'
        })
      })
      const result = await response.json()
      setIsApproving(false)
      if (result.error) {
        alert(result.error)
      } else {
        await fetchData()
      }
    } catch (err) {
      console.error("Approval Toggle Unexpected Error:", err)
      alert("An unexpected error occurred.")
      setIsApproving(false)
    }
  }

  const handleSave = async () => {
    const trimmed = (editingUser.phone || "").trim()
    let formattedPhone = ""
    if (trimmed.startsWith('+')) {
      formattedPhone = '+' + trimmed.replace(/\D/g, '')
    } else {
      let digits = trimmed.replace(/\D/g, '')
      if (digits.startsWith('0')) {
        formattedPhone = '+62' + digits.substring(1)
      } else if (digits.startsWith('62')) {
        formattedPhone = '+' + digits
      } else if (digits.length > 0) {
        formattedPhone = '+62' + digits
      }
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        role: editingUser.role,
        permissions: editingUser.permissions,
        full_name: editingUser.full_name,
        phone: formattedPhone
      })
      .eq('id', editingUser.id)

    if (!error) {
      setIsDialogOpen(false)
      fetchData()
    }
  }

  if (authLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <SectionLoader />
      </div>
    )
  }

  if (!hasPermission('users', 'view')) {
    return <div className="p-8 text-center">{dict.MSG_ACCESS_DENIED}</div>
  }

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">
          <UserCog className="size-5 mr-2 inline-block text-primary" />
          {dict.TITLE_USER_MGMT}
        </h1>
      </div>

      {/* Data Area */}
      <Card className="data-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-7">{dict.LABEL_USERNAME_FIELD || "Username"}</TableHead>
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
              <TableRow><TableCell colSpan={6} className="text-center py-8">{dict.NO_DATA}</TableCell></TableRow>
            ) : (
              users.map((u) => {
                const status = getStatusInfo(u)
                const StatusIcon = status.icon

                return (
                  <TableRow key={u.id} className="group">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "size-2 rounded-full",
                          u.is_active ? "bg-green-500" : "bg-muted-foreground/30"
                        )} />
                        <span>{u.username}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{u.email}</TableCell>
                    <TableCell className="text-sm">{u.full_name}</TableCell>
                    <TableCell>
                      <span className="capitalize text-xs font-semibold px-2 py-0.5 rounded-md bg-secondary/50">
                        {u.role}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${status.bg} ${status.color}`}>
                        <StatusIcon className="size-3 mr-1.5" />
                        {status.label}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="table_action" size="sm" onClick={() => handleEdit(u)}>
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
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 border-b shrink-0">
            <DialogTitle>{dict.TITLE_MANAGE_USER}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid gap-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>{dict.LABEL_USERNAME_FIELD || "Username"}</Label>
                  <Input value={editingUser?.username || ""} disabled className="bg-muted" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>{dict.LABEL_EMAIL || "Email"}</Label>
                  <Input value={editingUser?.email || ""} disabled className="bg-muted" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>{dict.LABEL_FULL_NAME}</Label>
                  <Input value={editingUser?.full_name || ""} onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>{dict.LABEL_PHONE}</Label>
                  <Input value={editingUser?.phone || ""} onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })} />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dict.LABEL_ROLE}</Label>
                <Select value={editingUser?.role} onValueChange={handleRoleChange}>
                  <SelectTrigger className="w-full capitalize">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map(r => (
                      <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/30">
                <div className="flex-1">
                  <h3 className="font-semibold text-sm">{dict.LABEL_ACC_APPROVAL}</h3>
                  <p className="text-xs text-muted-foreground">
                    {editingUser?.auth_id === profile?.auth_id ? "You cannot revoke your own account access." : dict.DESC_ACC_APPROVAL}
                  </p>
                </div>
                <Button variant={editingUser?.is_active ? "destructive" : "default"} onClick={handleApproveToggle} disabled={isApproving || editingUser?.auth_id === profile?.auth_id}>
                  {isApproving && <ButtonLoader />}
                  {editingUser?.is_active ? dict.BUTTON_REVOKE : dict.BUTTON_APPROVE}
                </Button>
              </div>

              <div className="flex flex-col gap-4">
                <h3 className="font-bold border-b pb-2">{dict.LABEL_GRANULAR_PERMS}</h3>
                <div className="grid grid-cols-[150px_repeat(5,1fr)] gap-2 text-center text-xs font-bold text-muted-foreground mb-2">
                  <div className="text-left">{dict.LABEL_MODULE}</div>
                  {actions.map(a => <div key={a} className="capitalize">{a}</div>)}
                </div>
                {modules.map(m => (
                  <div key={m} className="grid grid-cols-[150px_repeat(5,1fr)] gap-2 items-center border-b border-muted py-2 hover:bg-muted/10">
                    <div className="text-sm font-medium capitalize">{m}</div>
                    {actions.map(a => (
                      <div key={a} className="flex justify-center">
                        <input type="checkbox" className="size-4 cursor-pointer accent-primary" checked={editingUser?.permissions?.[m]?.[a] || false} onChange={(e) => handlePermissionChange(m, a, e.target.checked)} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 border-t shrink-0">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
              <X className="mr-2 size-4" /> {dict.BUTTON_CANCEL}
            </Button>
            <Button onClick={handleSave} className="flex-1">
              <Save className="mr-2 size-4" /> {dict.BUTTON_SAVE}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
