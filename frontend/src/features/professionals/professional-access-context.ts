"use client";
import { createContext } from "react";
import type { professionalApi } from "@/services/professionals/professional-api";
export type ProfessionalAccess = Awaited<ReturnType<typeof professionalApi.memberships>>;
// Owned by a mounted organization gate with bounded revalidation. No persistence.
export const ProfessionalAccessContext = createContext<ProfessionalAccess | null>(null);
export const ProfessionalRevalidateContext = createContext<(() => Promise<void>) | null>(null);
