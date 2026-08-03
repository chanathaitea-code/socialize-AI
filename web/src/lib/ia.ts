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
      modeles: [
        perso,
        "gemini-flash-latest",
        "gemini-2.0-flash",
        "gemini-2.0-flash-001",
        "gemini-2.5-flash-lite",
      ].filter(Boolean) as string[],
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

/**
 * Les modèles tronquent parfois leur réponse en plein tableau. Plutôt que de
 * tout jeter, on récupère les éléments complets et on referme les accolades.
 */
function parseSouple<T>(texte: string): T | null {
  const debut = texte.indexOf("{");
  if (debut < 0) return null;
  const brut = texte.slice(debut);
  const fin = brut.lastIndexOf("}");
  if (fin > 0) {
    try {
      return JSON.parse(brut.slice(0, fin + 1)) as T;
    } catch {
      // on tente la réparation ci-dessous
    }
  }
  for (let i = brut.lastIndexOf("},"); i > 0; i = brut.lastIndexOf("},", i - 1)) {
    try {
      return JSON.parse(brut.slice(0, i + 1) + "]}") as T;
    } catch {
      // on remonte à l'objet précédent
    }
  }
  return null;
}

export async function redigerJson<T>(consigne: string, demande: string): Promise<T> {
  const dispos = fournisseurs();
  if (!dispos.length) {
    throw new Error(
      "Aucune clé d'IA configurée : ajoutez GEMINI_API_KEY (gratuite sur aistudio.google.com) dans Vercel"
    );
  }

  const erreurs: string[] = [];
  for (const f of dispos) {
    for (const modele of f.modeles) {
      try {
        const r = await fetch(f.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${f.cle}` },
          body: JSON.stringify({
            model: modele,
            temperature: 0.8,
            max_tokens: 8000,
            messages: [
              { role: "system", content: consigne },
              { role: "user", content: demande },
            ],
          }),
          cache: "no-store",
        });
        let j = await r.json();
        if (r.status === 429) {
          // palier gratuit : quelques requêtes par minute, on laisse passer l'orage
          await new Promise((res) => setTimeout(res, 4000));
          const r2 = await fetch(f.url, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${f.cle}` },
            body: JSON.stringify({
              model: modele,
              temperature: 0.8,
              max_tokens: 8000,
              messages: [
                { role: "system", content: consigne },
                { role: "user", content: demande },
              ],
            }),
            cache: "no-store",
          });
          if (r2.ok) j = await r2.json();
        }
        if (!j || j.error || !j.choices) {
          erreurs.push(`${f.nom}/${modele} : ${j?.error?.message ?? `réponse ${r.status}`}`);
          continue;
        }
        const objet = parseSouple<T>(j.choices?.[0]?.message?.content ?? "");
        if (!objet) {
          erreurs.push(`${f.nom}/${modele} : réponse illisible ou tronquée`);
          continue;
        }
        return objet;
      } catch (e) {
        erreurs.push(`${f.nom}/${modele} : ${e instanceof Error ? e.message : "appel impossible"}`);
      }
    }
  }
  throw new Error(erreurs.join(" | ") || "aucun modèle disponible");
}
