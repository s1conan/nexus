/**
 * Shared invoice amount calculation.
 *
 * The invoice dialog, the invoice list table and the invoice PDF all call this
 * one function so they can never disagree on tax handling.
 *
 * Two independent "inclusive" switches describe what the stated price already
 * contains:
 *
 * - `taxInclusive` — the price contains the tax. The enabled taxes are backed
 *   out of it (`net = gross / (1 + totalRate)`, `tax = gross − net`) so that
 *   re-adding the tax lands exactly on the stated price.
 * - `deliveryInclusive` — the price contains the delivery fee. The fee is
 *   carved OUT of the price (product = price − delivery) instead of being
 *   charged on top of it.
 *
 * When both are on they are applied together: the delivery fee is carved out
 * of the price first, then the tax is backed out of what remains (the
 * delivery fee is part of the same gross price, so its PPN is embedded too
 * when the fee is taxable).
 *
 * Tax-exclusive (default): taxes are added on top of the product amount.
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
  /** The stated price already includes the tax. */
  taxInclusive?: boolean
  /** The stated price already includes the delivery fee. */
  deliveryInclusive?: boolean
  taxDetails?: InvoiceTaxDetail[]
}

export type AppliedTax = InvoiceTaxDetail & {
  /** Total charged for this tax (product share + delivery share). */
  amount: number
  /** Portion backed out of the gross product amount. */
  embeddedAmount: number
  /** Portion charged on the delivery fee (PPN only). */
  deliveryAmount: number
}

export type InvoiceAmounts = {
  quantity: number
  /** The stated unit price, as entered. */
  unitPrice: number
  /** Unit price of the product part (delivery carved out when inclusive). */
  productUnitPrice: number
  /** qty × stated unit price. */
  basePrice: number
  /** Stated price of the product part (delivery carved out when inclusive). */
  productBasePrice: number
  discountPercent: number
  discountAmount: number
  afterDiscountBase: number
  shrinkageAmount: number
  /** Discount on the product part (gross). */
  productDiscountAmount: number
  /** Product part after discount (gross). */
  productAfterDiscountBase: number
  /** Shrinkage on the product part (gross). */
  productShrinkageAmount: number
  /** Product part after discount + shrinkage — the amount that is taxed. */
  productAmount: number
  afterDiscount: number
  deliveryRate: number
  deliveryTotal: number
  deliveryTaxable: boolean
  deliveryInclusive: boolean
  taxInclusive: boolean
  totalTaxRate: number
  ppnRate: number
  /** Product amount net of the embedded tax (the DPP). */
  netProduct: number
  /** Tax embedded in the gross product amount. */
  productTax: number
  /** Delivery amount net of any embedded tax. */
  netDelivery: number
  /** Tax charged on the delivery fee (embedded or on top). */
  embeddedDeliveryTax: number
  /** Total tax already contained in the stated price. */
  embeddedTax: number
  netBasePrice: number
  netDiscountAmount: number
  netAfterDiscountBase: number
  netShrinkageAmount: number
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
  const deliveryInclusive = Boolean(input.deliveryInclusive)
  const taxDetails = Array.isArray(input.taxDetails) ? input.taxDetails : []

  const basePrice = quantity * unitPrice
  const deliveryTotal = quantity * deliveryRate

  // "Price includes delivery fee": the delivery fee is part of the stated
  // price, so it is carved out of it and is NOT charged on top.
  const productBasePrice = deliveryInclusive
    ? Math.max(0, basePrice - deliveryTotal)
    : basePrice
  const productDiscountAmount = productBasePrice * (discountPercent / 100)
  const productAfterDiscountBase = productBasePrice - productDiscountAmount
  const productShrinkageAmount =
    input.shrinkageInPrice && shrinkageTolerance > 0
      ? Math.round(productAfterDiscountBase * (shrinkageTolerance / 100))
      : 0
  const productAmount = productAfterDiscountBase + productShrinkageAmount

  // Kept for reference: the whole stated price after discount + shrinkage.
  const discountAmount = basePrice * (discountPercent / 100)
  const afterDiscountBase = basePrice - discountAmount
  const shrinkageAmount =
    input.shrinkageInPrice && shrinkageTolerance > 0
      ? Math.round(afterDiscountBase * (shrinkageTolerance / 100))
      : 0
  const afterDiscount = afterDiscountBase + shrinkageAmount

  const enabledTaxes = taxDetails.filter((t) => t?.enabled)
  const totalTaxRate = enabledTaxes.reduce(
    (sum, t) => sum + (Number(t?.rate) || 0),
    0
  )
  // Delivery is only ever taxed by PPN (matching delivery_taxable).
  const ppnRate =
    Number(
      enabledTaxes.find((t) => /ppn/i.test(String(t?.name || "")))?.rate
    ) || 0
  const taxInclusive = Boolean(input.taxInclusive) && totalTaxRate > 0

  // Gross amounts that are subject to tax.
  const taxableGross = deliveryTaxable
    ? productAmount + deliveryTotal
    : productAmount

  // Back the tax out of the gross amounts so re-adding it lands on the stated
  // price. When the delivery fee is inside the price it is gross too, so its
  // PPN is embedded as well.
  const netProduct = taxInclusive
    ? Math.round(productAmount / (1 + totalTaxRate / 100))
    : productAmount
  const productTax = taxInclusive
    ? Math.round(productAmount) - netProduct
    : 0
  const deliveryIsGross = taxInclusive && deliveryTaxable && deliveryInclusive
  const netDelivery = deliveryIsGross
    ? Math.round(deliveryTotal / (1 + ppnRate / 100))
    : deliveryTotal
  const embeddedDeliveryTax = deliveryIsGross
    ? Math.round(deliveryTotal) - netDelivery
    : 0

  // Breakdown net of the embedded tax so the printed rows reconcile:
  // netBasePrice − netDiscountAmount + netShrinkageAmount === netProduct
  const netDivisor = 1 + totalTaxRate / 100
  const netBasePrice = taxInclusive
    ? Math.round(productBasePrice / netDivisor)
    : productBasePrice
  const netAfterDiscountBase = taxInclusive
    ? Math.round(productAfterDiscountBase / netDivisor)
    : productAfterDiscountBase
  const netDiscountAmount = netBasePrice - netAfterDiscountBase
  const netShrinkageAmount = netProduct - netAfterDiscountBase

  // Split the embedded tax across the enabled taxes by rate. The last enabled
  // tax absorbs the rounding residual so the parts sum exactly.
  const embeddedShares = enabledTaxes.map((t) =>
    totalTaxRate > 0
      ? Math.round((productTax * (Number(t?.rate) || 0)) / totalTaxRate)
      : 0
  )
  if (embeddedShares.length > 0) {
    const allocated = embeddedShares.reduce((sum, n) => sum + n, 0)
    embeddedShares[embeddedShares.length - 1] += productTax - allocated
  }

  let shareIndex = 0
  const appliedTaxes: AppliedTax[] = taxDetails.map((t) => {
    const rate = Number(t?.rate) || 0
    if (!t?.enabled) {
      return { ...t, rate, amount: 0, embeddedAmount: 0, deliveryAmount: 0 }
    }
    const isPpn = /ppn/i.test(String(t?.name || ""))

    if (taxInclusive) {
      const embeddedAmount = embeddedShares[shareIndex++] ?? 0
      const deliveryAmount =
        deliveryTaxable && isPpn
          ? deliveryInclusive
            ? embeddedDeliveryTax
            : Math.round(deliveryTotal * (rate / 100))
          : 0
      return {
        ...t,
        rate,
        embeddedAmount,
        deliveryAmount,
        amount: embeddedAmount + deliveryAmount,
      }
    }

    // Tax-exclusive: charge on the taxable base; PPN also covers the delivery
    // fee when the fee is taxable.
    const base = deliveryTaxable && isPpn ? taxableGross : productAmount
    const amount = Math.round(Math.max(0, base) * (rate / 100))
    const deliveryAmount =
      deliveryTaxable && isPpn ? Math.round(deliveryTotal * (rate / 100)) : 0
    return {
      ...t,
      rate,
      embeddedAmount: 0,
      deliveryAmount,
      amount,
    }
  })

  // The delivery fee is only added on top when it is NOT inside the price.
  const deliveryCharge = deliveryInclusive ? netDelivery : deliveryTotal
  const subtotal = Math.max(0, Math.round(netProduct + deliveryCharge))
  const taxTotal = appliedTaxes.reduce((sum, t) => sum + t.amount, 0)
  const embeddedTax = productTax + embeddedDeliveryTax

  return {
    quantity,
    unitPrice,
    productUnitPrice: quantity > 0 ? productBasePrice / quantity : 0,
    basePrice,
    productBasePrice,
    discountPercent,
    discountAmount,
    afterDiscountBase,
    shrinkageAmount,
    productDiscountAmount,
    productAfterDiscountBase,
    productShrinkageAmount,
    productAmount,
    afterDiscount,
    deliveryRate,
    deliveryTotal,
    deliveryTaxable,
    deliveryInclusive,
    taxInclusive,
    totalTaxRate,
    ppnRate,
    netProduct,
    productTax,
    netDelivery,
    embeddedDeliveryTax,
    embeddedTax,
    netBasePrice,
    netDiscountAmount,
    netAfterDiscountBase,
    netShrinkageAmount,
    subtotal,
    appliedTaxes,
    taxTotal,
    grandTotal: subtotal + taxTotal,
  }
}
