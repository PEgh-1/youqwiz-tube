// Finitions v3 (14/11/2026) : lots activés pour l'épisode en cours, lus par les composants partagés (mascottes…).
import { createContext, useContext } from "react";
import type { Fx } from "./types";

export const FxContext = createContext<Fx>({});
export const useFx = (): Fx => useContext(FxContext);
