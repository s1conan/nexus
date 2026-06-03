import React from "react"
import { Document, Page, Text, View, StyleSheet, Image, pdf } from "@react-pdf/renderer"
import { format } from "date-fns"

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
  company_name: string
  content: string
  discounts: { label: string; value: number }[]
  note: string
  terms_conditions: string
  closing_remarks: string
  bank_accounts: { name: string; bank_name?: string; account_number: string; account_name: string; branch: string }[]
}

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#333",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    borderBottom: "1px solid #ccc",
    paddingBottom: 10,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    width: "60%",
  },
  logo: {
    width: 60,
    height: 60,
    marginRight: 10,
    objectFit: "contain",
  },
  companyDetails: {
    flexDirection: "column",
  },
  companyName: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 4,
  },
  titleContainer: {
    alignItems: "flex-end",
    justifyContent: "center",
    width: "40%",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f2937",
  },
  metaSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  metaBox: {
    width: "45%",
  },
  metaLabel: {
    fontWeight: "bold",
    color: "#666",
    marginBottom: 2,
    fontSize: 9,
  },
  metaText: {
    marginBottom: 4,
  },
  section: {
    marginTop: 15,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 5,
    borderBottom: "1px solid #eee",
    paddingBottom: 2,
  },
  paragraph: {
    lineHeight: 1.5,
    marginBottom: 5,
  },
  discountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottom: "1px dashed #eee",
    paddingVertical: 3,
  },
  bankBox: {
    border: "1px solid #eee",
    padding: 8,
    marginBottom: 5,
    borderRadius: 4,
  },
  signatureSection: {
    marginTop: 40,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  signatureBox: {
    width: 200,
    alignItems: "center",
  },
  signatureLine: {
    width: "100%",
    borderBottom: "1px solid #000",
    marginTop: 40,
    marginBottom: 5,
  },
})

const QuotationDocument = ({ company, data }: { company: CompanyInfo, data: QuotationData }) => {
  const stripHtml = (html: string) => {
    if (!html) return ""
    return html.replace(/<[^>]*>?/gm, "").replace(/&nbsp;/g, " ")
  }

  const cleanContent = stripHtml(data.content)
  const cleanNote = stripHtml(data.note)
  const cleanTerms = stripHtml(data.terms_conditions)
  const cleanClosing = stripHtml(data.closing_remarks)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {company.logo_url && (
              <Image src={company.logo_url} style={styles.logo} />
            )}
            <View style={styles.companyDetails}>
              <Text style={styles.companyName}>{company.name}</Text>
              <Text>{company.address}</Text>
              <Text>Email: {company.email}</Text>
            </View>
          </View>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>QUOTATION</Text>
            <Text style={{ marginTop: 5 }}>No: {data.quotation_number}</Text>
          </View>
        </View>

        {/* Metadata */}
        <View style={styles.metaSection}>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>To:</Text>
            <Text style={styles.metaText}>{data.company_name}</Text>
          </View>
          <View style={styles.metaBox}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
              <Text style={styles.metaLabel}>Date:</Text>
              <Text>{format(new Date(data.quotation_date), "dd/MM/yyyy")}</Text>
            </View>
          </View>
        </View>

        {/* Main Content */}
        {cleanContent && (
          <View style={styles.section}>
            <Text style={styles.paragraph}>{cleanContent}</Text>
          </View>
        )}

        {/* Discounts */}
        {data.discounts && data.discounts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Discounts</Text>
            {data.discounts.map((d, i) => (
              <View key={i} style={styles.discountRow}>
                <Text>{d.label}</Text>
                <Text>{d.value}%</Text>
              </View>
            ))}
          </View>
        )}

        {/* Note */}
        {cleanNote && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Note</Text>
            <Text style={styles.paragraph}>{cleanNote}</Text>
          </View>
        )}

        {/* Terms & Conditions */}
        {cleanTerms && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Terms & Conditions</Text>
            <Text style={styles.paragraph}>{cleanTerms}</Text>
          </View>
        )}

        {/* Bank Accounts */}
        {data.bank_accounts && data.bank_accounts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bank Accounts</Text>
            {data.bank_accounts.map((b, i) => (
              <View key={i} style={styles.bankBox}>
                <Text style={{ fontWeight: "bold", marginBottom: 2 }}>{b.name || b.bank_name}</Text>
                <Text>{b.account_number} - a/n {b.account_name}</Text>
                <Text>Cabang: {b.branch}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Closing Remarks */}
        {cleanClosing && (
          <View style={styles.section}>
            <Text style={styles.paragraph}>{cleanClosing}</Text>
          </View>
        )}

        {/* Signatures */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureBox}>
            <Text>Hormat Kami,</Text>
            <View style={styles.signatureLine}></View>
            <Text style={{ fontWeight: "bold" }}>{company.name}</Text>
          </View>
        </View>

      </Page>
    </Document>
  )
}

export async function generateQuotationPDFReact(company: CompanyInfo, data: QuotationData, options: { save?: boolean, output?: "datauri" | "blob" } = { save: true }) {
  const asPdf = pdf(<QuotationDocument company={company} data={data} />);
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
