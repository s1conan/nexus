/**
 * Shared invoice amount calculation.
 *
 * The invoice dialog, the invoice list table and the invoice PDF all call this
 * one function so they can never disagree on tax handling.
 *
 * Tax-exclusive (default): taxes are added on top of the product amount.
 *
 * Tax-inclusive: the product amount is treated as GROSS, so the enabled taxes
 * are backed out of it — `net = gross / (1 + totalRate)` and
 * `tax = gross − net` — which makes re-adding the tax land exactly on the
 * stated price. The delivery fee is never netted: it is added on top and only
 * joins the PPN base when `deliveryTaxable` is set.
 */

export type InvoiceTaxDetail = {
  name: string
  rate: number
  enabled: boolean
}

export type InvoiceAmountInput = {
  quantity: number
  unitPrice: number
  deliveryPricePerLitre?: number
  discountPercent?: number
  shrinkageTolerance?: number
  shrinkageInPrice?: boolean
  deliveryTaxable?: boolean
  taxInclusive?: boolean
  taxDetails?: InvoiceTaxDetail[]
}

export type AppliedTax = InvoiceTaxDetail & {
  /** Total charged for this tax (embedded share + delivery tax). */
  amount: number
  /** Portion backed out of the gross product amount. */
  embeddedAmount: number
  /** Portion charged on top for the delivery fee (PPN only). */
  deliveryAmount: number
}

export type InvoiceAmounts = {
  quantity: number
  unitPrice: number
  basePrice: number
  discountPercent: number
  discountAmount: number
  afterDiscountBase: number
  shrinkageAmount: number
  afterDiscount: number
  deliveryRate: number
  deliveryTotal: number
  deliveryTaxable: boolean
  taxInclusive: boolean
  totalTaxRate: number
  /** Product amount net of the embedded tax (the DPP). */
  netProduct: number
  /** Gross product amount net of embedded tax — the printed price base. */
  netBasePrice: number
  /** Discount amount net of embedded tax. */
  netDiscountAmount: number
  /** After-discount product amount net of embedded tax. */
  netAfterDiscountBase: number
  /** Shrinkage amount net of embedded tax. */
  netShrinkageAmount: number
  /** Tax already contained in the gross product amount. */
  embeddedTax: number
  subtotal: number
  appliedTaxes: AppliedTax[]
  taxTotal: number
  grandTotal: number
}

export function calculateInvoiceAmounts(
  input: InvoiceAmountInput
): InvoiceAmounts {
  const quantity = Number(input.quantity) || 0
  const unitPrice = Number(input.unitPrice) || 0
  const deliveryRate = Number(input.deliveryPricePerLitre) || 0
  const discountPercent = Number(input.discountPercent) || 0
  const shrinkageTolerance = Number(input.shrinkageTolerance) || 0
  const deliveryTaxable = Boolean(input.deliveryTaxable)
  const taxDetails = Array.isArray(input.taxDetails) ? input.taxDetails : []

  const basePrice = quantity * unitPrice
  const discountAmount = basePrice * (discountPercent / 100)
  const afterDiscountBase = basePrice - discountAmount
  // Shrinkage tolerance builds on the after-discount price (SO/PDF rule)
  const shrinkageAmount =
    input.shrinkageInPrice && shrinkageTolerance > 0
      ? Math.round(afterDiscountBase * (shrinkageTolerance / 100))
      : 0
  const afterDiscount = afterDiscountBase + shrinkageAmount
  const deliveryTotal = quantity * deliveryRate

  const enabledTaxes = taxDetails.filter((t) => t?.enabled)
  const totalTaxRate = enabledTaxes.reduce(
    (sum, t) => sum + (Number(t?.rate) || 0),
    0
  )
  const taxInclusive = Boolean(input.taxInclusive) && totalTaxRate > 0

  // Back the embedded tax out of the gross product amount so re-adding it
  // lands on the stated price.
  const netProduct = taxInclusive
    ? Math.round(afterDiscount / (1 + totalTaxRate / 100))
    : afterDiscount
  const embeddedTax = taxInclusive
    ? Math.round(afterDiscount) - netProduct
    : 0

  // Breakdown net of the embedded tax so the printed rows reconcile:
  // netBasePrice − netDiscountAmount + netShrinkageAmount === netProduct
  const netDivisor = 1 + totalTaxRate / 100
  const netBasePrice = taxInclusive
    ? Math.round(basePrice / netDivisor)
    : basePrice
  const netAfterDiscountBase = taxInclusive
    ? Math.round(afterDiscountBase / netDivisor)
    : afterDiscountBase
  const netDiscountAmount = netBasePrice - netAfterDiscountBase
  const netShrinkageAmount = netProduct - netAfterDiscountBase

  // Split the embedded tax across the enabled taxes by rate. The last enabled
  // tax absorbs the rounding residual so the parts sum exactly.
  const embeddedShares = enabledTaxes.map((t) =>
    totalTaxRate > 0
      ? Math.round((embeddedTax * (Number(t?.rate) || 0)) / totalTaxRate)
      : 0
  )
  if (embeddedShares.length > 0) {
    const allocated = embeddedShares.reduce((sum, n) => sum + n, 0)
    embeddedShares[embeddedShares.length - 1] += embeddedTax - allocated
  }

  let shareIndex = 0
  const appliedTaxes: AppliedTax[] = taxDetails.map((t) => {
    const rate = Number(t?.rate) || 0
    if (!t?.enabled) {
      return { ...t, rate, amount: 0, embeddedAmount: 0, deliveryAmount: 0 }
    }
    const isPpn = String(t?.name || "")
      .toUpperCase()
      .includes("PPN")

    if (taxInclusive) {
      const embeddedAmount = embeddedShares[shareIndex++] ?? 0
      // Delivery is never netted; its PPN is charged on top.
      const deliveryAmount =
        deliveryTaxable && isPpn ? Math.round(deliveryTotal * (rate / 100)) : 0
      return {
        ...t,
        rate,
        embeddedAmount,
        deliveryAmount,
        amount: embeddedAmount + deliveryAmount,
      }
    }

    // Tax-exclusive: charge the enabled tax on the product amount, plus the
    // delivery fee for PPN when delivery_taxable is set.
    const taxableBase =
      afterDiscount + (deliveryTaxable && isPpn ? deliveryTotal : 0)
    return {
      ...t,
      rate,
      embeddedAmount: 0,
      deliveryAmount: 0,
      amount: Math.round(Math.max(0, taxableBase) * (rate / 100)),
    }
  })

  const subtotal = Math.max(0, Math.round(netProduct + deliveryTotal))
  const taxTotal = appliedTaxes.reduce((sum, t) => sum + t.amount, 0)

  return {
    quantity,
    unitPrice,
    basePrice,
    discountPercent,
    discountAmount,
    afterDiscountBase,
    shrinkageAmount,
    afterDiscount,
    deliveryRate,
    deliveryTotal,
    deliveryTaxable,
    taxInclusive,
    totalTaxRate,
    netProduct,
    netBasePrice,
    netDiscountAmount,
    netAfterDiscountBase,
    netShrinkageAmount,
    embeddedTax,
    subtotal,
    appliedTaxes,
    taxTotal,
    grandTotal: subtotal + taxTotal,
  }
}
