/**
 * Reusable client-side translation helper.
 *
 * Translates any text (typically third-party error messages) via the
 * /api/translate endpoint. Never throws — on any failure it resolves to the
 * original text so callers can safely do:
 *
 *   notify.error(title, err.message, aiTranslate(err.message))
 *
 * The returned promise is meant to be passed un-awaited; the UI shows the
 * original text immediately and swaps in the translation when it arrives.
 */
export async function aiTranslate(
  text: string,
  targetLang?: string
): Promise<string> {
  const original = text || ""
  if (!original.trim()) return original

  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: original, targetLang }),
    })
    if (!res.ok) return original
    const data = await res.json()
    return typeof data?.translated === "string" && data.translated
      ? data.translated
      : original
  } catch {
    return original
  }
}