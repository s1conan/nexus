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
  expiry_date?: string
  company_name: string
  contact_person?: string
  product_name?: string
  unit_price?: number
  minimum_order?: number
  content?: string
  discounts?: { label: string; value: number }[]
  note?: string
  terms_conditions: string
  closing_remarks?: string
  bank_accounts?: { name: string; bank_name: string; account_number: string; account_name: string; branch: string }[]
}

export async function generateQuotationPDF(company: CompanyInfo, data: QuotationData, options: { save?: boolean, output?: "datauri" | "blob" } = { save: true }) {
  const { default: jsPDF } = await import("jspdf")
  const { default: autoTable } = await import("jspdf-autotable")
  
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20
  let currentY = 15

  // Helper to strip HTML tags for simple text display
  const stripHtml = (html: string) => {
    if (!html) return ""
    return html.replace(/<[^>]*>?/gm, "").replace(/&nbsp;/g, " ")
  }

  // 1. Header
  try {
    const logoUrl = company.logo_url || "/images/company-logo.jpg"
    const img = new Image()
    img.src = logoUrl
    await new Promise((resolve) => {
      img.onload = resolve
      img.onerror = resolve
    })
    
    if (img.complete && img.naturalWidth > 0) {
      const logoWidth = 25
      const logoHeight = (img.naturalHeight * logoWidth) / img.naturalWidth
      doc.addImage(img, "JPEG", margin, currentY, logoWidth, logoHeight)
      
      doc.setFontSize(16)
      doc.setFont("helvetica", "bold")
      doc.text(company.name, margin + logoWidth + 5, currentY + 10)
      
      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")
      const addressLines = doc.splitTextToSize(company.address, pageWidth - margin * 2 - logoWidth - 5)
      doc.text(addressLines, margin + logoWidth + 5, currentY + 16)
      
      const emailPhone = `${company.email}${company.phone ? ` | ${company.phone}` : ""}`
      doc.text(emailPhone, margin + logoWidth + 5, currentY + 16 + (addressLines.length * 4))
      
      currentY += Math.max(logoHeight, 16 + (addressLines.length * 4)) + 5
    } else {
      doc.setFontSize(16)
      doc.setFont("helvetica", "bold")
      doc.text(company.name, margin, currentY)
      currentY += 8
      
      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")
      const addressLines = doc.splitTextToSize(company.address, pageWidth - margin * 2)
      doc.text(addressLines, margin, currentY)
      currentY += (addressLines.length * 4)
      
      const emailPhone = `${company.email}${company.phone ? ` | ${company.phone}` : ""}`
      doc.text(emailPhone, margin, currentY)
      currentY += 8
    }
  } catch (e) {
    console.error("Logo loading failed", e)
  }

  doc.setLineWidth(0.5)
  doc.line(margin, currentY, pageWidth - margin, currentY)
  currentY += 10

  // 2. Quotation Details
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.text(`Quotation No: ${data.quotation_number}`, margin, currentY)
  
  const dateStr = format(new Date(data.quotation_date), "dd MMMM yyyy")
  const dateWidth = doc.getTextWidth(`Date: ${dateStr}`)
  doc.text(`Date: ${dateStr}`, pageWidth - margin - dateWidth, currentY)
  currentY += 10

  doc.text(`To: ${data.company_name}`, margin, currentY)
  currentY += 15

  // 3. Content
  doc.setFont("helvetica", "normal")
  const contentText = stripHtml(data.content || "")
  const contentLines = doc.splitTextToSize(contentText, pageWidth - margin * 2)
  doc.text(contentLines, margin, currentY)
  currentY += (contentLines.length * 5) + 10

  // 4. Discount Table
  if (data.discounts && data.discounts.length > 0) {
    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [["Description", "Value (%)"]],
      body: data.discounts.map(d => [d.label, `${d.value}%`]),
      theme: "striped",
      headStyles: { fillColor: [128, 128, 128] }
    })
    currentY = (doc as any).lastAutoTable.finalY + 10
  }

  const checkPageBreak = (neededHeight: number) => {
    if (currentY + neededHeight > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage()
      currentY = margin
    }
  }

  // 5. Notes
  if (data.note) {
    checkPageBreak(20)
    doc.setFont("helvetica", "bold")
    doc.text("Notes:", margin, currentY)
    currentY += 5
    doc.setFont("helvetica", "normal")
    const noteLines = doc.splitTextToSize(stripHtml(data.note), pageWidth - margin * 2)
    doc.text(noteLines, margin, currentY)
    currentY += (noteLines.length * 5) + 10
  }

  // 6. Terms & Conditions
  if (data.terms_conditions || (data.bank_accounts && data.bank_accounts.length > 0)) {
    checkPageBreak(40)
    doc.setFont("helvetica", "bold")
    doc.text("Terms & Conditions:", margin, currentY)
    currentY += 5
    doc.setFont("helvetica", "normal")
    
    if (data.terms_conditions) {
      const termLines = doc.splitTextToSize(stripHtml(data.terms_conditions), pageWidth - margin * 2)
      doc.text(termLines, margin, currentY)
      currentY += (termLines.length * 5) + 5
    }

    if (data.bank_accounts && data.bank_accounts.length > 0) {
      doc.text("Payment can be made to:", margin, currentY)
      currentY += 5
      data.bank_accounts.forEach(bank => {
        checkPageBreak(15)
        doc.text(`${bank.bank_name} - ${bank.account_number} a/n ${bank.account_name}`, margin + 5, currentY)
        currentY += 5
      })
      currentY += 5
    }
  }

  // 7. Closing Remarks
  if (data.closing_remarks) {
    checkPageBreak(20)
    const closingLines = doc.splitTextToSize(stripHtml(data.closing_remarks), pageWidth - margin * 2)
    doc.text(closingLines, margin, currentY)
    currentY += (closingLines.length * 5) + 15
  }

  // 8. Footer
  checkPageBreak(40)
  doc.text("Sincerely,", margin, currentY)
  currentY += 25
  doc.text("__________________________", margin, currentY)
  currentY += 5
  doc.setFont("helvetica", "bold")
  doc.text(company.name, margin, currentY)

  if (options.save) {
    doc.save(`Quotation_${data.quotation_number}.pdf`)
  }
  
  if (options.output === "datauri") {
    return doc.output("datauristring")
  }
  
  return null
}

interface DeliveryOrderData {
  do_number: string
  do_date: string
  shipment_date: string
  company_name: string
  supplier_name?: string
  product_name: string
  quantity: number
  driver_name: string
  vehicle_number: string
  compartments: {
    compartment_number: number
    seal_number: string
    quantity: number
  }[]
  note: string
}

export async function generateDeliveryOrderPDF(company: CompanyInfo, data: DeliveryOrderData, options: { save?: boolean, output?: "datauri" | "blob" } = { save: true }) {
  const { default: jsPDF } = await import("jspdf")
  const { default: autoTable } = await import("jspdf-autotable")

  // A5 format (148 x 210 mm)
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a5"
  })
  
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 10
  let currentY = 10

  const stripHtml = (html: string) => {
    if (!html) return ""
    return html.replace(/<[^>]*>?/gm, "").replace(/&nbsp;/g, " ")
  }

  // Header
  try {
    const logoUrl = company.logo_url || "/images/company-logo.jpg"
    const img = new Image()
    img.src = logoUrl
    await new Promise((resolve) => {
      img.onload = resolve
      img.onerror = resolve
    })
    
    if (img.complete && img.naturalWidth > 0) {
      const logoWidth = 15
      const logoHeight = (img.naturalHeight * logoWidth) / img.naturalWidth
      doc.addImage(img, "JPEG", margin, currentY, logoWidth, logoHeight)
      
      doc.setFontSize(12)
      doc.setFont("helvetica", "bold")
      doc.text(company.name, margin + logoWidth + 3, currentY + 5)
      
      doc.setFontSize(7)
      doc.setFont("helvetica", "normal")
      const addressLines = doc.splitTextToSize(company.address, pageWidth - margin * 2 - logoWidth - 3)
      doc.text(addressLines, margin + logoWidth + 3, currentY + 9)
      
      currentY += Math.max(logoHeight, 9 + (addressLines.length * 3)) + 2
    } else {
      doc.setFontSize(12)
      doc.setFont("helvetica", "bold")
      doc.text(company.name, margin, currentY)
      currentY += 5
      
      doc.setFontSize(7)
      doc.setFont("helvetica", "normal")
      const addressLines = doc.splitTextToSize(company.address, pageWidth - margin * 2)
      doc.text(addressLines, margin, currentY)
      currentY += (addressLines.length * 3) + 2
    }
  } catch (e) {
    console.error("Logo loading failed", e)
  }

  doc.setLineWidth(0.3)
  doc.line(margin, currentY, pageWidth - margin, currentY)
  currentY += 5

  // Title
  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.text("SURAT JALAN / DELIVERY ORDER", pageWidth / 2, currentY, { align: "center" })
  currentY += 8

  // DO Details
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  
  const col1 = margin
  const col2 = pageWidth / 2 + 2
  
  doc.text(`No. DO: ${data.do_number}`, col1, currentY)
  doc.text(`Tanggal: ${format(new Date(data.do_date), "dd/MM/yyyy")}`, col2, currentY)
  currentY += 5
  
  doc.text(`Kepada: ${data.company_name}`, col1, currentY)
  doc.text(`Origin: ${data.supplier_name || "-"}`, col2, currentY)
  currentY += 5

  doc.text(`Shipment: ${format(new Date(data.shipment_date), "dd/MM/yyyy")}`, col2, currentY)
  currentY += 10

  // Product & Quantity
  doc.setFont("helvetica", "bold")
  doc.text("Item / Product", col1, currentY)
  doc.text("Quantity", pageWidth - margin - 20, currentY, { align: "right" })
  currentY += 1
  doc.line(margin, currentY, pageWidth - margin, currentY)
  currentY += 4
  
  doc.setFont("helvetica", "normal")
  doc.text(data.product_name, col1, currentY)
  doc.text(data.quantity.toLocaleString(), pageWidth - margin - 20, currentY, { align: "right" })
  currentY += 8

  // Logistics info
  doc.text(`Driver: ${data.driver_name}`, col1, currentY)
  doc.text(`No. Kendaraan: ${data.vehicle_number}`, col2, currentY)
  currentY += 8

  // Compartments Table
  if (data.compartments && data.compartments.length > 0) {
    doc.setFont("helvetica", "bold")
    doc.text("Detail Kompartemen & Segel:", col1, currentY)
    currentY += 4
    
    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [["Komp #", "No. Segel", "Quantity"]],
      body: data.compartments.map(c => [c.compartment_number, c.seal_number, c.quantity]),
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 1 },
      headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0] }
    })
    currentY = (doc as any).lastAutoTable.finalY + 5
  }

  // Note
  if (data.note) {
    doc.setFont("helvetica", "bold")
    doc.text("Keterangan:", col1, currentY)
    currentY += 4
    doc.setFont("helvetica", "normal")
    const noteLines = doc.splitTextToSize(stripHtml(data.note), pageWidth - margin * 2)
    doc.text(noteLines, col1, currentY)
    currentY += (noteLines.length * 4) + 5
  }

  // Signatures
  const sigY = pageHeight - 35
  doc.setFontSize(8)
  
  doc.text("Penerima,", margin + 5, sigY)
  doc.text("Driver,", pageWidth / 2, sigY, { align: "center" })
  doc.text("Hormat Kami,", pageWidth - margin - 20, sigY, { align: "center" })
  
  doc.text("( _________________ )", margin, sigY + 20)
  doc.text("( _________________ )", pageWidth / 2, sigY + 20, { align: "center" })
  doc.text("( _________________ )", pageWidth - margin - 20, sigY + 20, { align: "center" })

  if (options.save) {
    doc.save(`DO_${data.do_number}.pdf`)
  }
  
  if (options.output === "datauri") {
    return doc.output("datauristring")
  }
  
  return null
}
