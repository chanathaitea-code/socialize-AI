import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { signerEtat } from "@/lib/crypto";
import { urlAutorisation } from "@/lib/google";

export const dynamic = "force-dynamic";

/** Envoie vers Google pour autoriser la gestion de la fiche d'établissement. */
export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(
      new URL("/google?err=Identifiants%20Google%20absents%20des%20variables%20d%27environnement", req.url)
    );
  }

  const redirection = new URL("/google/callback", req.nextUrl.origin).toString();
  return NextResponse.redirect(urlAutorisation(redirection, signerEtat(user.id)));
}
