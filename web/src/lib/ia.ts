/**
 * Accès aux modèles de langage. Trois fournisseurs possibles, tous exposés
 * derrière la même interface (celle d'OpenAI), choisis selon la clé présente :
 * Google Gemini (gratuit, sans carte bancaire), la passerelle IA de Vercel,
 * ou OpenAI. Le modèle reste modifiable sans toucher au code avec AI_MODELE.
 */
type Fournisseur = { nom: string; url: string; cle: string; modeles: string[] };

function fournisseurs(): Fournisseur[] {
  const perso = process.env.AI_MODELE;
  const liste: Fournisseur[] = [];

  if (process.env.GEMINI_API_KEY) {
    liste.push({
      nom: "Google Gemini",
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      cle: process.env.GEMINI_API_KEY,
      modeles: [perso, "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"].filter(Boolean) as string[],
    });
  }
  if (process.env.AI_GATEWAY_API_KEY) {
    liste.push({
      nom: "Passerelle Vercel",
      url: "https://ai-gateway.vercel.sh/v1/chat/completions",
      cle: process.env.AI_GATEWAY_API_KEY,
      modeles: [perso, "anthropic/claude-sonnet-4.5", "openai/gpt-4o-mini"].filter(Boolean) as string[],
    });
  }
  if (process.env.OPENAI_API_KEY) {
    liste.push({
      nom: "OpenAI",
      url: "https://api.openai.com/v1/chat/completions",
      cle: process.env.OPENAI_API_KEY,
      modeles: [perso, "gpt-4o-mini"].filter(Boolean) as string[],
    });
  }
  return liste;
}

export async function redigerJson<T>(consigne: string, demande: string): Promise<T> {
  const dispos = fournisseurs();
  if (!dispos.length) {
    throw new Error(
      "Aucune clé d'IA configurée : ajoutez GEMINI_API_KEY (gratuite sur aistudio.google.com) dans Vercel"
    );
  }

  let derniere = "";
  for (const f of dispos) {
    for (const modele of f.modeles) {
      try {
        const r = await fetch(f.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${f.cle}` },
          body: JSON.stringify({
            model: modele,
            temperature: 0.8,
            max_tokens: 3000,
            messages: [
              { role: "system", content: consigne },
              { role: "user", content: demande },
            ],
          }),
          cache: "no-store",
        });
        const j = await r.json();
        if (!r.ok || j.error) {
          derniere = `${f.nom} · ${j?.error?.message ?? `réponse ${r.status}`}`;
          continue;
        }
        const texte: string = j.choices?.[0]?.message?.content ?? "";
        const debut = texte.indexOf("{");
        const fin = texte.lastIndexOf("}");
        if (debut < 0 || fin < 0) {
          derniere = `${f.nom} · réponse illisible du modèle`;
          continue;
        }
        return JSON.parse(texte.slice(debut, fin + 1)) as T;
      } catch (e) {
        derniere = `${f.nom} · ${e instanceof Error ? e.message : "appel impossible"}`;
      }
    }
  }
  throw new Error(derniere || "aucun modèle disponible");
}
