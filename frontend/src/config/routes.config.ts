export const ROUTES = {
  public: {
    home: "/",
    about: "/about",
    privacyPolicy: "/privacy-policy",
    terms: "/terms",
  },
  auth: {
    login: "/login",
    signup: "/signup",
    forgotPassword: "/forgot-password",
    resetPassword: "/reset-password",
  },
  onboarding: {
    consent: "/onboarding/consent",
    profile: "/onboarding/profile",
    setup: "/onboarding/setup",
  },
  dashboard: {
    index: "/dashboard",
  },
  journal: {
    list: "/journal",
    new: "/journal/new",
    detail: (id: string): string => `/journal/${encodeURIComponent(id)}`,
  },
  buddy: {
    chat: "/buddy",
    history: "/buddy/history",
  },
  insights: {
    emotion: "/insights/emotion",
    facial: "/insights/facial",
    risk: "/insights/risk",
  },
  settings: {
    profile: "/settings/profile",
    privacy: "/settings/privacy",
    security: "/settings/security",
    notifications: "/settings/notifications",
    export: "/settings/export",
    trustedContacts: "/settings/trusted-contacts",
  },
  tools: {
    grounding: "/tools/grounding",
  },
  support: {
    findHelp: "/support/find-help",
  },
  crisis: {
    index: "/crisis",
    help: "/crisis-help",
  },
  designSystem: {
    index: "/design-system",
  },
} as const;

export type RouteKey = keyof typeof ROUTES;
