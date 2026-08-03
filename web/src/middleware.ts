import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  if (
    !user &&
    (path.startsWith("/emplacements") ||
      path.startsWith("/semaine") ||
      path.startsWith("/marque") ||
      path.startsWith("/reseaux") ||
      path.startsWith("/journal") ||
      path.startsWith("/analyse") ||
      path.startsWith("/studio") ||
      path.startsWith("/jour"))
  ) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (user && (path === "/login" || path === "/")) {
    return NextResponse.redirect(new URL("/jour", request.url));
  }
  return response;
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/emplacements/:path*",
    "/semaine/:path*",
    "/marque/:path*",
    "/reseaux/:path*",
    "/journal/:path*",
    "/analyse/:path*",
    "/studio/:path*",
    "/jour/:path*",
  ],
};
