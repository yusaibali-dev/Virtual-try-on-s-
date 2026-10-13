import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const accessCode = process.env.ACCESS_CODE?.trim();

  // If no access code is configured in environment, gate is inactive
  if (!accessCode) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Static assets, api routes, and gate page bypass Next.js middleware
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/storage") ||
    pathname.startsWith("/wasm") ||
    pathname.startsWith("/models") ||
    pathname.startsWith("/gate") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.svg" ||
    pathname === "/manifest.json"
  ) {
    return NextResponse.next();
  }

  // Check session cookie
  const sessionCookie = request.cookies.get("vton_access_session")?.value;
  if (sessionCookie === accessCode) {
    return NextResponse.next();
  }

  // Unauthorized: redirect to gate passcode page
  const gateUrl = new URL("/gate", request.url);
  if (pathname !== "/") {
    gateUrl.searchParams.set("return", pathname);
  }
  return NextResponse.redirect(gateUrl);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
