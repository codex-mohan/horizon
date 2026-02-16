import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Routes that don't require authentication
const publicRoutes = ["/auth", "/api/auth"];

// Routes that should redirect to /chat if already authenticated
const authRoutes = ["/auth"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get("horizon-session");
  const isAuthenticated = !!sessionCookie?.value;

  // Skip middleware for static files and API routes that handle their own auth
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.includes(".") ||
    pathname.startsWith("/api/")
  ) {
    return NextResponse.next();
  }

  // If user is authenticated and tries to access auth pages, redirect to chat (or the requested page)
  if (isAuthenticated && authRoutes.some((route) => pathname.startsWith(route))) {
    const redirectUrl = request.nextUrl.searchParams.get("redirect");
    if (redirectUrl) {
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }
    return NextResponse.redirect(new URL("/chat/new", request.url));
  }

  // If user is not authenticated and tries to access protected routes
  if (!isAuthenticated) {
    const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

    if (!isPublicRoute && pathname !== "/") {
      const redirectUrl = new URL("/auth", request.url);
      redirectUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*|public).*)",
  ],
};
