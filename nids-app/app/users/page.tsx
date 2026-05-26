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
import { UserCog, ShieldCheck, ShieldAlert, ShieldX, Save, X, Trash2, Clock, Pencil } from "lucide-react"
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

const supabase = createClient()

export default function UsersPage() {
  const { dict } = useDictionary()
  const { profile, loading: authLoading, hasPermission } = useAuth()

  const [users, setUsers] = useState<any[]>([])
  const [roles, setRoles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = usePersistedState("users_dialog_open", false)
  const [editingUser, setEditingUser] = usePersistedState<any>("users_editing_data", null)

  const modules = ['companies', 'products', 'quotes', 'orders', 'shipments', 'invoices']
  const actions = ['view', 'insert', 'edit', 'delete', 'print']

  const getStatusInfo = (user: any) => {
    // ... (unchanged logic)
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
      console.log("Users: Fetching data...")

      const [userRes, roleRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('role_permissions').select('role')
      ])

      if (userRes.error) console.error("Users: Profile fetch error:", userRes.error)
      if (roleRes.error) console.error("Users: Role fetch error:", roleRes.error)

      if (userRes.data) {
        // Custom Sort: Status (Pending > Deactivated > Active) then Role
        const sortedUsers = [...userRes.data].sort((a, b) => {
          const getStatusScore = (u: any) => {
            if (!u.last_login && !u.is_active) return 0 // Pending
            if (u.last_login && !u.is_active) return 1  // Deactivated
            return 2 // Active
          }

          const scoreA = getStatusScore(a)
          const scoreB = getStatusScore(b)

          if (scoreA !== scoreB) return scoreA - scoreB

          // Secondary sort by role
          return (a.role || "").localeCompare(b.role || "")
        })

        setUsers(sortedUsers)

        // Update editingUser if it exists
        if (editingUser) {
          const updated = sortedUsers.find(u => u.id === editingUser.id)
          if (updated) setEditingUser(updated)
        }
      }

      if (roleRes.data) {
        const rolesList = roleRes.data.map((r: any) => r.role)
        console.log("Users: Roles from DB:", rolesList)
        setRoles(rolesList)
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
      const { data: roleInfo, error } = await supabase
        .from('role_permissions')
        .select('permissions')
        .eq('role', role)
        .single()

      if (error) {
        console.error("Error fetching role permissions:", error)
      }

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
    console.log(`Users: Attempting ${editingUser.is_active ? 'revoke' : 'approve'} for ${editingUser.email}`)

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
      
      // IMPORTANT: Clear loading state AS SOON as the API returns
      setIsApproving(false)

      if (result.error) {
        console.error("Approval Toggle Error Result:", result.error)
        alert(result.error)
      } else {
        console.log("Approval Toggle Success, triggering table refresh...")
        // Refresh the table in the background
        await fetchData()
      }
    } catch (err) {
      console.error("Approval Toggle Unexpected Error:", err)
      alert("An unexpected error occurred. Please check the console.")
      setIsApproving(false)
    }
  }

  const handleSave = async () => {
    // 1. Intelligent Phone Formatting
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
      <div className="page-container flex items-center justify-center min-h-[400px]">
        <SectionLoader />
      </div>
    )
  }

  if (!hasPermission('users', 'view')) {
    return <div className="p-8 text-center">{dict.MSG_ACCESS_DENIED}</div>
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{dict.TITLE_USER_MGMT}</h1>
      </div>

      <Card className="data-card overflow-hidden">
        <Table className="min-w-[1000px]">
          <TableHeader className="sticky top-0 bg-background z-5 shadow-sm">
            <TableRow>
              <TableHead className="w-[150px]">{dict.LABEL_USERNAME_FIELD || "Username"}</TableHead>
              <TableHead className="w-[200px]">{dict.LABEL_EMAIL}</TableHead>
              <TableHead className="w-[180px]">{dict.LABEL_FULL_NAME}</TableHead>
              <TableHead className="hidden md:table-cell">{dict.LABEL_PHONE_SHORT}</TableHead>
              <TableHead>{dict.LABEL_ROLE}</TableHead>
              <TableHead>{dict.LABEL_STATUS}</TableHead>
              <TableHead className="w-[180px]">{dict.LABEL_LAST_LOGIN || "Last Login"}</TableHead>
              <TableHead className="text-center w-0 sticky right-0 bg-background/95 backdrop-blur-sm z-20 px-2 border-l">
                {dict.LABEL_ACTIONS}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="p-0">
                  <SectionLoader />
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8">{dict.NO_DATA}</TableCell></TableRow>
            ) : (
              users.map((u) => {
                const status = getStatusInfo(u)
                const StatusIcon = status.icon

                return (
                  <TableRow key={u.id} className="group">
                    <TableCell className="text-sm font-medium">{u.username}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                    <TableCell className="text-sm">{u.full_name}</TableCell>
                    <TableCell className="text-sm hidden md:table-cell">{u.phone || '-'}</TableCell>
                    <TableCell>
                      <span className="capitalize text-xs font-semibold px-2 py-0.5 rounded-md bg-secondary/50">
                        {u.role}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className={`inline-flex w-[100px] items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                        <StatusIcon className="size-4 mr-1.5" strokeWidth={2} />
                        {status.label}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {u.last_login ? formatDateTime(u.last_login) : (
                        <span className="flex items-center opacity-50">
                          <Clock className="size-3 mr-1" /> {dict.NO_DATA}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right sticky right-0 bg-background/95 backdrop-blur-sm z-20 px-4 border-l group-hover:bg-muted/50 transition-colors">
                      <Button variant="secondary" size="sm" onClick={() => handleEdit(u)}>
                        <Pencil className="size-4 md:mr-2" />
                        <span className="hidden md:inline">{dict.BUTTON_MANAGE}</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{dict.TITLE_MANAGE_USER}</DialogTitle>
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
                  <Label>{dict.LABEL_FULL_NAME}</Label>
                  <Input
                    value={editingUser?.full_name || ""}
                    onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>{dict.LABEL_PHONE}</Label>
                  <Input
                    value={editingUser?.phone || ""}
                    onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2" key={`${editingUser?.id}-${editingUser?.role}`}>
                <Label>{dict.LABEL_ROLE}</Label>
                <Select value={editingUser?.role} onValueChange={handleRoleChange}>
                  <SelectTrigger className="w-full capitalize">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.length === 0 ? (
                      <div className="p-2 text-xs text-muted-foreground">No roles loaded</div>
                    ) : (
                      roles.map(r => (
                        <SelectItem key={r} value={r} className="capitalize">
                          {r}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/30">
                <div className="flex-1">
                  <h3 className="font-semibold text-sm">{dict.LABEL_ACC_APPROVAL}</h3>
                  <p className="text-xs text-muted-foreground">
                    {editingUser?.auth_id === profile?.auth_id
                      ? "You cannot revoke your own account access."
                      : dict.DESC_ACC_APPROVAL}
                  </p>
                </div>
                <Button
                  variant={editingUser?.is_active ? "destructive" : "default"}
                  onClick={handleApproveToggle}
                  disabled={isApproving || editingUser?.auth_id === profile?.auth_id}
                >
                  {isApproving ? (
                    <ButtonLoader />
                  ) : null}
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
                        <input
                          type="checkbox"
                          className="size-4 cursor-pointer accent-primary"
                          checked={editingUser?.permissions?.[m]?.[a] || false}
                          onChange={(e) => handlePermissionChange(m, a, e.target.checked)}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
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
