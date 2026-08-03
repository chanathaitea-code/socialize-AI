/**
 * Accès aux modèles de langage via la passerelle IA de Vercel, compatible avec
 * l'interface d'OpenAI. La clé vit dans AI_GATEWAY_API_KEY ; le modèle peut
 * être changé sans toucher au code avec AI_MODELE.
 */
const PASSERELLE = "https://ai-gateway.vercel.sh/v1/chat/completions";

const MODELES = [
  process.env.AI_MODELE,
  "anthropic/claude-sonnet-4.5",
  "anthropic/claude-3.5-sonnet",
  "openai/gpt-4o-mini",
  "google/gemini-2.0-flash",
].filter(Boolean) as string[];

export async function redigerJson<T>(consigne: string, demande: string): Promise<T> {
  const cle = process.env.AI_GATEWAY_API_KEY;
  if (!cle) throw new Error("AI_GATEWAY_API_KEY manquante : créez une clé dans Vercel, onglet AI Gateway");

  let derniere = "";
  for (const modele of MODELES) {
    try {
      const r = await fetch(PASSERELLE, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cle}` },
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
        derniere = j?.error?.message ?? `réponse ${r.status}`;
        continue;
      }
      const texte: string = j.choices?.[0]?.message?.content ?? "";
      const debut = texte.indexOf("{");
      const fin = texte.lastIndexOf("}");
      if (debut < 0 || fin < 0) {
        derniere = "réponse illisible du modèle";
        continue;
      }
      return JSON.parse(texte.slice(debut, fin + 1)) as T;
    } catch (e) {
      derniere = e instanceof Error ? e.message : "appel impossible";
    }
  }
  throw new Error(derniere || "aucun modèle disponible");
}
