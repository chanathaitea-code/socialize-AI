import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { signerEtat } from "@/lib/crypto";
import { urlAutorisation } from "@/lib/meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
    return NextResponse.redirect(new URL("/reseaux?err=Configuration%20Meta%20absente", req.url));
  }

  const etat = signerEtat(randomBytes(12).toString("base64url"));
  const redirectUri = new URL("/reseaux/callback", req.nextUrl.origin).toString();

  const reponse = NextResponse.redirect(urlAutorisation(redirectUri, etat));
  reponse.cookies.set("meta_oauth_state", etat, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return reponse;
}
