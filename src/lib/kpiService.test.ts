import { describe, it, expect } from "vitest";
import {
  ratioKpi, processesWithStrategy, processesWithApprovedPlan, usedResourcesKpi,
  isRecentClosedExercise, maturityKpi, loadingKpi, errorKpi,
} from "./kpiService";

const ids = new Set(["p1", "p2"]);

describe("kpiService", () => {
  it("dénominateur 0 → empty, pas 0 %", () => {
    expect(ratioKpi(0, 0).status).toBe("empty");
    expect(ratioKpi(28, 44).percentage).toBe(64);
  });
  it("stratégies orphelines exclues", () => {
    expect(processesWithStrategy([{ processus_id: "p1" }, { processus_id: "zz" }, { processus_id: "p1" }], ids).size).toBe(1);
  });
  it("plans non approuvés exclus", () => {
    const plans = [{ id: "a", statut: "Approuvé" }, { id: "b", statut: "Brouillon" }];
    const links = [{ plan_id: "a", processus_id: "p1" }, { plan_id: "b", processus_id: "p2" }];
    expect([...processesWithApprovedPlan(plans, links, ids)]).toEqual(["p1"]);
  });
  it("ressources utilisées sans doublon ni lien invalide", () => {
    const k = usedResourcesKpi([{ ids: ["r1", "r2"], key: "rid", links: [
      { processus_id: "p1", rid: "r1" }, { processus_id: "p2", rid: "r1" }, { processus_id: "zz", rid: "r2" },
    ] }], ids);
    expect([k.numerator, k.denominator]).toEqual([1, 2]);
  });
  it("exercices > 12 mois ou non clôturés exclus", () => {
    const now = new Date("2026-10-01");
    expect(isRecentClosedExercise({ statut: "TERMINE", date_fin_reelle: "2026-05-01" }, now)).toBe(true);
    expect(isRecentClosedExercise({ statut: "TERMINE", date_fin_reelle: "2025-01-01" }, now)).toBe(false);
    expect(isRecentClosedExercise({ statut: "PLANIFIE", date_fin_reelle: "2026-05-01" }, now)).toBe(false);
    expect(isRecentClosedExercise({ statut: "TERMINE", date_fin_reelle: "invalid" }, now)).toBe(false);
  });
  it("maturité : erreur/chargement jamais converti en 0", () => {
    const r = ratioKpi(1, 2);
    expect(maturityKpi({ bia: r, risques: r, strategies: r, plans: loadingKpi(), ressources: r }).status).toBe("loading");
    expect(maturityKpi({ bia: r, risques: r, strategies: r, plans: errorKpi(), ressources: r }).status).toBe("error");
  });
});
