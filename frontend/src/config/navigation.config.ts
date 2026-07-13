import { ROUTES } from "@/config/routes.config";

export type NavigationIconKey =
  | "home"
  | "bookOpen"
  | "bot"
  | "barChart3"
  | "wind"
  | "heartHandshake"
  | "settings"
  | "shieldAlert"
  | "userRound"
  | "bell"
  | "usersRound"
  | "keyRound"
  | "download"
  | "shield"
  | "lock"
  | "slidersHorizontal"
  | "info"
  | "privacy"
  | "terms"
  | "penLine";

export interface NavigationEntry {
  id: string;
  label: string;
  href: string;
  iconKey: NavigationIconKey;
  description?: string;
  requiredFeatureFlag?: string;
  match?: "exact" | "prefix";
}

export interface NavigationGroup {
  id: string;
  label?: string;
  entries: NavigationEntry[];
}

export const publicNavigation: NavigationEntry[] = [
  { id: "about", label: "About", href: ROUTES.public.about, iconKey: "info", match: "exact" },
  { id: "privacy", label: "Privacy", href: ROUTES.public.privacyPolicy, iconKey: "privacy", match: "exact" },
  { id: "crisis-help", label: "Crisis help", href: ROUTES.crisis.help, iconKey: "shieldAlert", match: "exact" },
];

export const appNavigation: NavigationEntry[] = [
  { id: "dashboard", label: "Dashboard", href: ROUTES.dashboard.index, iconKey: "home", match: "exact" },
  { id: "journal", label: "Journal", href: ROUTES.journal.list, iconKey: "bookOpen", match: "prefix" },
  { id: "buddy", label: "Buddy", href: ROUTES.buddy.chat, iconKey: "bot", match: "prefix" },
  { id: "insights", label: "Insights", href: ROUTES.insights.emotion, iconKey: "barChart3", match: "prefix" },
  { id: "grounding", label: "Grounding", href: ROUTES.tools.grounding, iconKey: "wind", match: "exact" },
  { id: "find-help", label: "Find help", href: ROUTES.support.findHelp, iconKey: "heartHandshake", match: "exact" },
  { id: "settings", label: "Settings", href: ROUTES.settings.profile, iconKey: "settings", match: "prefix" },
];

export const settingsNavigation: NavigationEntry[] = [
  { id: "settings-profile", label: "Profile", href: ROUTES.settings.profile, iconKey: "userRound", match: "exact" },
  { id: "settings-privacy", label: "Privacy", href: ROUTES.settings.privacy, iconKey: "shield", match: "exact" },
  { id: "settings-notifications", label: "Notifications", href: ROUTES.settings.notifications, iconKey: "bell", match: "exact" },
  { id: "settings-contacts", label: "Trusted contacts", href: ROUTES.settings.trustedContacts, iconKey: "usersRound", match: "exact" },
  { id: "settings-security", label: "Security", href: ROUTES.settings.security, iconKey: "keyRound", match: "exact" },
  { id: "settings-export", label: "Export", href: ROUTES.settings.export, iconKey: "download", match: "exact" },
];

export const mobileNavigation: NavigationEntry[] = [
  { id: "mobile-dashboard", label: "Home", href: ROUTES.dashboard.index, iconKey: "home", match: "exact" },
  { id: "mobile-journal", label: "Journal", href: ROUTES.journal.list, iconKey: "bookOpen", match: "prefix" },
  { id: "mobile-buddy", label: "Buddy", href: ROUTES.buddy.chat, iconKey: "bot", match: "exact" },
  { id: "mobile-insights", label: "Insights", href: ROUTES.insights.emotion, iconKey: "barChart3", match: "prefix" },
  { id: "mobile-settings", label: "Settings", href: ROUTES.settings.profile, iconKey: "settings", match: "prefix" },
];

export const crisisAction: NavigationEntry = {
  id: "crisis-support",
  label: "Crisis support",
  href: ROUTES.crisis.index,
  iconKey: "shieldAlert",
  description: "Immediate support is available",
  match: "exact",
};

export function findActiveNavigation(
  entries: NavigationEntry[],
  currentPath: string
): string | null {
  for (const entry of entries) {
    if (entry.match === "exact") {
      if (entry.href === currentPath) return entry.id;
    } else {
      if (currentPath.startsWith(entry.href)) return entry.id;
    }
  }
  return null;
}
