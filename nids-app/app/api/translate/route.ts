import { NextResponse } from "next/server"

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
const MAX_TEXT_LENGTH = 2000

/**
 * Translates arbitrary text (e.g. third-party error messages) using a
 * cheap/fast OpenRouter model. Model is configurable via AI_TRANSLATE_MODEL,
 * falling back to AI_MODEL.
 */
export async function POST(request: Request) {
  try {
    const { text, targetLang } = await request.json()

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Missing text" }, { status: 400 })
    }

    const apiKey = process.env.AI_API_KEY
    const model = process.env.AI_TRANSLATE_MODEL || process.env.AI_MODEL
    if (!apiKey || !model) {
      return NextResponse.json(
        { error: "Translation is not configured" },
        { status: 503 }
      )
    }

    const clipped =
      text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text
    const lang = typeof targetLang === "string" && targetLang ? targetLang : "id"

    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://nids.local",
        "X-Title": "Nexus Integrated Distribution System",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              `You are a translator. Translate the user's text to ${lang}. ` +
              `Keep technical terms, email addresses, field names, and codes unchanged. ` +
              `Respond with ONLY the translated text, no explanations or quotes.`,
          },
          { role: "user", content: clipped },
        ],
        max_tokens: 1000,
        temperature: 0,
      }),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => "")
      console.error("Translate API error:", response.status, body.slice(0, 300))
      return NextResponse.json(
        { error: "Translation request failed" },
        { status: 502 }
      )
    }

    const result = await response.json()
    const translated: string | undefined =
      result?.choices?.[0]?.message?.content?.trim()
    if (!translated) {
      return NextResponse.json(
        { error: "Empty translation response" },
        { status: 502 }
      )
    }

    return NextResponse.json({ translated })
  } catch (err: any) {
    console.error("API Translate Error:", err)
    return NextResponse.json(
      { error: err.message || "Failed to translate" },
      { status: 500 }
    )
  }
}