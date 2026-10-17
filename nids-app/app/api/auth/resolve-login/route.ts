import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

export const dynamic = "force-dynamic"

// Shared-store rate limit. Uses a Postgres function so the counter is global
// across serverless instances (see issue #7).
const RATE_LIMIT_WINDOW_SECONDS = 60
const RATE_LIMIT_MAX = 20

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  return request.headers.get("x-real-ip") || "unknown"
}

async function isRateLimited(key: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("check_rate_limit", {
    p_key: key,
    p_limit: RATE_LIMIT_MAX,
    p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
  })

  if (error) {
    // Fail open: never block sign-in because the limiter is unavailable.
    console.error("resolve-login: rate limit check failed", error)
    return false
  }

  return data === false
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
    if (await isRateLimited(`resolve-login:${getClientIp(request)}`)) {
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
