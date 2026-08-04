"use client";

import { useMemo, useState } from "react";
import {
  DEPARTMENTS,
  REGIONS,
  departmentsOf,
} from "@/modules/prospection/geo/france";
import {
  describeScope,
  type MeasuredPlan,
  type ScanScope,
} from "@/modules/prospection/scan/planner";
import type { CompanyRecord } from "@/modules/prospection/providers/entreprises";

type Mode = "radius" | "region" | "departments" | "france";

interface Base {
  lat: number;
  lng: number;
  label: string;
}

export default function TerritoireClient({
  base,
  defaultRadiusKm,
  defaultMinHeadcount,
}: {
  base: Base;
  defaultRadiusKm: number;
  defaultMinHeadcount: number;
}) {
  const [mode, setMode] = useState<Mode>("radius");
  const [radiusKm, setRadiusKm] = useState(defaultRadiusKm);
  const [minHeadcount, setMinHeadcount] = useState(defaultMinHeadcount);
  const [region, setRegion] = useState<string>("Île-de-France");
  const [selected, setSelected] = useState<string[]>(["91"]);

  const [plan, setPlan] = useState<MeasuredPlan | null>(null);
  const [busy, setBusy] = useState<"none" | "measuring" | "scanning">("none");
  const [companies, setCompanies] = useState<CompanyRecord[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const scope: ScanScope = useMemo(() => {
    if (mode === "radius")
      return {
        kind: "radius",
        lat: base.lat,
        lng: base.lng,
        radiusKm,
        label: base.label,
      };
    if (mode === "france") return { kind: "france" };
    if (mode === "region") return { kind: "region", region };
    return { kind: "departments", codes: selected };
  }, [mode, radiusKm, region, selected, base]);

  async function measure() {
    setBusy("measuring");
    setPlan(null);
    setCompanies(null);
    setErrors([]);
    try {
      const res = await fetch("/api/prospection/estimate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope, minHeadcount }),
      });
      const data = await res.json();
      setPlan(data.plan);
      setErrors(data.errors ?? []);
    } catch {
      setErrors(["La mesure n'a pas abouti. Vérifiez l'accès réseau."]);
    } finally {
      setBusy("none");
    }
  }

  async function scan() {
    setBusy("scanning");
    setCompanies(null);
    try {
      const res = await fetch("/api/prospection/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope, minHeadcount }),
      });
      const data = await res.json();
      setCompanies(data.companies ?? []);
      setErrors(data.errors ?? []);
    } catch {
      setErrors(["Le balayage n'a pas pu partir."]);
    } finally {
      setBusy("none");
    }
  }

  const btn = (on: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm transition-colors ${
      on
        ? "bg-[#0f6b53] text-white"
        : "border border-gray-300 bg-white text-gray-600 hover:border-[#0f6b53]"
    }`;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <h2 className="text-xl font-bold text-[#12211c]">Territoire</h2>
      <p className="mt-2 max-w-2xl text-sm text-gray-500">
        Choisissez le périmètre, mesurez son volume réel, puis balayez. Rien ne
        part avant que le volume et la durée aient été annoncés. Le rayon prime
        sur la région : c&apos;est lui qui décide si un emplacement est tenable.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            ["radius", "Autour de la base"],
            ["region", "Par région"],
            ["departments", "Par département"],
            ["france", "France entière"],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setPlan(null);
              setCompanies(null);
            }}
            className={btn(mode === m)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
        {mode === "radius" && (
          <>
            <label className="flex flex-wrap items-center gap-3 text-sm text-[#12211c]">
              <span className="w-40">Rayon depuis {base.label}</span>
              <input
                type="range"
                min={5}
                max={50}
                step={5}
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="w-48 accent-[#0f6b53]"
              />
              <span className="w-16 tabular-nums">{radiusKm} km</span>
            </label>
            {radiusKm > 30 && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Au-delà de 30 km, un emplacement hebdomadaire devient difficile à
                tenir : trajet, carburant, heures non facturées. Le rayon utile
                d&apos;un camion est de 20 à 30 km.
              </p>
            )}
          </>
        )}

        {mode === "region" && (
          <div className="flex flex-wrap gap-2">
            {REGIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRegion(r)}
                className={`rounded-lg px-2.5 py-1 text-sm transition-colors ${
                  region === r
                    ? "bg-[#0f6b53] text-white"
                    : "border border-gray-300 hover:border-[#0f6b53]"
                }`}
              >
                {r}
              </button>
            ))}
            <p className="mt-2 w-full text-sm text-gray-500">
              {departmentsOf(region).length} départements
            </p>
          </div>
        )}

        {mode === "departments" && (
          <div className="flex max-h-56 flex-wrap gap-1.5 overflow-y-auto">
            {DEPARTMENTS.map((d) => {
              const on = selected.includes(d.code);
              return (
                <button
                  key={d.code}
                  type="button"
                  onClick={() =>
                    setSelected((s) =>
                      on ? s.filter((c) => c !== d.code) : [...s, d.code],
                    )
                  }
                  title={d.name}
                  className={`rounded px-2 py-1 text-xs tabular-nums transition-colors ${
                    on
                      ? "bg-[#0f6b53] text-white"
                      : "border border-gray-300 hover:border-[#0f6b53]"
                  }`}
                >
                  {d.code}
                </button>
              );
            })}
          </div>
        )}

        {mode === "france" && (
          <div className="text-sm text-gray-600">
            <p>
              {DEPARTMENTS.length} départements, sections d&apos;activité
              retenues, sites de {minHeadcount} salariés et plus.
            </p>
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
              Le national existe pour le plan agence, pas pour un camion. Un seul
              véhicule ne dessert pas la France : au-delà de son rayon, ce
              balayage sert à cartographier, pas à démarcher.
            </p>
          </div>
        )}

        <label className="mt-5 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4 text-sm text-[#12211c]">
          <span className="w-40">Effectif minimum du site</span>
          <input
            type="range"
            min={20}
            max={500}
            step={10}
            value={minHeadcount}
            onChange={(e) => setMinHeadcount(Number(e.target.value))}
            className="w-48 accent-[#0f6b53]"
          />
          <span className="w-16 tabular-nums">{minHeadcount}</span>
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={measure}
          disabled={busy !== "none"}
          className="rounded-lg bg-[#0f6b53] px-4 py-2.5 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy === "measuring" ? "Mesure en cours…" : "Mesurer le volume"}
        </button>
        <p className="text-sm text-gray-500">{describeScope(scope)}</p>
      </div>

      {plan && (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            {[
              ["Établissements", plan.totalCompanies.toLocaleString("fr-FR")],
              ["Requêtes", plan.fetchCalls.toLocaleString("fr-FR")],
              ["Durée", `${plan.fetchMinutes} min`],
              ["Coût données", "0 €"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-gray-200 bg-white p-4"
              >
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
                  {label}
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums text-[#12211c]">
                  {value}
                </p>
              </div>
            ))}
          </div>

          {plan.warnings.length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              {plan.warnings.map((w) => (
                <p key={w} className="mb-2 text-sm text-amber-900 last:mb-0">
                  {w}
                </p>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={scan}
            disabled={busy !== "none"}
            className="mt-5 rounded-lg bg-[#12211c] px-4 py-2.5 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy === "scanning" ? "Balayage en cours…" : "Lancer le balayage"}
          </button>
        </>
      )}

      {errors.length > 0 && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
          {errors.map((e) => (
            <p key={e} className="text-sm text-red-800">
              {e}
            </p>
          ))}
        </div>
      )}

      {companies && (
        <div className="mt-8">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
            {companies.length} établissements ramenés
          </p>
          <ul className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white">
            {companies.map((c) => (
              <li
                key={c.siret ?? c.siren}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-gray-100 px-4 py-3 last:border-b-0"
              >
                <span className="min-w-0 flex-1 text-sm font-semibold text-[#12211c]">
                  {c.name}
                </span>
                <span className="text-xs tabular-nums text-gray-500">
                  {c.headcountEstimate
                    ? `~${c.headcountEstimate} sal.`
                    : "effectif inconnu"}
                </span>
                <span className="w-full text-sm text-gray-500">
                  {c.siret ? `SIRET ${c.siret} · ` : ""}
                  {c.address ?? "adresse non renseignée"}
                  {c.nafCode ? ` · NAF ${c.nafCode}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
