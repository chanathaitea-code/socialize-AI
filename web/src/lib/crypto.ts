import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Chiffrement des jetons d'accès stockés en base. La clé est dérivée de la clé
 * secrète de l'application Meta, déjà présente dans l'environnement : aucun
 * secret supplémentaire à faire circuler. Si la clé secrète est un jour
 * régénérée côté Meta, les jetons deviennent illisibles et il suffit de
 * reconnecter les comptes.
 */
function cle(): Buffer {
  const source = process.env.META_APP_SECRET;
  if (!source) throw new Error("META_APP_SECRET manquant");
  return createHash("sha256").update(source).digest();
}

export function chiffrer(clair: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", cle(), iv);
  const donnees = Buffer.concat([c.update(clair, "utf8"), c.final()]);
  const tag = c.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), donnees.toString("base64")].join(".");
}

export function dechiffrer(paquet: string): string {
  const [iv, tag, donnees] = paquet.split(".");
  if (!iv || !tag || !donnees) throw new Error("jeton illisible");
  const d = createDecipheriv("aes-256-gcm", cle(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(donnees, "base64")), d.final()]).toString("utf8");
}

/** Jeton anti-CSRF pour le paramètre state d'OAuth. */
export function signerEtat(valeur: string): string {
  const h = createHash("sha256").update(valeur + (process.env.META_APP_SECRET ?? "")).digest("base64url");
  return `${valeur}.${h}`;
}

export function verifierEtat(etat: string): boolean {
  const i = etat.lastIndexOf(".");
  if (i < 0) return false;
  return signerEtat(etat.slice(0, i)) === etat;
}
