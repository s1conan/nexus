import { NextResponse } from "next/server"
import {
  extractSOFromFiles,
  validateFiles,
  type ExtractedFile,
} from "@/lib/ai-provider"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const files = formData.getAll("files").filter((f): f is File => f instanceof File)

    const validationError = validateFiles(
      files.map((f) => ({ name: f.name, type: f.type, size: f.size }))
    )
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const extractedFiles: ExtractedFile[] = await Promise.all(
      files.map(async (f) => ({
        name: f.name,
        mimeType: f.type,
        data: Buffer.from(await f.arrayBuffer()),
      }))
    )

    const data = await extractSOFromFiles(extractedFiles)
    return NextResponse.json({ data })
  } catch (err) {
    console.error("API AI Extract SO Error:", err)
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to extract data from documents.",
      },
      { status: 500 }
    )
  }
}
