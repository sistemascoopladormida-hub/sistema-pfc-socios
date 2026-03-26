import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function hasValidRoleCookie(request: NextRequest) {
  const role = request.cookies.get("rol")?.value;
  return role === "admin" || role === "directivo";
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const loggedIn = hasValidRoleCookie(request);

  if (isPublicPath(pathname) && loggedIn) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!isPublicPath(pathname) && !loggedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
