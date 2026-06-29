"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  User,
  Mail,
  Settings,
  Save,
  Trash2,
  Plus,
  ArrowRight,
  ShieldCheck,
  Package,
  Building2,
  CheckCircle2,
  MoreVertical,
  Bell,
  LogOut,
  CreditCard,
  Phone,
  MapPin,
  Info,
} from "lucide-react"

import { SectionLoader } from "@/components/section-loader"
import { ButtonLoader } from "@/components/button-loader"
import { FullPageLoader } from "@/components/full-page-loader"
import { notify } from "@/lib/notifications"
import { useDictionary } from "@/components/dictionary-provider"

export default function ComponentTestPage() {
  const { dict } = useDictionary()
  const [showFullLoader, setShowFullLoader] = useState(false)
  const [btnLoading, setBtnLoading] = useState(false)

  const triggerToast = (
    type: "success" | "error" | "info" | "security" | "warning"
  ) => {
    if (type === "success") {
      notify.success(
        dict.SIGNUP_SUCCESS_TITLE || "Action Successful",
        dict.SIGNUP_SUCCESS_MSG || "Your changes have been saved."
      )
    } else if (type === "error") {
      notify.error(
        dict.ERROR_UNEXPECTED || "Operation Failed",
        dict.ERROR_SUBMIT_FAILED || "Issue processing request."
      )
    } else if (type === "warning") {
      notify.warning("System Alert", "Your session is about to expire.")
    } else if (type === "security") {
      notify.security(
        dict.MSG_RESET_LINK_SENT || "Security Link Dispatched",
        dict.MSG_RESET_SENT || "Check your email shortly."
      )
    } else {
      notify.info("System Notification", "New updates are available.")
    }
  }

  const triggerFullLoader = () => {
    setShowFullLoader(true)
    setTimeout(() => setShowFullLoader(false), 3000)
  }

  return (
    <div className="page-container">
      {showFullLoader && (
        <FullPageLoader message="Testing Full Page Loader..." />
      )}

      <section className="space-y-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-extrabold tracking-tight">
            Component Showcase
          </h1>
          <p className="text-lg text-muted-foreground">
            A comprehensive reference for all NIDS UI elements, variants, and
            states.
          </p>
        </div>
        <Separator />
      </section>

      {/* --- LOADERS & ANIMATIONS --- */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 border-b pb-4">
          <div className="rounded-lg bg-primary/10 p-2">
            <Settings className="size-6 text-primary" />
          </div>
          <h2 className="text-3xl font-bold">Loaders & Animations</h2>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <Card className="border-primary/5 shadow-lg">
            <CardHeader>
              <CardTitle>Section Loader</CardTitle>
              <CardDescription>
                Inline dual-ring animation for tables and cards.
              </CardDescription>
            </CardHeader>
            <CardContent className="m-6 mt-0 flex min-h-[200px] items-center justify-center rounded-xl border-2 border-dashed bg-muted/20">
              <SectionLoader className="min-h-0 p-0" />
            </CardContent>
          </Card>

          <Card className="border-primary/5 shadow-lg">
            <CardHeader>
              <CardTitle>Full Page Loader</CardTitle>
              <CardDescription>
                High-impact overlay with backdrop blur.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex min-h-[200px] flex-col justify-center gap-6">
              <Button
                onClick={triggerFullLoader}
                variant="outline"
                size="lg"
                className="w-full"
              >
                Trigger Full Page Loader (3s)
              </Button>
              <div className="space-y-2">
                <p className="text-center text-xs font-medium text-muted-foreground uppercase">
                  Button Internal Loader
                </p>
                <div className="flex justify-center gap-4">
                  <Button disabled size="sm">
                    <ButtonLoader />
                    Saving
                  </Button>
                  <Button variant="outline" disabled size="sm">
                    <ButtonLoader />
                    Loading
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* --- FORMS & SELECTION --- */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 border-b pb-4">
          <div className="rounded-lg bg-primary/10 p-2">
            <CheckCircle2 className="size-6 text-primary" />
          </div>
          <h2 className="text-3xl font-bold">Form & Selection</h2>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          <Card className="border-primary/5 shadow-lg md:col-span-2">
            <CardHeader>
              <CardTitle>Input Fields</CardTitle>
              <CardDescription>
                States, variants, and group focus patterns.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Default</Label>
                  <Input placeholder="Enter something..." />
                </div>
                <div className="space-y-2">
                  <Label className="text-destructive">
                    Error State (Aria-Invalid)
                  </Label>
                  <Input defaultValue="Invalid input" aria-invalid="true" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Icon Prefix (Branded Focus Group)</Label>
                <div className="group relative">
                  <User className="absolute top-3 left-3 size-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                  <Input className="pl-10" placeholder="Search users..." />
                </div>
              </div>

              <div className="grid grid-cols-2 items-end gap-6">
                <div className="space-y-2">
                  <Label>Select Component</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">Customer</SelectItem>
                      <SelectItem value="supplier">Supplier</SelectItem>
                      <SelectItem value="partner">Partner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2 pb-2">
                  <Switch id="active" />
                  <Label htmlFor="active">Active Status</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/5 shadow-lg">
            <CardHeader>
              <CardTitle>Checkboxes & Radios</CardTitle>
              <CardDescription>Granular selection controls.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-3 rounded-lg p-2 transition-colors hover:bg-muted/50">
                  <Checkbox id="perm-view" defaultChecked />
                  <Label htmlFor="perm-view" className="cursor-pointer">
                    View Permission
                  </Label>
                </div>
                <div className="flex items-center space-x-3 rounded-lg p-2 transition-colors hover:bg-muted/50">
                  <Checkbox id="perm-edit" />
                  <Label htmlFor="perm-edit" className="cursor-pointer">
                    Edit Permission
                  </Label>
                </div>
                <div className="flex items-center space-x-3 rounded-lg p-2 opacity-50 transition-colors hover:bg-muted/50">
                  <Checkbox id="perm-delete" disabled />
                  <Label htmlFor="perm-delete" className="cursor-pointer">
                    Delete (Disabled)
                  </Label>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Badges</Label>
                <div className="flex flex-wrap gap-2">
                  <Badge>Default</Badge>
                  <Badge variant="secondary">Secondary</Badge>
                  <Badge variant="outline">Outline</Badge>
                  <Badge variant="destructive">Critical</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-3 border-b pb-4">
          <div className="rounded-lg bg-primary/10 p-2">
            <Bell className="size-6 text-primary" />
          </div>
          <h2 className="text-3xl font-bold">Feedback & Toasts</h2>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Android-Style Toast System</CardTitle>
            <CardDescription>
              Floating, non-disruptive notifications that vanish over time.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <Button
              onClick={() => triggerToast("success")}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Trigger Success Toast
            </Button>
            <Button onClick={() => triggerToast("error")} variant="destructive">
              Trigger Error Toast
            </Button>
            <Button
              onClick={() => triggerToast("warning")}
              variant="outline"
              className="border-warning text-warning hover:bg-warning/10"
            >
              Trigger Warning Toast
            </Button>
            <Button onClick={() => triggerToast("info")} variant="secondary">
              Trigger Info Toast
            </Button>
            <Button onClick={() => triggerToast("security")} variant="outline">
              Trigger Security Toast
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* --- NAVIGATION & OVERLAYS --- */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 border-b pb-4">
          <div className="rounded-lg bg-primary/10 p-2">
            <Bell className="size-6 text-primary" />
          </div>
          <h2 className="text-3xl font-bold">Navigation & Overlays</h2>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          <Card className="border-primary/5 shadow-lg">
            <CardHeader>
              <CardTitle>Avatars & Tooltips</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-around py-6">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Avatar className="size-12 cursor-help border-2 border-primary/10 transition-transform hover:scale-110">
                      <AvatarImage src="https://github.com/shadcn.png" />
                      <AvatarFallback>CN</AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Developer Profile</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <div className="flex -space-x-4">
                <Avatar className="border-2 border-background">
                  <AvatarFallback className="bg-emerald-500 text-white">
                    JD
                  </AvatarFallback>
                </Avatar>
                <Avatar className="border-2 border-background">
                  <AvatarFallback className="bg-amber-500 text-white">
                    AS
                  </AvatarFallback>
                </Avatar>
                <Avatar className="border-2 border-background">
                  <AvatarFallback className="bg-primary text-white">
                    +5
                  </AvatarFallback>
                </Avatar>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/5 shadow-lg">
            <CardHeader>
              <CardTitle>Dropdown Menus</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center py-6">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <MoreVertical className="size-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <User className="mr-2 size-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <CreditCard className="mr-2 size-4" />
                    <span>Billing</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="mr-2 size-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive">
                    <LogOut className="mr-2 size-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardContent>
          </Card>

          <Card className="border-primary/5 shadow-lg">
            <CardHeader>
              <CardTitle>Dialogs (Modals)</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center py-6">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    Open Demo Dialog
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>System Confirmation</DialogTitle>
                    <DialogDescription>
                      This is a standard dialog used for critical actions and
                      focused forms.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <p className="text-sm text-muted-foreground">
                      Are you sure you want to proceed with this operation? This
                      action cannot be undone.
                    </p>
                  </div>
                  <DialogFooter>
                    <Button variant="outline">Cancel</Button>
                    <Button>Confirm</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          <Card className="border-primary/5 shadow-lg">
            <CardHeader>
              <CardTitle>Sheets & Triggers</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center py-6">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="secondary" className="w-full">
                    Open Sidebar Sheet
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Quick Settings</SheetTitle>
                    <SheetDescription>
                      Configure your distribution settings here.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="space-y-6 py-10">
                    <div className="space-y-4">
                      <Label>Notification Channel</Label>
                      <Select defaultValue="email">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="sms">SMS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Silent Mode</Label>
                      <Switch />
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* --- CONTENT TABS --- */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 border-b pb-4">
          <div className="rounded-lg bg-primary/10 p-2">
            <Package className="size-6 text-primary" />
          </div>
          <h2 className="text-3xl font-bold">Content Structure</h2>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full max-w-[400px] grid-cols-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="details">Detailed Specs</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-6">
            <Card className="border-primary/5 shadow-lg">
              <CardHeader>
                <CardTitle>Dashboard Overview</CardTitle>
                <CardDescription>
                  Visual summary of system health.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1 rounded-xl border bg-primary/5 p-4">
                  <p className="text-xs font-bold text-muted-foreground uppercase">
                    Revenue
                  </p>
                  <p className="text-2xl font-bold">$124,000</p>
                </div>
                <div className="space-y-1 rounded-xl border bg-emerald-500/5 p-4">
                  <p className="text-xs font-bold text-muted-foreground uppercase">
                    Orders
                  </p>
                  <p className="text-2xl font-bold">1,420</p>
                </div>
                <div className="space-y-1 rounded-xl border bg-amber-500/5 p-4">
                  <p className="text-xs font-bold text-muted-foreground uppercase">
                    Pending
                  </p>
                  <p className="text-2xl font-bold">12</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="details" className="mt-6">
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                Detailed specifications and technical properties would appear
                here.
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </section>

      {/* --- DATA & MASTER RECORDS --- */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 border-b pb-4">
          <div className="rounded-lg bg-primary/10 p-2">
            <Building2 className="size-6 text-primary" />
          </div>
          <h2 className="text-3xl font-bold">Data & Master Records</h2>
        </div>

        <Card className="border-primary/5 shadow-lg">
          <CardHeader>
            <CardTitle>Company Profile Showcase</CardTitle>
            <CardDescription>
              Demonstrating multi-type support and rich contact details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6 rounded-xl border bg-muted/30 p-4">
              <div className="flex flex-col items-start justify-between gap-4 md:flex-row">
                <div className="space-y-1">
                  <h3 className="flex items-center gap-2 text-xl font-bold">
                    PT. Global Logistics Nusantara
                    <div className="flex gap-1">
                      <Badge
                        variant="outline"
                        className="border-primary/20 bg-primary/10 text-[10px] text-primary"
                      >
                        Supplier
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-primary/20 bg-primary/10 text-[10px] text-primary"
                      >
                        Transporter
                      </Badge>
                    </div>
                  </h3>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="size-3" /> Budi Santoso
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail className="size-3" /> logistics@gl-nusantara.co.id
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone className="size-3" /> +62 21 555-8888
                    </span>
                  </div>
                </div>
                <Button size="sm">Manage Profile</Button>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1 rounded-lg border bg-background p-3">
                  <p className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground uppercase">
                    <MapPin className="size-3" /> Office Location
                  </p>
                  <p className="text-sm font-medium">
                    Jakarta Selatan, DKI Jakarta
                  </p>
                </div>
                <div className="space-y-1 rounded-lg border bg-background p-3 md:col-span-2">
                  <p className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground uppercase">
                    <Info className="size-3" /> Other Info
                  </p>
                  <p className="text-sm font-medium">
                    Key transporter for East Java routes. Preferred bulk oil
                    supplier.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <footer className="pt-10 pb-20 text-center">
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-muted-foreground">
            Nexus Integrated Distribution System - UI Component Library v1.1
          </p>
          <div className="flex gap-4">
            <Badge variant="outline" className="text-[10px]">
              React 19
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              Tailwind 4
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              shadcn/ui
            </Badge>
          </div>
        </div>
      </footer>
    </div>
  )
}
