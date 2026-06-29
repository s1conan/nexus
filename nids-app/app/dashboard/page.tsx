"use client"

import { useDictionary } from "@/components/dictionary-provider"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Building2, Package, ShoppingCart } from "lucide-react"
import { formatCurrency, formatNumber } from "@/lib/formatters"

export default function Home() {
  const { dict, config, lang } = useDictionary()

  return (
    <div className="custom-scrollbar flex h-full flex-col gap-6 overflow-auto p-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">{dict.DASHBOARD_TITLE}</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card tabIndex={0}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {dict.LABEL_TOTAL_REVENUE}
            </CardTitle>
            <ShoppingCart className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(45231.89, lang === "id" ? "id-ID" : "en-US")}
            </div>
            <p className="text-xs text-muted-foreground">
              +20.1% {dict.LABEL_FROM_LAST_MONTH}
            </p>
          </CardContent>
        </Card>

        <Card tabIndex={0}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {dict.LABEL_ACTIVE_COMPANIES}
            </CardTitle>
            <Building2 className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(245, lang === "id" ? "id-ID" : "en-US")}
            </div>
            <p className="text-xs text-muted-foreground">
              +18 {dict.LABEL_NEW_THIS_MONTH}
            </p>
          </CardContent>
        </Card>

        <Card tabIndex={0}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {dict.LABEL_TOTAL_PRODUCTS}
            </CardTitle>
            <Package className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(12, lang === "id" ? "id-ID" : "en-US")}
            </div>
            <p className="text-xs text-muted-foreground">
              {dict.LABEL_PRODUCTS_IN_STOCK}
            </p>
          </CardContent>
        </Card>
      </div>{" "}
    </div>
  )
}
