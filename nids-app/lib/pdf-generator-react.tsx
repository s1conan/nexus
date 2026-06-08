import React from "react"
import { Document, Page, Text, View, StyleSheet, Image, Font, pdf } from "@react-pdf/renderer"
import { format } from "date-fns"
import { id } from "date-fns/locale"
import { formatNumber } from "./formatters";
import { Bold, Weight } from "lucide-react";
// import ttd from './images/ttd-indah.png';


Font.register({
  family: 'Calibri',
  fonts: [
    { src: '/fonts/Calibri.ttf', fontWeight: 400 }, // Regular
    { src: '/fonts/Calibri-Bold.ttf', fontWeight: 700 }, // Bold
    { src: '/fonts/Calibri-Italic.ttf', fontStyle: 'italic', fontWeight: 400 }, // Italic
  ],
});

interface CompanyInfo {
  name: string
  address: string
  email: string
  phone?: string
  logo_url?: string
}

interface QuotationData {
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
  discounts: { label: string; value: number }[]
  note: string
  terms_conditions: string
  closing_remarks: string
  bank_accounts: { name: string; bank_name?: string; account_number: string; account_name: string; branch: string }[]
}

function createPDFElement(tag: string, children: React.ReactNode[], key: number, meta?: { marker?: string }) {
  switch (tag) {
    case 'p':
      return (
        <Text key={key} style={styles.innerText}>
          {children}
        </Text>
      )
    case 'ul':
      return (
        <View key={key} style={styles.ul} >{children}</View>
      )
    case 'ol':
      return (
        <View key={key} style={styles.ol} >{children}</View>
      )
    case 'li':
      return (
        <View key={key} style={styles.li} >
          <Text style={{ width: 12 }} >{meta?.marker || '•'}</Text>
          <Text style={{ alignItems: 'flex-end' }} >{children}</Text>
        </View>
      )
    case 'b':
    case 'strong':
      return (
        <Text key={key} style={{ fontWeight: 'bold' }}>
          {children}
        </Text>
      )
    case 'i':
    case 'em':
      return (
        <Text key={key} style={{ fontStyle: 'italic' }}>
          {children}
        </Text>
      )
    case 'u':
      return (
        <Text key={key} style={{ textDecoration: 'underline' }}>
          {children}
        </Text>
      )
    default:
      return <Text key={key}>{children}</Text>
  }
}

function parseHtmlToComponents(htmlString: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const regex = /(<[^>]+>|[^<]+)/g
  let match
  let key = 0

  const stack: { tag: string; children: React.ReactNode[]; olIndex?: number }[] = []

  while ((match = regex.exec(htmlString)) !== null) {
    const token = match[0]

    if (token.startsWith('</')) {
      const tag = token.slice(2, -1)
      if (stack.length > 0 && stack[stack.length - 1].tag === tag) {
        const top = stack.pop()!
        const marker = tag === 'li' && stack.length > 0 && stack[stack.length - 1].tag === 'ol'
          ? `${stack[stack.length - 1].olIndex || 1}. `
          : '• '

        if (tag === 'li' && stack.length > 0 && stack[stack.length - 1].tag === 'ol') {
          stack[stack.length - 1].olIndex = (stack[stack.length - 1].olIndex || 1) + 1
        }

        const element = createPDFElement(tag, top.children, key++, tag === 'li' ? { marker } : undefined)
        if (stack.length > 0) {
          stack[stack.length - 1].children.push(element)
        } else {
          parts.push(element)
        }
      }
    } else if (token.startsWith('<')) {
      const tagMatch = token.match(/<(\w+)/)
      const tag = tagMatch ? tagMatch[1].toLowerCase() : ''
      const selfClosing = token.endsWith('/>') || tag === 'br'

      if (tag === 'br') {
        parts.push(<Text key={key++}>{'\n'}</Text>)
        continue
      }

      if (!selfClosing) {
        stack.push({ tag, children: [], olIndex: tag === 'ol' ? 1 : undefined })
      }
    } else if (token.trim()) {
      const textElement = <Text key={key++}>{token}</Text>
      if (stack.length > 0) {
        stack[stack.length - 1].children.push(textElement)
      } else {
        parts.push(textElement)
      }
    }
  }

  return parts
}


const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 30,
    paddingVertical: 15,
    fontSize: 10,
    fontFamily: "Calibri",
    lineHeight: 1,
  },

  backgroundImage: {
    position: 'absolute',
    opacity: "0.06",
    top: 85,
    left: 0,
    right: 0,
    zIndex: -1,
    objectFit: 'contain',     // Option A: Keeps the whole image visible without clipping (leaves blank space)
    // objectFit: 'cover',   // Option B: Fills the entire space completely (clips edges if ratios don't match)

    objectPosition: 'center',
  },

  header: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    marginBottom: 5,
  },

  logo: {
    width: 70,
    height: 70,
    marginRight: 10,
  },

  companyInfo: {
    fontSize: 11,
    textSpacing: 1,
    lineHeight: 1.5,
  },

  companyName: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
    textSpacing: 2,
  },

  blueLine: {
    height: 2,
    backgroundColor: "#1e3a8a",
    marginBottom: 15,
  },

  row: {
    flexDirection: "row",
    marginBottom: 2,
  },

  label: {
    width: 60,
  },

  colon: {
    width: 10,
  },

  section: {
    marginTop: 9,
  },

  paragraph: {
    marginTop: 10,
    lineHeight: 1,
    textAlign: "justify",
  },

  innerText: {
    lineHeight: 0.8,
    margin: 0,
  },

  table: {
    marginTop: 7,
    backgroundColor: "#000",
    flexDirection: "column",
    paddingVertical: 1,
    gap: 0,
    alignSelf: 'center'
  },

  tableRow: {
    flexDirection: "row",
    alignSelf: 'flex-start',
    display: 'flex',
    gap: 1,
    paddingHorizontal: "1",
    alignItems: 'center',
    height: '19',
  },

  headerCell: {
    backgroundColor: "#d9f3f8",
    fontWeight: "bold",
    display: 'flex',
    textAlign: "center",
    alignItems: 'center',
  },

  cell: {
    padding: 3,
    backgroundColor: "white",
    fontSize: 10,
    height: "18",
    display: 'flex',          // Enables flexbox layout engines
    justifyContent: 'center', // Centers text vertically if cell has height
  },

  center: {
    textAlign: "center",
  },

  right: {
    textAlign: "right",
  },

  terms: {
    marginTop: 5,
    marginLeft: 10,
    lineHeight: 0.8,
  },

  signature: {
    marginTop: 15,
    display: "flex",
    alignItems: "center",
    width: 80,
  },

  stamp: {
    opacity: "0.5",
    width: 70,
    height: 70,
    objectFit: 'contain',
    objectPosition: 'center',
    zIndex: 2,
  },

  ttd: {
    position: "absolute",
    top: 5,
    left: 0,
    width: 100,
    height: 70,
    objectFit: 'fill',
    objectPosition: 'center',
  },

  ul: {
    marginLeft: 10,
    marginTop: 3,
    padding: 0,
  },
  ol: {
    marginLeft: 10,
    marginTop: 3,
  },
  li: {
    flexDirection: "row",
    marginBottom: 0,
  },
});

const QuotationDocument = ({ company, data }: { company: CompanyInfo, data: QuotationData }) => {
  const replacements: Record<string, string> = {
    quotation_number: data.quotation_number,
    quotation_date: data.quotation_date ? format(new Date(data.quotation_date), "dd MMMM yyyy", { locale: id }) : "",
    expiry_date: data.expiry_date ? format(new Date(data.expiry_date), "dd MMMM yyyy", { locale: id }) : "",
    company_name: data.company_name,
    contact_person: data.contact_person || "",
    delivery_address: data.delivery_address || "",
    product_name: data.product_name,
    price: formatNumber(data.base_price),
    min_order: formatNumber(data.min_order),
    shrinkage: data.shrinkage?.toString() || "0",
    bank_accounts: data.bank_accounts.map(b => b.name).join(", ")
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
      <Page size="A4" style={styles.page}>
        {/* Header */}

        <View style={styles.header}>
          {company.logo_url && (
            <Image src={company.logo_url} style={styles.logo} />
          )}

          <View style={styles.companyInfo}>
            <Text style={styles.companyName}>
              {company.name}
            </Text>

            <Text>
              {company.address}
            </Text>

            <Text>
              Email : {company.email}
            </Text>
          </View>
        </View>

        <View style={styles.blueLine} />

        {/* Letter Header */}

        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View style={styles.row}>
            <Text style={styles.label}>No</Text>
            <Text style={styles.colon}>:</Text>
            <Text>{data.quotation_number}</Text>
          </View>
          <View style={styles.row}>
            <Text>Palembang, {format(new Date(data.quotation_date), "dd MMMM yyyy", { locale: id })}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Perihal</Text>
          <Text style={styles.colon}>:</Text>
          <Text>Penawaran {data.product_name}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}></Text>
          <Text style={styles.colon}></Text>
          <Text>Berlaku s.d. {format(new Date(data.expiry_date), "dd MMMM yyyy", { locale: id })}</Text>
        </View>

        <View style={styles.section}>
          <Text style={{ marginBottom: 5 }}>Kepada Yth.</Text>
          <Text style={{ fontWeight: "bold" }}>{data.company_name}</Text>
        </View>

        {processedContent && (
          <View style={styles.paragraph}>
            {parseHtmlToComponents(processedContent)}
          </View>
        )}

        {/* Pricing Table */}
        <View style={styles.table}>
          {/* Header Row */}
          <View style={styles.tableRow}>
            <View style={[styles.cell, styles.headerCell, { width: 140 }]}>
              <Text style={{ alignItems: "center" }}>Price Components (per Liter)</Text>
            </View>
            <View style={[styles.cell, styles.headerCell, { width: 40 }]}>
              <Text>%</Text>
            </View>
            {data.discounts.map((d, i) => (
              <View key={i} style={[styles.cell, styles.headerCell, { width: 65 }]}>
                <Text>{d.label} {d.value}%</Text>
              </View>
            ))}
          </View>

          {/* Harga Dasar Pertamina */}
          <View style={styles.tableRow}>
            <View style={[styles.cell, { width: 140 }]}>
              <Text>Harga Dasar Pertamina</Text>
            </View>
            <View style={[styles.cell, styles.center, { width: 40 }]}>
              <Text> </Text>
            </View>
            {data.discounts.map((_, i) => (
              <View key={i} style={[styles.cell, styles.right, { width: 65 }]}>
                <Text>{formatNumber(data.base_price)}</Text>
              </View>
            ))}
          </View>

          {/* Discount Row */}
          <View style={styles.tableRow}>
            <View style={[styles.cell, { width: 140 }]}>
              <Text>Discount</Text>
            </View>
            <View style={[styles.cell, styles.center, { width: 40, height: 50 }]}>
              <Text> </Text>
            </View>
            {data.discounts.map((d, i) => (
              <View key={i} style={[styles.cell, styles.right, { width: 65 }]}>
                <Text>{formatNumber(Math.floor(data.base_price * (d.value / 100)))}</Text>
              </View>
            ))}
          </View>

          {/* Harga Dasar PT. ABS */}
          <View style={styles.tableRow}>
            <View style={[styles.cell, { width: 140 }]}>
              <Text>Harga Dasar PT. ABS</Text>
            </View>
            <View style={[styles.cell, styles.center, { width: 40 }]}>
              <Text> </Text>
            </View>
            {data.discounts.map((d, i) => (
              <View key={i} style={[styles.cell, styles.right, { width: 65 }]}>
                <Text style={{ fontWeight: "bold" }}>{formatNumber(data.base_price - (Math.floor(data.base_price * (d.value / 100))))}</Text>
              </View>
            ))}
          </View>


          {/* PPN 11% */}
          <View style={styles.tableRow}>
            <View style={[styles.cell, { width: 140 }]}>
              <Text>PPN</Text>
            </View>
            <View style={[styles.cell, styles.center, { width: 40 }]}>
              <Text>11%</Text>
            </View>
            {data.discounts.map((d, i) => {
              const discountValue = Math.round(data.base_price * (d.value / 100));
              const baseABS = data.base_price - discountValue;
              const taxableAmount = baseABS + data.delivery_price;
              const ppn = Math.round(taxableAmount * 0.11);
              return (
                <View key={i} style={[styles.cell, styles.right, { width: 65 }]}>
                  <Text>{formatNumber(ppn)}</Text>
                </View>
              );
            })}
          </View>

          {/* PBBKB 7.5% */}
          <View style={styles.tableRow}>
            <View style={[styles.cell, { width: 140 }]}>
              <Text>PBBKB</Text>
            </View>
            <View style={[styles.cell, styles.center, { width: 40 }]}>
              <Text>7.50%</Text>
            </View>
            {data.discounts.map((d, i) => {
              const discountValue = Math.round(data.base_price * (d.value / 100));
              const baseABS = data.base_price - discountValue;
              const taxableAmount = baseABS + data.delivery_price;
              const pbbkb = Math.round(taxableAmount * 0.075);
              return (
                <View key={i} style={[styles.cell, styles.right, { width: 65 }]}>
                  <Text>{formatNumber(pbbkb)}</Text>
                </View>
              );
            })}
          </View>

          {/* Biaya Pengiriman */}
          {data.delivery_price && (
            <View style={styles.tableRow}>
              <View style={[styles.cell, { width: 140 }]}>
                <Text>Biaya Pengiriman</Text>
              </View>
              <View style={[styles.cell, styles.center, { width: 40, height: 22, top: 2 }]}>
                <Text> </Text>
              </View>
              {data.discounts.map((_, i) => (
                <View key={i} style={[styles.cell, styles.right, { width: 65 }]}>
                  <Text>{formatNumber(Math.round(data.delivery_price))}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Total Harga Include Pajak */}
          <View style={styles.tableRow}>
            <View style={[styles.cell, { width: 140 }]}>
              <Text style={{ fontWeight: "bold" }}>Total Harga Include Pajak</Text>
            </View>
            <View style={[styles.cell, styles.center, { width: 40 }]}>
              <Text> </Text>
            </View>
            {data.discounts.map((d, i) => {
              const discountValue = Math.round(data.base_price * (d.value / 100));
              const baseABS = data.base_price - discountValue;
              const taxableAmount = baseABS + Math.round(data.delivery_price);
              const ppn = Math.round(taxableAmount * 0.11);
              const pbbkb = Math.round(taxableAmount * 0.075);
              const total = taxableAmount + ppn + pbbkb;
              return (
                <View key={i} style={[styles.cell, styles.right, { width: 65 }]}>
                  <Text style={{ fontWeight: "bold" }}>{formatNumber(total)}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Terms */}

        {processedNote && (
          <View style={styles.section}>
            <Text style={{ fontWeight: "bold" }}>NB :</Text>
            <View style={styles.terms}>
              {parseHtmlToComponents(processedNote)}
            </View>
          </View>
        )}

        {(processedTerms || data.min_order > 0) && (
          <View style={styles.section}>
            <Text style={{ fontWeight: "bold" }}>
              Syarat-syarat dan Ketentuan :
            </Text>
            <View style={styles.terms}>
              {processedTerms && parseHtmlToComponents(processedTerms)}
            </View>
          </View>
        )}

        {/* Payments */}

        {processedNote && (
          <View style={styles.section}>
            <Text style={{ fontWeight: "bold" }}>Metode Pembayaran :</Text>
            <View style={{ display: "flex", flexDirection: "row", gap: 8, marginTop: 5 }}>
              {data.bank_accounts.map((d, i) => {
                return (<View style={{ borderRadius: 8, border: "1px solid silver", gap: 4, padding: 8, backgroundColor: "#fafafa" }}>
                  <Text style={{ fontWeight: "semibold" }}>{d.name}</Text>
                  <Text>{d.account_number}</Text>
                  <Text>{d.account_name}</Text>
                  <Text>{d.branch}</Text>
                </View>)
              })}
            </View>
          </View>
        )}

        {/* Closing */}

        {processedClosing && (
          <View style={styles.paragraph}>
            {parseHtmlToComponents(processedClosing)}
          </View>
        )}

        <View style={styles.signature}>
          <Text>Hormat Kami,</Text>

          {/* Replace with signature image */}
          {/* <Image src="/signature.png" style={styles.signatureImage} /> */}
          <Image src={company.logo_url} style={styles.stamp} />
          <Image src="/images/ttd-indah.png" style={styles.ttd} />
          <Text
            style={[{ fontWeight: "bold", marginTop: 5 }]} >
            Indah Permatasari
          </Text>
          <Text style={[{ fontWeight: "bold", marginTop: 2 }]} >( DIREKTUR )</Text>
        </View>
        {/* Background Image */}
        <Image
          src={company.logo_url}
          style={styles.backgroundImage}
        />
      </Page>
    </Document>
  );
}



export async function generateQuotationPDFReact(company: CompanyInfo, data: QuotationData, options: { save?: boolean, output?: "datauri" | "blob" } = { save: true }) {
  // React-PDF requires absolute URLs for images when running in the browser
  let absoluteLogoUrl = company.logo_url;
  if (absoluteLogoUrl && absoluteLogoUrl.startsWith('/')) {
    if (typeof window !== 'undefined') {
      absoluteLogoUrl = `${window.location.origin}${absoluteLogoUrl}`;
    }
  }

  // Fetch the image and convert it to a base64 Data URI.
  // @react-pdf/renderer often fails silently when trying to fetch external URLs in the browser.
  // Passing it raw base64 data guarantees it will render.
  let base64Logo: string | undefined = undefined;
  if (absoluteLogoUrl) {
    try {
      const response = await fetch(absoluteLogoUrl);
      if (response.ok) {
        const blob = await response.blob();
        base64Logo = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        console.error("Failed to fetch logo:", response.status, response.statusText);
      }
    } catch (e) {
      console.error("Error fetching logo for PDF:", e);
    }
  }

  const processedCompany = { ...company, logo_url: base64Logo || absoluteLogoUrl };

  const asPdf = pdf(<QuotationDocument company={processedCompany} data={data} />);
  const blob = await asPdf.toBlob();

  if (options.save) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Quotation_${data.quotation_number}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return null;
  }

  if (options.output === "datauri") {
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.readAsDataURL(blob);
    });
  }

  return blob;
}
