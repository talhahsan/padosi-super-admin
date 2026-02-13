import { NextResponse, type NextRequest } from "next/server"

export const runtime = "nodejs"

function requireBackendBaseUrl(): string {
  const value = process.env.BACKEND_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL
  if (!value) {
    throw new Error("Missing BACKEND_API_BASE_URL (or NEXT_PUBLIC_API_BASE_URL) environment variable")
  }
  return value
}

function buildTargetUrl(path: string[], search: string): string {
  const base = requireBackendBaseUrl().replace(/\/$/, "")
  const normalizedPath = path.join("/")
  return `${base}/${normalizedPath}${search}`
}

function copyUpstreamHeaders(response: Response): Headers {
  const headers = new Headers()
  const passthrough = [
    "content-type",
    "cache-control",
    "etag",
    "last-modified",
    "expires",
    "pragma",
  ]

  for (const key of passthrough) {
    const value = response.headers.get(key)
    if (value) headers.set(key, value)
  }
  return headers
}

async function forward(request: NextRequest, path: string[]) {
  try {
    const targetUrl = buildTargetUrl(path, request.nextUrl.search)
    const headers = new Headers()
    const auth = request.headers.get("authorization")
    const contentType = request.headers.get("content-type")
    const accept = request.headers.get("accept")

    if (auth) headers.set("authorization", auth)
    if (contentType) headers.set("content-type", contentType)
    if (accept) headers.set("accept", accept)

    const method = request.method.toUpperCase()
    const hasBody = !["GET", "HEAD"].includes(method)
    const upstreamResponse = await fetch(targetUrl, {
      method,
      headers,
      body: hasBody ? await request.text() : undefined,
      cache: "no-store",
    })

    const responseHeaders = copyUpstreamHeaders(upstreamResponse)
    const body = await upstreamResponse.text()
    return new NextResponse(body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Proxy request failed"
    return NextResponse.json(
      {
        success: false,
        message,
        code: 500,
      },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  return forward(request, path)
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  return forward(request, path)
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  return forward(request, path)
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  return forward(request, path)
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  return forward(request, path)
}
