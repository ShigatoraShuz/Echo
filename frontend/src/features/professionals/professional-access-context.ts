"use client";
import { createContext } from "react";
import type { professionalApi } from "@/services/professionals/professional-api";
export type ProfessionalAccess = Awaited<ReturnType<typeof professionalApi.memberships>>;
// Owned by a mounted route gate; no authorization result survives navigation.
export const ProfessionalAccessContext = createContext<ProfessionalAccess | null>(null);
