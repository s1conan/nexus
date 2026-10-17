import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

export const dynamic = "force-dynamic"

// Lightweight per-instance rate limiting. A shared store is required for full
// protection across serverless instances (tracked separately).
const WINDOW_MS = 60_000
const MAX_REQUESTS = 20
const requestLog = new Map<string, number[]>()

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  return request.headers.get("x-real-ip") || "unknown"
}

function isRateLimited(key: string): boolean {
  const now = Date.now()
  const recent = (requestLog.get(key) || []).filter((t) => now - t < WINDOW_MS)
  recent.push(now)
  requestLog.set(key, recent)

  // Opportunistic cleanup so the map cannot grow unbounded.
  if (requestLog.size > 5000) {
    for (const [k, timestamps] of requestLog) {
      if (timestamps.every((t) => now - t >= WINDOW_MS)) requestLog.delete(k)
    }
  }

  return recent.length > MAX_REQUESTS
}

interface ResolveLoginBody {
  identifier?: unknown
}

interface LoginRecord {
  email: string
  is_active: boolean
  preferred_language: string | null
}

export async function POST(request: Request) {
  try {
    if (isRateLimited(`resolve-login:${getClientIp(request)}`)) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 })
    }

    const body = (await request.json().catch(() => null)) as
      | ResolveLoginBody
      | null
    const identifier =
      typeof body?.identifier === "string" ? body.identifier : ""
    const normalized = identifier.toLowerCase().trim()

    if (!normalized || normalized.length > 320) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 })
    }

    const columns = "email, is_active, preferred_language"

    // Parameterized lookups (no string-interpolated filters). Username wins;
    // fall back to email.
    const byUsername = await supabaseAdmin
      .from("profiles")
      .select(columns)
      .eq("username", normalized)
      .maybeSingle()

    if (byUsername.error) throw byUsername.error
    let record: LoginRecord | null = byUsername.data

    if (!record) {
      const byEmail = await supabaseAdmin
        .from("profiles")
        .select(columns)
        .eq("email", normalized)
        .maybeSingle()

      if (byEmail.error) throw byEmail.error
      record = byEmail.data
    }

    if (!record) {
      return NextResponse.json({ found: false }, { status: 200 })
    }

    return NextResponse.json({
      found: true,
      email: record.email,
      is_active: record.is_active,
      preferred_language: record.preferred_language,
    })
  } catch (error) {
    console.error("resolve-login: lookup failed", error)
    return NextResponse.json({ error: "server_error" }, { status: 500 })
  }
}
