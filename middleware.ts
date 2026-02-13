import { NextResponse, type NextRequest } from "next/server"
import { AUTH_STATE_COOKIE } from "@/lib/auth-constants"

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasAuthState = request.cookies.get(AUTH_STATE_COOKIE)?.value === "1"

  if (pathname.startsWith("/communities") && !hasAuthState) {
    const loginUrl = new URL("/login", request.url)
    return NextResponse.redirect(loginUrl)
  }

  if (pathname === "/login" && hasAuthState) {
    const communitiesUrl = new URL("/communities", request.url)
    return NextResponse.redirect(communitiesUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/login", "/communities/:path*"],
}
