"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const supabase = supabaseBrowser();
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage("Connexion impossible : " + error.message);
        setLoading(false);
        return;
      }
      router.push("/emplacements");
      router.refresh();
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setMessage("Inscription impossible : " + error.message);
        setLoading(false);
        return;
      }
      if (data.session) {
        router.push("/emplacements");
        router.refresh();
      } else {
        setMessage("Compte créé ! Vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi.");
        setMode("login");
        setLoading(false);
      }
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f4f4f1] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-extrabold text-[#12211c]">
            Social<span className="text-[#0f6b53]">Flow</span> AI
          </h1>
          <p className="text-sm text-gray-500 mt-1">Community manager autonome</p>
        </div>
        <form onSubmit={submit} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f6b53]"
              placeholder="vous@exemple.fr"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Mot de passe</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f6b53]"
              placeholder="8 caractères minimum"
            />
          </div>
          {message && <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">{message}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#0f6b53] text-white rounded-lg py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "..." : mode === "login" ? "Se connecter" : "Créer mon compte"}
          </button>
          <button
            type="button"
            onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(null); }}
            className="w-full text-sm text-gray-500 hover:text-[#0f6b53]"
          >
            {mode === "login" ? "Pas encore de compte ? S'inscrire" : "Déjà un compte ? Se connecter"}
          </button>
        </form>
        <p className="text-center text-xs text-gray-400 mt-4">Phase 0 · pilote Chana Thaï</p>
      </div>
    </main>
  );
}
