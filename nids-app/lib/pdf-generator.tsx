import React from "react"
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font,
  pdf,
} from "@react-pdf/renderer"
import { format } from "date-fns"
import { id as dateLocaleId } from "date-fns/locale"
import { formatNumber } from "./formatters"
import {
  computeHash,
  canonicalSerialize,
  getQuotationCanonicalData,
  getInvoiceCanonicalData,
} from "@/lib/document-hash"
import { createClient } from "@/lib/supabase"
import QRCode from "qrcode"

Font.register({
  family: "Calibri",
  fonts: [
    { src: "/fonts/calibri.ttf", fontWeight: 400 },
    { src: "/fonts/calibrib.ttf", fontWeight: 700 },
    { src: "/fonts/calibrii.ttf", fontStyle: "italic", fontWeight: 400 },
  ],
})

export interface CompanyInfo {
  name: string
  address: string
  email: string
  phone?: string
  logo_url?: string
  header_url?: string
}

export interface QuotationData {
  id: string
  quotation_number: string
  quotation_date: string
  expiry_date: string
  company_name: string
  contact_person?: string
  product_sku: string
  product_name: string
  delivery_address: string
  base_price: number
  delivery_price: number
  min_order: number
  shrinkage?: number
  content: string
  discounts: {
    label: string
    value: number
    delivery_address?: string
    delivery_cost?: number
  }[]
  note: string
  terms_conditions: string
  closing_remarks: string
  bank_accounts: {
    name: string
    bank_name?: string
    account_number: string
    account_name: string
    branch: string
  }[]
  tax_details: { name: string; rate: number; enabled: boolean }[]
  delivery_taxable?: boolean
  qr_code_url?: string
}

export interface SalesOrderData {
  id: string
  so_number: string
  so_date: string
  delivery_date: string
  company_name: string
  contact_person?: string
  product_name?: string
  product_sku?: string
  quantity: number
  unit_price: number
  discount: number
  delivery_price_per_litre: number
  tax_details: { name: string; rate: number; enabled: boolean }[]
  delivery_taxable?: boolean
  term_of_payment: string
  delivery_address: string
  note: string
  is_note_enabled: boolean
  bank_accounts: {
    name: string
    bank_name?: string
    account_number: string
    account_name: string
    branch: string
  }[]
}

export interface InvoiceData {
  id: string
  invoice_number: string
  issue_date: string
  due_date: string
  company_name: string
  do_number?: string
  so_number?: string
  quantity: number
  unit_price: number
  delivery_price_per_litre: number
  subtotal: number
  tax_details: { name: string; rate: number; enabled: boolean }[]
  delivery_taxable?: boolean
  total_amount: number
  note: string
  is_note_enabled: boolean
  bank_accounts: {
    name: string
    bank_name?: string
    account_number: string
    account_name: string
    branch: string
  }[]
  qr_code_url?: string
}

export interface DeliveryOrderCompartment {
  compartment_number: string | number
  seal_number: string
  quantity: number
}

export interface DeliveryOrderData {
  id: string
  do_number: string
  do_date: string
  company_name: string
  supplier_name?: string
  transporter_name?: string
  vehicle_number?: string
  driver_name?: string
  driver_phone?: string
  product_name?: string
  quantity: number
  delivery_address_label?: string
  delivery_address: string
  po_no?: string
  po_date?: string
  PIC?: string
  PIC_phone?: string
  note?: string
  compartments?: DeliveryOrderCompartment[]
}

export interface PaymentData {
  id: string
  payment_number: string
  payment_date: string
  company_name: string
  invoice_number: string
  amount: number
  payment_method: string
  reference_number?: string
  note?: string
  bank_accounts: {
    name: string
    bank_name?: string
    account_number: string
    account_name: string
    branch: string
  }[]
  qr_code_url?: string
}

function createPDFElement(
  tag: string,
  children: React.ReactNode[],
  key: number,
  meta?: { marker?: string }
) {
  switch (tag) {
    case "p":
      return (
        <Text key={key} style={a4Styles.innerText}>
          {children}
        </Text>
      )
    case "ul":
      return (
        <View key={key} style={a4Styles.ul}>
          {children}
        </View>
      )
    case "ol":
      return (
        <View key={key} style={a4Styles.ol}>
          {children}
        </View>
      )
    case "li":
      return (
        <View key={key} style={a4Styles.li}>
          <Text style={{ width: 12 }}>{meta?.marker || "•"}</Text>
          <Text style={{ alignItems: "flex-end" }}>{children}</Text>
        </View>
      )
    case "b":
    case "strong":
      return (
        <Text key={key} style={{ fontWeight: "bold" }}>
          {children}
        </Text>
      )
    case "i":
    case "em":
      return (
        <Text key={key} style={{ fontStyle: "italic" }}>
          {children}
        </Text>
      )
    case "u":
      return (
        <Text key={key} style={{ textDecoration: "underline" }}>
          {children}
        </Text>
      )
    default:
      return (
        <Text key={key} style={a4Styles.innerText}>
          {children}
        </Text>
      )
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, "\u00A0")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
}

function parseHtmlToComponents(htmlString: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const regex = /(<[^>]+>|[^<]+)/g
  let match
  let key = 0
  const stack: {
    tag: string
    children: React.ReactNode[]
    olIndex?: number
  }[] = []
  while ((match = regex.exec(htmlString)) !== null) {
    const token = match[0]
    if (token.startsWith("</")) {
      const tag = token.slice(2, -1)
      if (stack.length > 0 && stack[stack.length - 1].tag === tag) {
        const top = stack.pop()!
        const marker =
          tag === "li" &&
          stack.length > 0 &&
          stack[stack.length - 1].tag === "ol"
            ? `${stack[stack.length - 1].olIndex || 1}. `
            : "• "
        if (
          tag === "li" &&
          stack.length > 0 &&
          stack[stack.length - 1].tag === "ol"
        ) {
          stack[stack.length - 1].olIndex =
            (stack[stack.length - 1].olIndex || 1) + 1
        }
        const element = createPDFElement(
          tag,
          top.children,
          key++,
          tag === "li" ? { marker } : undefined
        )
        if (stack.length > 0) {
          stack[stack.length - 1].children.push(element)
        } else {
          parts.push(element)
        }
      }
    } else if (token.startsWith("<")) {
      const tagMatch = token.match(/<(\w+)/)
      const tag = tagMatch ? tagMatch[1].toLowerCase() : ""
      const selfClosing = token.endsWith("/>") || tag === "br"
      if (tag === "br") {
        parts.push(<Text key={key++}>{"\n"}</Text>)
        continue
      }
      if (!selfClosing) {
        stack.push({ tag, children: [], olIndex: tag === "ol" ? 1 : undefined })
      }
    } else if (token.trim()) {
      const textElement = (
        <Text key={key++} style={a4Styles.innerText}>
          {decodeHtmlEntities(token)}
        </Text>
      )
      if (stack.length > 0) {
        stack[stack.length - 1].children.push(textElement)
      } else {
        parts.push(textElement)
      }
    }
  }
  return parts
}

const a4Styles = StyleSheet.create({
  page: {
    paddingHorizontal: 26,
    paddingVertical: 20,
    fontSize: 10,
    fontFamily: "Calibri",
    lineHeight: 1,
  },
  backgroundImage: {
    position: "absolute",
    opacity: "0.15",
    top: 85,
    left: 0,
    right: 0,
    zIndex: -1,
    objectFit: "contain",
    objectPosition: "center",
  },
  header: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    marginBottom: 5,
  },
  logo: { width: 139, height: 70, marginRight: 1, marginBottom: 3 },
  companyInfo: {
    fontSize: 11,
    textSpacing: 0.9,
    lineHeight: 1.4,
    width: 390,
    alignSelf: "flex-end",
  },
  companyName: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 15,
    textSpacing: 2,
  },
  blueLine: { height: 2, backgroundColor: "#1e3a8a", marginBottom: 10 },
  row: { flexDirection: "row", marginBottom: 2 },
  label: { width: 60 },
  colon: { width: 10 },
  section: { marginTop: 9 },
  paragraph: { marginTop: 10, lineHeight: 1, textAlign: "justify" },
  innerText: { lineHeight: 0.8, margin: 0, textAlign: "justify" },
  table: {
    marginTop: 7,
    backgroundColor: "#000",
    flexDirection: "column",
    paddingVertical: 1,
    gap: 0,
    alignSelf: "center",
  },
  tableRow: {
    flexDirection: "row",
    alignSelf: "flex-start",
    display: "flex",
    gap: 1,
    paddingHorizontal: "1",
    alignItems: "center",
    height: "19",
  },
  headerCell: {
    backgroundColor: "#aaeefc",
    fontWeight: "bold",
    display: "flex",
    textAlign: "center",
    alignItems: "center",
  },
  cell: {
    padding: 3,
    backgroundColor: "white",
    fontSize: 10,
    height: "18",
    display: "flex",
    justifyContent: "center",
  },
  center: { textAlign: "center" },
  right: { textAlign: "right" },
  terms: { marginTop: 5, marginLeft: 10, lineHeight: 0.8 },
  signature: {
    marginTop: 15,
    display: "flex",
    alignItems: "center",
    width: 80,
  },
  stamp: {
    opacity: "0.6",
    width: 70,
    height: 70,
    objectFit: "contain",
    objectPosition: "center",
    zIndex: 2,
  },
  ttd: {
    position: "absolute",
    top: 5,
    left: 0,
    width: 100,
    height: 70,
    objectFit: "fill",
    objectPosition: "center",
  },
  qrContainer: {
    position: "absolute",
    bottom: 10,
    right: 10,
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
  },
  qrImage: { width: 60, height: 60 },
  qrLabel: { fontSize: 7, color: "#666" },
  ul: { marginLeft: 10, marginTop: 3, padding: 0 },
  ol: { marginLeft: 10, marginTop: 3 },
  li: { flexDirection: "row", marginBottom: 0 },
})

const a5Styles = StyleSheet.create({
  page: {
    paddingHorizontal: 15,
    paddingVertical: 15,
    fontSize: 10,
    fontFamily: "Calibri",
    lineHeight: 1,
  },
  backgroundImage: {
    position: "absolute",
    opacity: "0.06",
    top: 15,
    left: 0,
    right: 0,
    zIndex: -1,
    objectFit: "contain",
    objectPosition: "center",
  },
  header: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    marginBottom: 5,
  },
  logo: { width: 70, height: 70, marginRight: 10 },
  companyInfo: { fontSize: 11, textSpacing: 1, lineHeight: 1.5 },
  companyName: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
    textSpacing: 2,
  },
  blueLine: { height: 1, backgroundColor: "#1e3a8a", marginBottom: 1 },
  row: { flexDirection: "row", marginBottom: 3 },
  label: { width: 60 },
  colon: { width: 10, marginHorizontal: 2 },
  section: { marginVertical: 5 },
  paragraph: { lineHeight: 1, textAlign: "justify" },
  title: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  subTitle: {
    fontSize: 10,
    fontWeight: "bold",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
    marginHorizontal: "5",
  },
  table: {
    marginTop: 7,
    flexDirection: "column",
    gap: 0,
    alignSelf: "center",
    width: "100%",
    border: "1px solid black",
  },
  tableRow: {
    flexDirection: "row",
    display: "flex",
    width: "100%",
    borderBottom: "1px solid black",
  },
  headerCell: {
    marginTop: 0,
    paddingVertical: 4,
    backgroundColor: "#d9f3f8",
    fontWeight: "bold",
    display: "flex",
    textAlign: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  cell: {
    fontSize: 10,
    display: "flex",
    justifyContent: "center",
    borderRight: "1px solid black",
  },
  remarks: {
    alignItems: "center",
    paddingHorizontal: 4,
    flexDirection: "row",
    justifyContent: "flex-start",
    borderBottom: "1px solid black",
    height: 20,
    borderRight: 0,
  },
  stamp: {
    position: "absolute",
    opacity: "0.5",
    width: 70,
    height: 70,
    objectFit: "contain",
    objectPosition: "center",
    zIndex: 2,
    marginTop: 8,
  },
  signatureArea: {
    marginTop: 0,
    flexDirection: "row",
    border: "1px solid black",
  },
  signatureBox: {
    alignItems: "center",
    justifyContent: "space-between",
    flex: 1,
    borderRight: "1px solid black",
    flexDirection: "column",
  },
  signatureTitle: {
    borderBottom: "1px solid black",
    width: "100%",
    textAlign: "center",
    padding: 2,
    height: 17,
  },
  signatureSpace: { borderBottom: "1px solid black", height: 40 },
  signatureFooter: {
    paddingTop: 5,
    paddingHorizontal: 2,
    borderTop: "1px solid black",
    flexGrow: 1,
    width: "100%",
    height: "20",
  },
})

const QuotationDocument = ({
  company,
  data,
}: {
  company: CompanyInfo
  data: QuotationData
}) => {
  const discountColumnWidth = Math.max(
    65,
    Math.max(
      ...data.discounts.map((d) => `${d.label} ${d.value}%`.length),
      10
    ) * 6
  )
  const hasDeliveryAddress = data.discounts.some((d) => d.delivery_address)
  const headerHeight = hasDeliveryAddress ? 28 : 18
  const replacements: Record<string, string> = {
    quotation_number: data.quotation_number,
    quotation_date: data.quotation_date
      ? format(new Date(data.quotation_date), "dd MMMM yyyy", {
          locale: dateLocaleId,
        })
      : "",
    expiry_date: data.expiry_date
      ? format(new Date(data.expiry_date), "dd MMMM yyyy", {
          locale: dateLocaleId,
        })
      : "",
    company_name: data.company_name,
    contact_person: data.contact_person || "",
    delivery_address: data.delivery_address || "",
    product_name: data.product_name,
    price: formatNumber(data.base_price),
    delivery_price: formatNumber(data.delivery_price),
    min_order: formatNumber(data.min_order),
    shrinkage: data.shrinkage?.toString() || "0",
    bank_accounts: data.bank_accounts.map((b) => b.name).join(", "),
  }
  const replaceVars = (html: string) => {
    if (!html) return html
    return html.replace(/\{([^{}]+)\}/g, (match, key) => {
      return replacements[key] !== undefined ? replacements[key] : match
    })
  }
  const processedContent = replaceVars(data.content)
  const processedNote = replaceVars(data.note)
  const processedTerms = replaceVars(data.terms_conditions)
  const processedClosing = replaceVars(data.closing_remarks)
  return (
    <Document>
      <Page size="A4" style={a4Styles.page}>
        <View style={a4Styles.header}>
          {(company.header_url || company.logo_url) && (
            <Image
              src={company.header_url || company.logo_url}
              style={a4Styles.logo}
            />
          )}
          <View style={a4Styles.companyInfo}>
            <Text style={a4Styles.companyName}>{company.name}</Text>
            <Text>{company.address}</Text>
            <Text>Email : {company.email}</Text>
          </View>
        </View>
        <View style={a4Styles.blueLine} />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View style={a4Styles.row}>
            <Text style={a4Styles.label}>No</Text>
            <Text style={a4Styles.colon}>:</Text>
            <Text>{data.quotation_number}</Text>
          </View>
          <View style={a4Styles.row}>
            <Text>
              Palembang,{" "}
              {format(new Date(data.quotation_date), "dd MMMM yyyy", {
                locale: dateLocaleId,
              })}
            </Text>
          </View>
        </View>
        <View style={a4Styles.row}>
          <Text style={a4Styles.label}>Perihal</Text>
          <Text style={a4Styles.colon}>:</Text>
          <Text>Penawaran {data.product_name}</Text>
        </View>
        <View style={a4Styles.row}>
          <Text style={a4Styles.label}></Text>
          <Text style={a4Styles.colon}></Text>
          <Text>
            Berlaku s.d.{" "}
            {format(new Date(data.expiry_date), "dd MMMM yyyy", {
              locale: dateLocaleId,
            })}
          </Text>
        </View>
        <View style={a4Styles.section}>
          <Text style={{ marginBottom: 5 }}>Kepada Yth.</Text>
          <Text style={{ fontWeight: "bold" }}>{data.company_name}</Text>
        </View>
        {processedContent && (
          <View style={a4Styles.paragraph}>
            {parseHtmlToComponents(processedContent)}
          </View>
        )}
        <View style={a4Styles.table}>
          <View style={[a4Styles.tableRow, { height: headerHeight }]}>
            <View
              style={[
                a4Styles.cell,
                a4Styles.headerCell,
                { width: 170, height: headerHeight },
              ]}
            >
              <Text style={{ alignItems: "center" }}>
                Price Components (per Liter)
              </Text>
            </View>
            <View
              style={[
                a4Styles.cell,
                a4Styles.headerCell,
                { width: 30, height: headerHeight },
              ]}
            >
              <Text>%</Text>
            </View>
            {data.discounts.map((d, i) => (
              <View
                key={i}
                style={[
                  a4Styles.cell,
                  a4Styles.headerCell,
                  { width: discountColumnWidth, height: headerHeight },
                ]}
              >
                <Text>
                  {d.label} {d.value}%
                </Text>
                {d.delivery_address && (
                  <Text style={{ fontSize: 8 }}>({d.delivery_address})</Text>
                )}
              </View>
            ))}
          </View>
          <View style={a4Styles.tableRow}>
            <View style={[a4Styles.cell, { width: 170 }]}>
              <Text>Harga Dasar Pertamina</Text>
            </View>
            <View style={[a4Styles.cell, a4Styles.center, { width: 30 }]}>
              <Text> </Text>
            </View>
            {data.discounts.map((_, i) => (
              <View
                key={i}
                style={[
                  a4Styles.cell,
                  a4Styles.right,
                  { width: discountColumnWidth },
                ]}
              >
                <Text>{formatNumber(data.base_price)}</Text>
              </View>
            ))}
          </View>
          <View style={a4Styles.tableRow}>
            <View style={[a4Styles.cell, { width: 170 }]}>
              <Text>Discount</Text>
            </View>
            <View
              style={[
                a4Styles.cell,
                a4Styles.center,
                { width: 30, height: 50 },
              ]}
            >
              <Text> </Text>
            </View>
            {data.discounts.map((d, i) => (
              <View
                key={i}
                style={[
                  a4Styles.cell,
                  a4Styles.right,
                  { width: discountColumnWidth },
                ]}
              >
                <Text>
                  {formatNumber(Math.round(data.base_price * (d.value / 100)))}
                </Text>
              </View>
            ))}
          </View>
          <View style={a4Styles.tableRow}>
            <View style={[a4Styles.cell, { width: 170 }]}>
              <Text>Harga Dasar PT. ABS</Text>
            </View>
            <View style={[a4Styles.cell, a4Styles.center, { width: 30 }]}>
              <Text> </Text>
            </View>
            {data.discounts.map((d, i) => (
              <View
                key={i}
                style={[
                  a4Styles.cell,
                  a4Styles.right,
                  { width: discountColumnWidth },
                ]}
              >
                <Text style={{ fontWeight: "bold" }}>
                  {formatNumber(
                    data.base_price -
                      Math.round(data.base_price * (d.value / 100))
                  )}
                </Text>
              </View>
            ))}
          </View>
          {data.delivery_taxable && Number(data.delivery_price) > 0 && (
            <View style={a4Styles.tableRow}>
              <View style={[a4Styles.cell, { width: 170 }]}>
                <Text>Biaya Pengiriman</Text>
              </View>
              <View
                style={[
                  a4Styles.cell,
                  a4Styles.center,
                  { width: 30, height: 22, top: 2 },
                ]}
              >
                <Text> </Text>
              </View>
              {data.discounts.map((d, i) => (
                <View
                  key={i}
                  style={[
                    a4Styles.cell,
                    a4Styles.right,
                    { width: discountColumnWidth },
                  ]}
                >
                  <Text>{formatNumber(Math.round(d.delivery_cost ?? 0))}</Text>
                </View>
              ))}
            </View>
          )}
          {data.tax_details
            ?.filter((t) => t.enabled)
            .map((tax, taxIdx) => (
              <View key={`tax-${taxIdx}`} style={a4Styles.tableRow}>
                <View style={[a4Styles.cell, { width: 170 }]}>
                  <Text>{tax.name}</Text>
                </View>
                <View style={[a4Styles.cell, a4Styles.center, { width: 30 }]}>
                  <Text>{tax.rate}%</Text>
                </View>
                {data.discounts.map((d, i) => {
                  const discountValue = Math.round(
                    data.base_price * (d.value / 100)
                  )
                  const baseABS = data.base_price - discountValue
                  const taxableBase = data.delivery_taxable
                    ? baseABS + (d.delivery_cost ?? 0)
                    : baseABS
                  const taxAmount = Math.round(
                    taxableBase * (Number(tax.rate) / 100)
                  )
                  return (
                    <View
                      key={i}
                      style={[
                        a4Styles.cell,
                        a4Styles.right,
                        { width: discountColumnWidth },
                      ]}
                    >
                      <Text>{formatNumber(taxAmount)}</Text>
                    </View>
                  )
                })}
              </View>
            ))}
          {!data.delivery_taxable && Number(data.delivery_price) > 0 && (
            <View style={a4Styles.tableRow}>
              <View style={[a4Styles.cell, { width: 170 }]}>
                <Text>Biaya Pengiriman</Text>
              </View>
              <View
                style={[
                  a4Styles.cell,
                  a4Styles.center,
                  { width: 30, height: 22, top: 2 },
                ]}
              >
                <Text> </Text>
              </View>
              {data.discounts.map((d, i) => (
                <View
                  key={i}
                  style={[
                    a4Styles.cell,
                    a4Styles.right,
                    { width: discountColumnWidth },
                  ]}
                >
                  <Text>{formatNumber(Math.round(d.delivery_cost ?? 0))}</Text>
                </View>
              ))}
            </View>
          )}
          <View style={a4Styles.tableRow}>
            <View style={[a4Styles.cell, { width: 170 }]}>
              <Text style={{ fontWeight: "bold" }}>
                Total Harga Include Pajak
              </Text>
            </View>
            <View style={[a4Styles.cell, a4Styles.center, { width: 30 }]}>
              <Text> </Text>
            </View>
            {data.discounts.map((d, i) => {
              const discountValue = Math.round(
                data.base_price * (d.value / 100)
              )
              const baseABS = data.base_price - discountValue
              const deliveryCost = Math.round(d.delivery_cost ?? 0)
              const taxableBase = data.delivery_taxable
                ? baseABS + deliveryCost
                : baseABS
              let totalTaxes = 0
              if (data.tax_details) {
                data.tax_details
                  .filter((t) => t.enabled)
                  .forEach((tax) => {
                    totalTaxes += Math.round(
                      taxableBase * (Number(tax.rate) / 100)
                    )
                  })
              }
              const total = baseABS + totalTaxes + deliveryCost
              return (
                <View
                  key={i}
                  style={[
                    a4Styles.cell,
                    a4Styles.right,
                    { width: discountColumnWidth },
                  ]}
                >
                  <Text style={{ fontWeight: "bold" }}>
                    {formatNumber(total)}
                  </Text>
                </View>
              )
            })}
          </View>
        </View>
        {processedNote && (
          <View style={a4Styles.section}>
            <Text style={{ fontWeight: "bold" }}>NB :</Text>
            <View style={a4Styles.terms}>
              {parseHtmlToComponents(processedNote)}
            </View>
          </View>
        )}
        {(processedTerms || data.min_order > 0) && (
          <View style={a4Styles.section}>
            <Text style={{ fontWeight: "bold" }}>
              Syarat-syarat dan Ketentuan :
            </Text>
            <View style={a4Styles.terms}>
              {processedTerms && parseHtmlToComponents(processedTerms)}
            </View>
          </View>
        )}
        {data.bank_accounts && data.bank_accounts.length > 0 && (
          <View style={a4Styles.section}>
            <Text style={{ fontWeight: "bold" }}>Metode Pembayaran :</Text>
            <View
              style={{
                display: "flex",
                flexDirection: "row",
                gap: 8,
                marginTop: 5,
              }}
            >
              {data.bank_accounts.map((d, i) => (
                <View
                  key={i}
                  style={{
                    borderRadius: 8,
                    border: "1px solid silver",
                    gap: 4,
                    padding: 8,
                    backgroundColor: "#fafafa",
                  }}
                >
                  <Text style={{ fontWeight: "semibold" }}>{d.name}</Text>
                  <Text>{d.account_number}</Text>
                  <Text>{d.account_name}</Text>
                  <Text>{d.branch}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        {processedClosing && (
          <View style={a4Styles.paragraph}>
            {parseHtmlToComponents(processedClosing)}
          </View>
        )}
        <View style={{ display: "flex", justifyContent: "space-between" }}>
          <View style={a4Styles.signature}>
            <Text>Hormat Kami,</Text>
            <Image src={company.logo_url} style={a4Styles.stamp} />
            <Image src="/images/ttd-indah.png" style={a4Styles.ttd} />
            <Text style={{ fontWeight: "bold", marginTop: 5 }}>
              Indah Permatasari
            </Text>
            <Text style={{ fontWeight: "bold", marginTop: 2 }}>
              ( DIREKTUR )
            </Text>
          </View>
          {data.qr_code_url && (
            <View style={a4Styles.qrContainer}>
              <Image src={data.qr_code_url} style={a4Styles.qrImage} />
              <Text style={a4Styles.qrLabel}> </Text>
            </View>
          )}
        </View>
        <Image src={company.logo_url} style={a4Styles.backgroundImage} />
      </Page>
    </Document>
  )
}

const SalesOrderDocument = ({
  company,
  data,
}: {
  company: CompanyInfo
  data: SalesOrderData
}) => {
  const subtotal = data.quantity * data.unit_price
  const discountAmount = subtotal * (data.discount / 100)
  const afterDiscount = subtotal - discountAmount
  const deliveryTotal = data.quantity * data.delivery_price_per_litre
  const taxableAmount =
    afterDiscount + (data.delivery_taxable ? deliveryTotal : 0)
  const enabledTaxes = data.tax_details.filter((t) => t.enabled)
  const taxLines = enabledTaxes.map((t) => ({
    name: t.name,
    amount: Math.round(Math.max(0, taxableAmount) * (Number(t.rate) / 100)),
  }))
  const grandTotal =
    afterDiscount +
    deliveryTotal +
    taxLines.reduce((sum, t) => sum + t.amount, 0)
  return (
    <Document>
      <Page size="A4" style={a4Styles.page}>
        <View style={a4Styles.header}>
          {(company.header_url || company.logo_url) && (
            <Image
              src={company.header_url || company.logo_url}
              style={a4Styles.logo}
            />
          )}
          <View style={a4Styles.companyInfo}>
            <Text style={a4Styles.companyName}>{company.name}</Text>
            <Text>{company.address}</Text>
            <Text>Email : {company.email}</Text>
          </View>
        </View>
        <View style={a4Styles.blueLine} />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View style={a4Styles.row}>
            <Text style={a4Styles.label}>No</Text>
            <Text style={a4Styles.colon}>:</Text>
            <Text>{data.so_number}</Text>
          </View>
          <View style={a4Styles.row}>
            <Text>
              Palembang,{" "}
              {format(new Date(data.so_date), "dd MMMM yyyy", {
                locale: dateLocaleId,
              })}
            </Text>
          </View>
        </View>
        <View style={a4Styles.row}>
          <Text style={a4Styles.label}>Perihal</Text>
          <Text style={a4Styles.colon}>:</Text>
          <Text>Sales Order</Text>
        </View>
        <View style={a4Styles.row}>
          <Text style={a4Styles.label}></Text>
          <Text style={a4Styles.colon}></Text>
          <Text>
            Pengiriman s.d.{" "}
            {format(new Date(data.delivery_date), "dd MMMM yyyy", {
              locale: dateLocaleId,
            })}
          </Text>
        </View>
        <View style={a4Styles.section}>
          <Text style={{ marginBottom: 5 }}>Kepada Yth.</Text>
          <Text style={{ fontWeight: "bold" }}>{data.company_name}</Text>
          {data.delivery_address && (
            <Text style={{ marginTop: 2 }}>{data.delivery_address}</Text>
          )}
        </View>
        <View style={a4Styles.table}>
          <View style={a4Styles.tableRow}>
            <View style={[a4Styles.cell, a4Styles.headerCell, { width: 160 }]}>
              <Text>Item</Text>
            </View>
            <View style={[a4Styles.cell, a4Styles.headerCell, { width: 60 }]}>
              <Text>Qty (L)</Text>
            </View>
            <View style={[a4Styles.cell, a4Styles.headerCell, { width: 80 }]}>
              <Text>Harga/L</Text>
            </View>
            <View style={[a4Styles.cell, a4Styles.headerCell, { width: 80 }]}>
              <Text>Subtotal</Text>
            </View>
          </View>
          <View style={a4Styles.tableRow}>
            <View style={[a4Styles.cell, { width: 160 }]}>
              <Text>{data.product_name || "-"}</Text>
              {data.product_sku && (
                <Text style={{ fontSize: 8 }}>SKU: {data.product_sku}</Text>
              )}
            </View>
            <View style={[a4Styles.cell, a4Styles.center, { width: 60 }]}>
              <Text>{formatNumber(data.quantity)}</Text>
            </View>
            <View style={[a4Styles.cell, a4Styles.right, { width: 80 }]}>
              <Text>{formatNumber(data.unit_price)}</Text>
            </View>
            <View style={[a4Styles.cell, a4Styles.right, { width: 80 }]}>
              <Text>{formatNumber(subtotal)}</Text>
            </View>
          </View>
          {data.discount > 0 && (
            <View style={a4Styles.tableRow}>
              <View style={[a4Styles.cell, { width: 160 }]}>
                <Text>Discount ({data.discount}%)</Text>
              </View>
              <View style={[a4Styles.cell, { width: 60 }]}>
                <Text></Text>
              </View>
              <View style={[a4Styles.cell, { width: 80 }]}>
                <Text></Text>
              </View>
              <View style={[a4Styles.cell, a4Styles.right, { width: 80 }]}>
                <Text>-{formatNumber(discountAmount)}</Text>
              </View>
            </View>
          )}
          <View style={a4Styles.tableRow}>
            <View style={[a4Styles.cell, { width: 160 }]}>
              <Text style={{ fontWeight: "bold" }}>Total Setelah Diskon</Text>
            </View>
            <View style={[a4Styles.cell, { width: 60 }]}>
              <Text></Text>
            </View>
            <View style={[a4Styles.cell, { width: 80 }]}>
              <Text></Text>
            </View>
            <View style={[a4Styles.cell, a4Styles.right, { width: 80 }]}>
              <Text style={{ fontWeight: "bold" }}>
                {formatNumber(afterDiscount)}
              </Text>
            </View>
          </View>
          {data.delivery_price_per_litre > 0 && (
            <View style={a4Styles.tableRow}>
              <View style={[a4Styles.cell, { width: 160 }]}>
                <Text>
                  Biaya Pengiriman ({formatNumber(data.quantity)} L x{" "}
                  {formatNumber(data.delivery_price_per_litre)}/L)
                </Text>
              </View>
              <View style={[a4Styles.cell, { width: 60 }]}>
                <Text></Text>
              </View>
              <View style={[a4Styles.cell, { width: 80 }]}>
                <Text></Text>
              </View>
              <View style={[a4Styles.cell, a4Styles.right, { width: 80 }]}>
                <Text>{formatNumber(deliveryTotal)}</Text>
              </View>
            </View>
          )}
          {taxLines.map((tax, taxIdx) => (
            <View key={`tax-${taxIdx}`} style={a4Styles.tableRow}>
              <View style={[a4Styles.cell, { width: 160 }]}>
                <Text>{tax.name}</Text>
              </View>
              <View style={[a4Styles.cell, { width: 60 }]}>
                <Text></Text>
              </View>
              <View style={[a4Styles.cell, { width: 80 }]}>
                <Text></Text>
              </View>
              <View style={[a4Styles.cell, a4Styles.right, { width: 80 }]}>
                <Text>{formatNumber(tax.amount)}</Text>
              </View>
            </View>
          ))}
          <View style={a4Styles.tableRow}>
            <View style={[a4Styles.cell, a4Styles.headerCell, { width: 160 }]}>
              <Text style={{ fontWeight: "bold" }}>Grand Total</Text>
            </View>
            <View style={[a4Styles.cell, { width: 60 }]}>
              <Text></Text>
            </View>
            <View style={[a4Styles.cell, { width: 80 }]}>
              <Text></Text>
            </View>
            <View
              style={[
                a4Styles.cell,
                a4Styles.headerCell,
                a4Styles.right,
                { width: 80 },
              ]}
            >
              <Text style={{ fontWeight: "bold" }}>
                {formatNumber(grandTotal)}
              </Text>
            </View>
          </View>
        </View>
        {data.term_of_payment && (
          <View style={a4Styles.section}>
            <Text style={{ fontWeight: "bold", marginBottom: 3 }}>
              Term of Payment
            </Text>
            <Text>{data.term_of_payment}</Text>
          </View>
        )}
        {data.is_note_enabled && data.note && (
          <View style={a4Styles.section}>
            <Text style={{ fontWeight: "bold", marginBottom: 3 }}>
              Catatan / Note
            </Text>
            <Text>{data.note}</Text>
          </View>
        )}
        {data.bank_accounts && data.bank_accounts.length > 0 && (
          <View style={a4Styles.section}>
            <Text style={{ fontWeight: "bold", marginBottom: 3 }}>
              Rekening Pembayaran / Payment Account
            </Text>
            {data.bank_accounts.map((b, i) => (
              <Text key={i} style={{ fontSize: 9 }}>
                {b.name} - {b.bank_name} {b.branch ? `(${b.branch})` : ""} :{" "}
                {b.account_number} a.n. {b.account_name}
              </Text>
            ))}
          </View>
        )}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: 20,
          }}
        >
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 9 }}>Penerima,</Text>
            <View style={{ height: 50 }} />
            <Text style={{ fontSize: 9 }}>( _________________________ )</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 9 }}>Hormat kami,</Text>
            <View style={{ height: 50 }} />
            <Text style={{ fontSize: 9 }}>( _________________________ )</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}

const DeliveryOrderDocument = ({
  company,
  data,
}: {
  company: CompanyInfo
  data: DeliveryOrderData
}) => {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={a5Styles.page}>
        <View>
          <Text style={a5Styles.title}>SURAT JALAN / DELIVERY ORDER</Text>
          <View style={a5Styles.subTitle}>
            <Text>{data.do_number}</Text>
            <Text>
              Palembang,{" "}
              {data.do_date
                ? format(new Date(data.do_date), "dd MMMM yyyy", {
                    locale: dateLocaleId,
                  })
                : "-"}
            </Text>
          </View>
        </View>
        <View style={a5Styles.blueLine} />
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: 10,
          }}
        >
          <View style={{ width: 270 }}>
            <View style={a5Styles.row}>
              <Text style={{ width: 50 }}>Shipped to</Text>
              <Text style={a5Styles.colon}>:</Text>
              <Text>{data.company_name}</Text>
            </View>
            <View style={a5Styles.row}>
              <Text style={{ width: 50 }}>Location</Text>
              <Text style={a5Styles.colon}>:</Text>
              <Text>{data.delivery_address_label || "-"}</Text>
            </View>
            <View style={a5Styles.row}>
              <Text style={{ width: 50 }}></Text>
              <Text style={a5Styles.colon}></Text>
              <Text>{data.delivery_address || "-"}</Text>
            </View>
            <View style={a5Styles.row}>
              <Text style={{ width: 50 }}>PIC</Text>
              <Text style={a5Styles.colon}>:</Text>
              <Text>{data.PIC || "-"}</Text>
            </View>
            <View style={a5Styles.row}>
              <Text style={{ width: 50 }}>Phone</Text>
              <Text style={a5Styles.colon}>:</Text>
              <Text>{data.PIC_phone || "-"}</Text>
            </View>
          </View>
          <View style={{ width: 200 }}>
            <View style={a5Styles.row}>
              <Text style={{ width: 50 }}>PO No.</Text>
              <Text style={a5Styles.colon}>:</Text>
              <Text>{data.po_no || "-"}</Text>
            </View>
            <View style={a5Styles.row}>
              <Text style={{ width: 50 }}>PO Date</Text>
              <Text style={a5Styles.colon}>:</Text>
              <Text>{data.po_date || "-"}</Text>
            </View>
            <View style={a5Styles.row}>
              <Text style={{ width: 50 }}>Transporter</Text>
              <Text style={a5Styles.colon}>:</Text>
              <Text>{data.transporter_name || "-"}</Text>
            </View>
            <View style={a5Styles.row}>
              <Text style={{ width: 50 }}>License</Text>
              <Text style={a5Styles.colon}>:</Text>
              <Text>{data.vehicle_number || "-"}</Text>
            </View>
            <View style={a5Styles.row}>
              <Text style={{ width: 50 }}>Driver</Text>
              <Text style={a5Styles.colon}>:</Text>
              <Text>{data.driver_name || "-"}</Text>
            </View>
          </View>
        </View>
        <View style={[a5Styles.table, { marginTop: 5 }]}>
          <View style={a5Styles.tableRow}>
            <View style={[a5Styles.cell, a5Styles.headerCell, { flex: 1 }]}>
              <Text>Product</Text>
            </View>
            <View style={[a5Styles.cell, a5Styles.headerCell, { flex: 1 }]}>
              <Text>Quantity (L)</Text>
            </View>
            <View style={[a5Styles.cell, a5Styles.headerCell, { flex: 1 }]}>
              <Text>Seal</Text>
            </View>
            <View
              style={[
                a5Styles.cell,
                a5Styles.headerCell,
                { flex: 3, borderRight: 0 },
              ]}
            >
              <Text>Remarks</Text>
            </View>
          </View>
          <View style={[a5Styles.tableRow, { borderBottom: 0 }]}>
            <View style={[a5Styles.cell, { flex: 1, alignItems: "center" }]}>
              <Text>{data.product_name || "-"}</Text>
            </View>
            <View style={[a5Styles.cell, { flex: 1, alignItems: "center" }]}>
              <Text>{formatNumber(data.quantity)}</Text>
            </View>
            <View style={[a5Styles.cell, { flex: 1, alignItems: "center" }]}>
              {(data.compartments || []).map((c, i) => (
                <Text key={i} style={{ height: "20" }}>
                  {c.seal_number}
                </Text>
              ))}
            </View>
            <View style={[a5Styles.cell, { flex: 3, borderRight: 0 }]}>
              <View
                style={[
                  a5Styles.cell,
                  { flexDirection: "column", borderRight: 0 },
                ]}
              >
                <View style={[a5Styles.cell, a5Styles.remarks]}>
                  <Text style={{ width: "25%" }}>Density</Text>
                  <View style={{ flexDirection: "column", width: "75%" }}>
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <Text style={{ width: 30 }}></Text>
                      <Text style={[a5Styles.colon]}>:</Text>
                    </View>
                  </View>
                </View>
                <View style={[a5Styles.cell, a5Styles.remarks]}>
                  <Text style={{ width: "25%" }}>Temperature</Text>
                  <View style={{ flexDirection: "column", width: "75%" }}>
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <Text style={{ width: 30 }}></Text>
                      <Text style={[a5Styles.colon]}>:</Text>
                    </View>
                  </View>
                </View>
                <View
                  style={[
                    a5Styles.cell,
                    a5Styles.remarks,
                    { height: 36, alignItems: "center" },
                  ]}
                >
                  <Text style={{ width: "20%" }}>Tera</Text>
                  <View style={{ flexDirection: "column", width: "80%" }}>
                    <View
                      style={{
                        flexDirection: "row",
                        height: 18,
                        alignItems: "center",
                        borderBottom: "1px solid gray",
                        paddingHorizontal: 5,
                      }}
                    >
                      <Text style={{ width: 30 }}>Front</Text>
                      <Text style={a5Styles.colon}>:</Text>
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        height: 18,
                        alignItems: "center",
                        paddingHorizontal: 5,
                      }}
                    >
                      <Text style={{ width: 30 }}>Back</Text>
                      <Text style={a5Styles.colon}>:</Text>
                    </View>
                  </View>
                </View>
                <View
                  style={[
                    a5Styles.cell,
                    a5Styles.remarks,
                    { height: 36, alignItems: "center" },
                  ]}
                >
                  <Text style={{ width: "20%" }}>Manual Stick</Text>
                  <View style={{ flexDirection: "column", width: "80%" }}>
                    <View
                      style={{
                        flexDirection: "row",
                        height: 18,
                        alignItems: "center",
                        borderBottom: "1px solid gray",
                        paddingHorizontal: 5,
                      }}
                    >
                      <Text style={{ width: 30 }}>Front</Text>
                      <Text style={[a5Styles.colon]}>:</Text>
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        height: 18,
                        alignItems: "center",
                        paddingHorizontal: 5,
                      }}
                    >
                      <Text style={{ width: 30 }}>Back</Text>
                      <Text style={[a5Styles.colon]}>:</Text>
                    </View>
                  </View>
                </View>
                <View
                  style={[
                    a5Styles.cell,
                    a5Styles.remarks,
                    { borderWidth: "0", alignItems: "center" },
                  ]}
                >
                  <Text style={{ width: "25%" }}>Flowmeter</Text>
                  <View style={{ flexDirection: "column", width: "75%" }}>
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <Text style={{ width: 30 }}></Text>
                      <Text style={[a5Styles.colon]}>:</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={[a5Styles.section, { flexDirection: "row" }]}>
          <Text style={{ fontWeight: "bold" }}>Keterangan : </Text>
          {data.note && (
            <Text style={a5Styles.paragraph}>
              {parseHtmlToComponents(data.note)}
            </Text>
          )}
        </View>

        <View style={a5Styles.signatureArea}>
          <View style={a5Styles.signatureBox}>
            <Text style={a5Styles.signatureTitle}>Supplier</Text>
            <Text style={[a5Styles.signatureSpace]}></Text>
            <Text style={[a5Styles.signatureFooter, { borderTop: 0 }]}> </Text>
            <Image src={company.logo_url} style={[a5Styles.stamp]} />
            <Text style={[a5Styles.signatureFooter, { textAlign: "center" }]}>
              {company.name}
            </Text>
          </View>
          <View style={a5Styles.signatureBox}>
            <Text style={a5Styles.signatureTitle}>Transporter</Text>
            <Text style={a5Styles.signatureSpace}></Text>
            <Text style={[a5Styles.signatureFooter, { textAlign: "center" }]}>
              Driver
            </Text>
            <Text style={[a5Styles.signatureFooter, { textAlign: "center" }]}>
              {data.driver_name}
            </Text>
          </View>
          <View style={a5Styles.signatureBox}>
            <Text style={a5Styles.signatureTitle}>Customer</Text>
            <Text style={a5Styles.signatureSpace}></Text>
            <View style={{ flexDirection: "row" }}>
              <Text style={[a5Styles.signatureFooter, { width: "36%" }]}>
                Receive By
              </Text>
              <Text style={[a5Styles.signatureFooter, { width: "64%" }]}>
                :
              </Text>
            </View>
            <View style={{ flexDirection: "row" }}>
              <Text style={[a5Styles.signatureFooter, { width: "36%" }]}>
                Date
              </Text>
              <Text style={[a5Styles.signatureFooter, { width: "64%" }]}>
                :
              </Text>
            </View>
          </View>
          <View style={[a5Styles.signatureBox, { borderRight: 0 }]}>
            <Text style={a5Styles.signatureTitle}>Security</Text>
            <Text style={a5Styles.signatureSpace}></Text>
            <View style={{ flexDirection: "row" }}>
              <Text style={[a5Styles.signatureFooter, { width: "36%" }]}>
                Receive By
              </Text>
              <Text style={[a5Styles.signatureFooter, { width: "64%" }]}>
                :
              </Text>
            </View>
            <View style={{ flexDirection: "row" }}>
              <Text style={[a5Styles.signatureFooter, { width: "36%" }]}>
                Date
              </Text>
              <Text style={[a5Styles.signatureFooter, { width: "64%" }]}>
                :
              </Text>
            </View>
          </View>
        </View>
        <Image src={company.logo_url} style={a5Styles.backgroundImage} />
      </Page>
    </Document>
  )
}

const PaymentDocument = ({
  company,
  data,
}: {
  company: CompanyInfo
  data: PaymentData
}) => {
  return (
    <Document>
      <Page size="A4" style={a4Styles.page}>
        <View style={a4Styles.header}>
          {(company.header_url || company.logo_url) && (
            <Image
              src={company.header_url || company.logo_url}
              style={a4Styles.logo}
            />
          )}
          <View style={a4Styles.companyInfo}>
            <Text style={a4Styles.companyName}>{company.name}</Text>
            <Text>{company.address}</Text>
            <Text>Email : {company.email}</Text>
          </View>
        </View>
        <View style={a4Styles.blueLine} />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View style={a4Styles.row}>
            <Text style={a4Styles.label}>No</Text>
            <Text style={a4Styles.colon}>:</Text>
            <Text>{data.payment_number}</Text>
          </View>
          <View style={a4Styles.row}>
            <Text>
              Palembang,{" "}
              {format(new Date(data.payment_date), "dd MMMM yyyy", {
                locale: dateLocaleId,
              })}
            </Text>
          </View>
        </View>
        <View style={a4Styles.row}>
          <Text style={a4Styles.label}>Perihal</Text>
          <Text style={a4Styles.colon}>:</Text>
          <Text>Bukti Pembayaran / Payment Receipt</Text>
        </View>
        <View style={a4Styles.section}>
          <Text style={{ marginBottom: 5 }}>Kepada Yth.</Text>
          <Text style={{ fontWeight: "bold" }}>{data.company_name}</Text>
        </View>
        <View style={a4Styles.table}>
          <View style={a4Styles.tableRow}>
            <View style={[a4Styles.cell, a4Styles.headerCell, { width: 180 }]}>
              <Text>Item</Text>
            </View>
            <View style={[a4Styles.cell, a4Styles.headerCell, { flex: 1 }]}>
              <Text>Value</Text>
            </View>
          </View>
          <View style={a4Styles.tableRow}>
            <View style={[a4Styles.cell, { width: 180 }]}>
              <Text>No. Invoice / Invoice Number</Text>
            </View>
            <View style={[a4Styles.cell, { flex: 1 }]}>
              <Text style={{ fontWeight: "bold" }}>{data.invoice_number}</Text>
            </View>
          </View>
          <View style={a4Styles.tableRow}>
            <View style={[a4Styles.cell, { width: 180 }]}>
              <Text>Tanggal Bayar / Payment Date</Text>
            </View>
            <View style={[a4Styles.cell, { flex: 1 }]}>
              <Text>
                {format(new Date(data.payment_date), "dd MMMM yyyy", {
                  locale: dateLocaleId,
                })}
              </Text>
            </View>
          </View>
          <View style={a4Styles.tableRow}>
            <View style={[a4Styles.cell, { width: 180 }]}>
              <Text>Metode Bayar / Payment Method</Text>
            </View>
            <View style={[a4Styles.cell, { flex: 1 }]}>
              <Text>{data.payment_method}</Text>
            </View>
          </View>
          {data.reference_number && (
            <View style={a4Styles.tableRow}>
              <View style={[a4Styles.cell, { width: 180 }]}>
                <Text>No. Referensi / Reference</Text>
              </View>
              <View style={[a4Styles.cell, { flex: 1 }]}>
                <Text>{data.reference_number}</Text>
              </View>
            </View>
          )}
          <View style={a4Styles.tableRow}>
            <View style={[a4Styles.cell, a4Styles.headerCell, { width: 180 }]}>
              <Text style={{ fontWeight: "bold" }}>Jumlah / Amount</Text>
            </View>
            <View
              style={[
                a4Styles.cell,
                a4Styles.headerCell,
                a4Styles.right,
                { flex: 1 },
              ]}
            >
              <Text style={{ fontWeight: "bold", fontSize: 12 }}>
                {formatNumber(data.amount)}
              </Text>
            </View>
          </View>
        </View>
        {data.note && (
          <View style={a4Styles.section}>
            <Text style={{ fontWeight: "bold", marginBottom: 3 }}>
              Catatan / Note
            </Text>
            <Text>{data.note}</Text>
          </View>
        )}
        {data.bank_accounts && data.bank_accounts.length > 0 && (
          <View style={a4Styles.section}>
            <Text style={{ fontWeight: "bold", marginBottom: 3 }}>
              Rekening Pembayaran / Payment Account
            </Text>
            {data.bank_accounts.map((b, i) => (
              <Text key={i} style={{ fontSize: 9 }}>
                {b.name} - {b.bank_name} {b.branch ? `(${b.branch})` : ""} :{" "}
                {b.account_number} a.n. {b.account_name}
              </Text>
            ))}
          </View>
        )}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: 20,
          }}
        >
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 9 }}>Pemberi,</Text>
            <View style={{ height: 50 }} />
            <Text style={{ fontSize: 9 }}>( _________________________ )</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 9 }}>Penerima,</Text>
            <View style={{ height: 50 }} />
            <Text style={{ fontSize: 9 }}>( _________________________ )</Text>
          </View>
        </View>
        {data.qr_code_url && (
          <View style={a4Styles.qrContainer}>
            <Image src={data.qr_code_url} style={a4Styles.qrImage} />
            <Text style={a4Styles.qrLabel}>Scan to verify</Text>
          </View>
        )}
      </Page>
    </Document>
  )
}

const InvoiceDocument = ({
  company,
  data,
}: {
  company: CompanyInfo
  data: InvoiceData
}) => {
  const subtotal = data.subtotal
  const deliveryTotal = data.quantity * data.delivery_price_per_litre
  const taxableAmount = data.delivery_taxable
    ? subtotal
    : subtotal - deliveryTotal
  const enabledTaxes = data.tax_details.filter((t) => t.enabled)
  const taxLines = enabledTaxes.map((t) => ({
    name: t.name,
    amount: Math.round(Math.max(0, taxableAmount) * (Number(t.rate) / 100)),
  }))
  const grandTotal = subtotal + taxLines.reduce((sum, t) => sum + t.amount, 0)

  return (
    <Document>
      <Page size="A4" style={a4Styles.page}>
        <View style={a4Styles.header}>
          {(company.header_url || company.logo_url) && (
            <Image
              src={company.header_url || company.logo_url}
              style={a4Styles.logo}
            />
          )}
          <View style={a4Styles.companyInfo}>
            <Text style={a4Styles.companyName}>{company.name}</Text>
            <Text>{company.address}</Text>
            <Text>Email : {company.email}</Text>
          </View>
        </View>
        <View style={a4Styles.blueLine} />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View style={a4Styles.row}>
            <Text style={a4Styles.label}>No</Text>
            <Text style={a4Styles.colon}>:</Text>
            <Text>{data.invoice_number}</Text>
          </View>
          <View style={a4Styles.row}>
            <Text>
              Palembang,{" "}
              {format(new Date(data.issue_date), "dd MMMM yyyy", {
                locale: dateLocaleId,
              })}
            </Text>
          </View>
        </View>
        <View style={a4Styles.row}>
          <Text style={a4Styles.label}>Perihal</Text>
          <Text style={a4Styles.colon}>:</Text>
          <Text>Invoice</Text>
        </View>
        <View style={a4Styles.row}>
          <Text style={a4Styles.label}></Text>
          <Text style={a4Styles.colon}></Text>
          <Text>
            Jatuh tempo s.d.{" "}
            {format(new Date(data.due_date), "dd MMMM yyyy", {
              locale: dateLocaleId,
            })}
          </Text>
        </View>
        {data.do_number && (
          <View style={a4Styles.row}>
            <Text style={a4Styles.label}></Text>
            <Text style={a4Styles.colon}></Text>
            <Text>
              DO: {data.do_number}
              {data.so_number ? ` / SO: ${data.so_number}` : ""}
            </Text>
          </View>
        )}
        <View style={a4Styles.section}>
          <Text style={{ marginBottom: 5 }}>Kepada Yth.</Text>
          <Text style={{ fontWeight: "bold" }}>{data.company_name}</Text>
        </View>
        <View style={a4Styles.table}>
          <View style={a4Styles.tableRow}>
            <View style={[a4Styles.cell, a4Styles.headerCell, { width: 160 }]}>
              <Text>Item</Text>
            </View>
            <View style={[a4Styles.cell, a4Styles.headerCell, { width: 60 }]}>
              <Text>Qty (L)</Text>
            </View>
            <View style={[a4Styles.cell, a4Styles.headerCell, { width: 80 }]}>
              <Text>Harga/L</Text>
            </View>
            <View style={[a4Styles.cell, a4Styles.headerCell, { width: 80 }]}>
              <Text>Subtotal</Text>
            </View>
          </View>
          <View style={a4Styles.tableRow}>
            <View style={[a4Styles.cell, { width: 160 }]}>
              <Text>{data.so_number ? `SO: ${data.so_number}` : "-"}</Text>
            </View>
            <View style={[a4Styles.cell, a4Styles.center, { width: 60 }]}>
              <Text>{formatNumber(data.quantity)}</Text>
            </View>
            <View style={[a4Styles.cell, a4Styles.right, { width: 80 }]}>
              <Text>{formatNumber(data.unit_price)}</Text>
            </View>
            <View style={[a4Styles.cell, a4Styles.right, { width: 80 }]}>
              <Text>{formatNumber(subtotal)}</Text>
            </View>
          </View>
          {data.delivery_price_per_litre > 0 && (
            <View style={a4Styles.tableRow}>
              <View style={[a4Styles.cell, { width: 160 }]}>
                <Text>
                  Biaya Pengiriman ({formatNumber(data.quantity)} L x{" "}
                  {formatNumber(data.delivery_price_per_litre)}/L)
                </Text>
              </View>
              <View style={[a4Styles.cell, { width: 60 }]}>
                <Text></Text>
              </View>
              <View style={[a4Styles.cell, { width: 80 }]}>
                <Text></Text>
              </View>
              <View style={[a4Styles.cell, a4Styles.right, { width: 80 }]}>
                <Text>
                  {formatNumber(data.quantity * data.delivery_price_per_litre)}
                </Text>
              </View>
            </View>
          )}
          <View style={a4Styles.tableRow}>
            <View style={[a4Styles.cell, { width: 160 }]}>
              <Text style={{ fontWeight: "bold" }}>Subtotal</Text>
            </View>
            <View style={[a4Styles.cell, { width: 60 }]}>
              <Text></Text>
            </View>
            <View style={[a4Styles.cell, { width: 80 }]}>
              <Text></Text>
            </View>
            <View style={[a4Styles.cell, a4Styles.right, { width: 80 }]}>
              <Text style={{ fontWeight: "bold" }}>
                {formatNumber(subtotal)}
              </Text>
            </View>
          </View>
          {taxLines.map((tax, taxIdx) => (
            <View key={`tax-${taxIdx}`} style={a4Styles.tableRow}>
              <View style={[a4Styles.cell, { width: 160 }]}>
                <Text>{tax.name}</Text>
              </View>
              <View style={[a4Styles.cell, { width: 60 }]}>
                <Text></Text>
              </View>
              <View style={[a4Styles.cell, { width: 80 }]}>
                <Text></Text>
              </View>
              <View style={[a4Styles.cell, a4Styles.right, { width: 80 }]}>
                <Text>{formatNumber(tax.amount)}</Text>
              </View>
            </View>
          ))}
          <View style={a4Styles.tableRow}>
            <View style={[a4Styles.cell, a4Styles.headerCell, { width: 160 }]}>
              <Text style={{ fontWeight: "bold" }}>Grand Total</Text>
            </View>
            <View style={[a4Styles.cell, { width: 60 }]}>
              <Text></Text>
            </View>
            <View style={[a4Styles.cell, { width: 80 }]}>
              <Text></Text>
            </View>
            <View
              style={[
                a4Styles.cell,
                a4Styles.headerCell,
                a4Styles.right,
                { width: 80 },
              ]}
            >
              <Text style={{ fontWeight: "bold" }}>
                {formatNumber(grandTotal)}
              </Text>
            </View>
          </View>
        </View>
        {data.qr_code_url && (
          <View style={{ alignItems: "center", marginTop: 10 }}>
            <Image src={data.qr_code_url} style={{ width: 80, height: 80 }} />
          </View>
        )}
        {data.is_note_enabled && data.note && (
          <View style={a4Styles.section}>
            <Text style={{ fontWeight: "bold", marginBottom: 3 }}>
              Catatan / Note
            </Text>
            <Text>{data.note}</Text>
          </View>
        )}
        {data.bank_accounts && data.bank_accounts.length > 0 && (
          <View style={a4Styles.section}>
            <Text style={{ fontWeight: "bold", marginBottom: 3 }}>
              Rekening Pembayaran / Payment Account
            </Text>
            {data.bank_accounts.map((b, i) => (
              <Text key={i} style={{ fontSize: 9 }}>
                {b.name} - {b.bank_name} {b.branch ? `(${b.branch})` : ""} :{" "}
                {b.account_number} a.n. {b.account_name}
              </Text>
            ))}
          </View>
        )}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: 20,
          }}
        >
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 9 }}>Penerima,</Text>
            <View style={{ height: 50 }} />
            <Text style={{ fontSize: 9 }}>( _________________________ )</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 9 }}>Hormat kami,</Text>
            <View style={{ height: 50 }} />
            <Text style={{ fontSize: 9 }}>( _________________________ )</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}

async function generateInvoicePDFReact(
  company: CompanyInfo,
  data: InvoiceData,
  options: { save?: boolean; output?: "datauri" | "blob" } = { save: true },
  contentHash?: string
) {
  const processedCompany = { ...company }
  let qrCodeDataUrl: string | undefined = undefined
  if (data.id) {
    try {
      const origin =
        typeof window !== "undefined"
          ? window.location.origin
          : process.env.NEXT_PUBLIC_APP_URL || ""
      const verifyUrl = contentHash
        ? `${origin}/verify/invoice/${data.id}?h=${contentHash}`
        : `${origin}/verify/invoice/${data.id}`
      qrCodeDataUrl = await QRCode.toDataURL(verifyUrl, {
        margin: 1,
        width: 200,
      })
      if (options.save && contentHash) {
        try {
          const supabase = createClient()
          await supabase
            .from("invoices")
            .update({ content_hash: contentHash })
            .eq("id", data.id)
        } catch (dbErr) {
          console.error("Failed to save content hash to DB:", dbErr)
        }
      }
    } catch (err) {
      console.error("Failed to generate QR code:", err)
    }
  }
  const asPdf = pdf(
    <InvoiceDocument
      company={processedCompany}
      data={{
        ...data,
        qr_code_url: qrCodeDataUrl,
        bank_accounts: data.bank_accounts,
      }}
    />
  )
  const blob = await asPdf.toBlob()
  if (options.save) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `Invoice_${data.invoice_number}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    return null
  }
  if (options.output === "datauri") {
    return new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.readAsDataURL(blob)
    })
  }
  return blob
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function calculateBilledQuantity(doInfo: any): number {
  if (!doInfo) return 0
  const qtySent = Number(doInfo.quantity) || 0
  const qtyReceived =
    doInfo.received_quantity !== null && doInfo.received_quantity !== undefined
      ? Number(doInfo.received_quantity)
      : null

  if (qtyReceived === null) {
    return qtySent
  }

  if (qtyReceived > qtySent) {
    return qtySent
  }

  const shrinkageLimitPercent = Number(doInfo.so?.shrinkage_tolerance) || 0
  const allowedShrinkage = qtySent * (shrinkageLimitPercent / 100)
  const actualShrinkage = qtySent - qtyReceived

  if (actualShrinkage > allowedShrinkage) {
    return qtyReceived
  }

  return qtySent
}

export async function generateStandardInvoicePDF(
  companyInfo: any,
  inv: any,
  options: { save?: boolean; output?: "datauri" | "blob" } = { save: true }
) {
  const quantity = calculateBilledQuantity(inv.do) || inv.quantity || 0
  const unitPrice = inv.do?.so?.unit_price || 0
  const deliveryPricePerLitre = inv.do?.so?.delivery_price_per_litre || 0
  const subtotal = quantity * unitPrice + quantity * deliveryPricePerLitre

  // Compute hash from the RAW DB row so it matches server-side verification.
  let contentHash: string | undefined
  try {
    const canonicalData = getInvoiceCanonicalData(
      inv as unknown as Record<string, unknown>
    )
    contentHash = await computeHash(canonicalSerialize(canonicalData))
  } catch (err) {
    console.error("Failed to compute content hash:", err)
  }

  return await generateInvoicePDFReact(
    {
      name: companyInfo?.name || "PT Anugerah Buana Sriwijaya",
      address: companyInfo?.address || "",
      email: companyInfo?.email || "",
      logo_url: companyInfo?.logo_url,
      header_url: companyInfo?.header_url,
    },
    {
      id: inv.id,
      invoice_number: inv.invoice_number,
      issue_date: inv.issue_date,
      due_date: inv.due_date,
      company_name: inv.company?.name || "-",
      do_number: inv.do?.do_number,
      so_number: inv.do?.so?.so_number,
      quantity,
      unit_price: unitPrice,
      delivery_price_per_litre: deliveryPricePerLitre,
      subtotal,
      tax_details: inv.tax_details || [],
      delivery_taxable:
        inv.do?.so?.delivery_taxable ?? inv.delivery_taxable ?? false,
      total_amount: inv.total_amount || 0,
      note: inv.is_note_enabled ? inv.note : "",
      is_note_enabled: true,
      bank_accounts: inv.bank_accounts || [],
    },
    options,
    contentHash
  )
}

async function generateQuotationPDFReact(
  company: CompanyInfo,
  data: QuotationData,
  options: { save?: boolean; output?: "datauri" | "blob" } = { save: true },
  contentHash?: string
) {
  const processedCompany = { ...company }
  let qrCodeDataUrl: string | undefined = undefined
  if (data.id) {
    try {
      const origin =
        typeof window !== "undefined"
          ? window.location.origin
          : process.env.NEXT_PUBLIC_APP_URL || ""
      const verifyUrl = contentHash
        ? `${origin}/verify/quotation/${data.id}?h=${contentHash}`
        : `${origin}/verify/quotation/${data.id}`
      qrCodeDataUrl = await QRCode.toDataURL(verifyUrl, {
        margin: 1,
        width: 200,
      })
      if (options.save && contentHash) {
        try {
          const supabase = createClient()
          await supabase
            .from("quotations")
            .update({ content_hash: contentHash })
            .eq("id", data.id)
        } catch (dbErr) {
          console.error("Failed to save content hash to DB:", dbErr)
        }
      }
    } catch (err) {
      console.error("Failed to generate QR code:", err)
    }
  }
  const asPdf = pdf(
    <QuotationDocument
      company={processedCompany}
      data={{ ...data, qr_code_url: qrCodeDataUrl }}
    />
  )
  const blob = await asPdf.toBlob()
  if (options.save) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `Quotation_${data.quotation_number}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    return null
  }
  if (options.output === "datauri") {
    return new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.readAsDataURL(blob)
    })
  }
  return blob
}

export async function generateStandardQuotationPDF(
  companyInfo: any,
  q: any,
  options: { save?: boolean; output?: "datauri" | "blob" } = { save: true }
) {
  // Compute hash from the RAW DB row so it matches server-side verification.
  // The shaped QuotationData below uses different key names (min_order, shrinkage)
  // and omits fields, so hashing it would never match the API's raw-row hash.
  let contentHash: string | undefined
  try {
    const canonicalData = getQuotationCanonicalData(
      q as unknown as Record<string, unknown>
    )
    contentHash = await computeHash(canonicalSerialize(canonicalData))
  } catch (err) {
    console.error("Failed to compute content hash:", err)
  }

  return await generateQuotationPDFReact(
    {
      name: companyInfo?.name || "PT Anugerah Buana Sriwijaya",
      address: companyInfo?.address || "",
      email: companyInfo?.email || "",
      logo_url: companyInfo?.logo_url,
      header_url: companyInfo?.header_url,
    },
    {
      id: q.id,
      quotation_number: q.quotation_number,
      quotation_date: q.quotation_date,
      expiry_date: q.expiry_date,
      company_name: q.company?.name || "-",
      contact_person: q.company?.details?.contact_person || "-",
      product_sku: q.product?.sku || "-",
      product_name: q.product?.name || "-",
      delivery_address: q.delivery_address || "-",
      base_price: q.base_price || 0,
      delivery_price: q.delivery_price || 0,
      min_order: q.minimum_order || 0,
      shrinkage: q.shrinkage_tolerance,
      content: q.is_content_enabled ? q.content : "",
      discounts: q.discounts || [],
      note: q.is_note_enabled ? q.note : "",
      terms_conditions: q.is_terms_enabled ? q.terms_conditions : "",
      closing_remarks: q.is_closing_enabled ? q.closing_remarks : "",
      bank_accounts: q.bank_accounts || [],
      tax_details: q.tax_details || [],
      delivery_taxable: q.delivery_taxable ?? false,
    },
    options,
    contentHash
  )
}

async function generateSalesOrderPDFReact(
  company: CompanyInfo,
  data: SalesOrderData,
  options: { save?: boolean; output?: "datauri" | "blob" } = { save: true }
) {
  const blob = await pdf(
    <SalesOrderDocument company={company} data={data} />
  ).toBlob()
  if (options.save !== false) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `SO_${data.so_number}.pdf`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  if (options.output === "datauri") {
    const buffer = await blob.arrayBuffer()
    return `data:application/pdf;base64,${Buffer.from(buffer).toString("base64")}`
  }
  return blob
}

export async function generateStandardSalesOrderPDF(
  companyInfo: any,
  so: any,
  options: { save?: boolean; output?: "datauri" | "blob" } = { save: true }
) {
  return await generateSalesOrderPDFReact(
    {
      name: companyInfo?.name || "PT Anugerah Buana Sriwijaya",
      address: companyInfo?.address || "",
      email: companyInfo?.email || "",
      logo_url: companyInfo?.logo_url,
      header_url: companyInfo?.header_url,
    },
    {
      id: so.id,
      so_number: so.so_number,
      so_date: so.so_date,
      delivery_date: so.delivery_date,
      company_name: so.company?.name || "-",
      contact_person: so.company?.details?.contact_person || "-",
      product_name: so.product?.name || "-",
      product_sku: so.product?.sku || "-",
      quantity: so.quantity || 0,
      unit_price: so.unit_price || 0,
      discount: so.discount || 0,
      delivery_price_per_litre: so.delivery_price_per_litre || 0,
      tax_details: so.tax_details || [],
      delivery_taxable: so.delivery_taxable ?? false,
      term_of_payment: so.term_of_payment || "",
      delivery_address: so.delivery_address || "",
      note: so.note || "",
      is_note_enabled: true,
      bank_accounts: so.bank_accounts || [],
    },
    options
  )
}

async function generateDeliveryOrderPDFReact(
  company: CompanyInfo,
  data: DeliveryOrderData,
  options: { save?: boolean; output?: "datauri" | "blob" } = { save: true }
) {
  const blob = await pdf(
    <DeliveryOrderDocument company={company} data={data} />
  ).toBlob()
  if (options.save) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `DO_${data.do_number}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    return null
  }
  if (options.output === "datauri") {
    return new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.readAsDataURL(blob)
    })
  }
  return blob
}

export async function generateStandardDeliveryOrderPDF(
  companyInfo: any,
  doRecord: any,
  options: { save?: boolean; output?: "datauri" | "blob" } = { save: true }
) {
  let deliveryAddressLabel: string | undefined = undefined
  if (doRecord.delivery_address && doRecord.company?.details?.addresses) {
    const addresses = doRecord.company.details.addresses as {
      label: string
      address: string
    }[]
    const matched = addresses.find(
      (a: any) => a.address === doRecord.delivery_address
    )
    if (matched) {
      deliveryAddressLabel = matched.label
    }
  }

  const driverInfo = doRecord.driver_info as {
    name?: string
    phone?: string
  } | null

  return await generateDeliveryOrderPDFReact(
    {
      name: companyInfo?.name || "PT Anugerah Buana Sriwijaya",
      address: companyInfo?.address || "",
      email: companyInfo?.email || "",
      logo_url: companyInfo?.logo_url || "/images/company-logo.jpg",
      header_url: companyInfo?.header_url,
    },
    {
      id: doRecord.id,
      do_number: doRecord.do_number,
      do_date: doRecord.do_date,
      company_name: doRecord.company?.name || "-",
      supplier_name: doRecord.supplier?.name,
      transporter_name: doRecord.transporter?.name,
      vehicle_number:
        doRecord.vehicle?.license_number || doRecord.vehicle_number,
      driver_name: driverInfo?.name || doRecord.driver_name || "-",
      driver_phone: driverInfo?.phone || doRecord.driver_phone || "-",
      product_name: doRecord.product?.name,
      quantity: doRecord.quantity || 0,
      delivery_address_label: deliveryAddressLabel,
      delivery_address: doRecord.delivery_address || "-",
      po_no: doRecord.po.po_number,
      po_date: doRecord.po?.so_date,
      PIC: doRecord.company?.details?.contact_person,
      PIC_phone: doRecord.company?.details?.phone,
      note: doRecord.is_note_enabled ? doRecord.note : "",
      compartments: (doRecord.compartments || []).map((c: any) => ({
        compartment_number: c.compartment_number || 0,
        seal_number: c.seal_number || "",
        quantity: c.quantity || 0,
      })),
    },
    options
  )
}

async function generatePaymentPDFReact(
  company: CompanyInfo,
  data: PaymentData,
  options: { save?: boolean; output?: "datauri" | "blob" } = { save: true }
) {
  const blob = await pdf(
    <PaymentDocument company={company} data={data} />
  ).toBlob()
  if (options.save) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `Payment_${data.payment_number}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    return null
  }
  if (options.output === "datauri") {
    return new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.readAsDataURL(blob)
    })
  }
  return blob
}

export async function generateStandardPaymentPDF(
  companyInfo: any,
  payment: any,
  options: { save?: boolean; output?: "datauri" | "blob" } = { save: true }
) {
  return await generatePaymentPDFReact(
    {
      name: companyInfo?.name || "PT Anugerah Buana Sriwijaya",
      address: companyInfo?.address || "",
      email: companyInfo?.email || "",
      logo_url: companyInfo?.logo_url || "/images/company-logo.jpg",
      header_url: companyInfo?.header_url,
    },
    {
      id: payment.id,
      payment_number: payment.payment_number,
      payment_date: payment.payment_date,
      company_name: payment.invoice?.company?.name || "-",
      invoice_number: payment.invoice?.invoice_number || "-",
      amount: payment.amount || 0,
      payment_method: payment.payment_method || "Bank Transfer",
      reference_number: payment.reference_number,
      note: payment.note || "",
      bank_accounts: payment.invoice?.bank_accounts || [],
    },
    options
  )
}
