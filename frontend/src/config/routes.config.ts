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
  calendar: "/calendar",
  buddy: {
    chat: "/buddy",
    history: "/buddy/history",
  },
  insights: {
    index: "/insights",
    emotion: "/insights/emotion",
    facial: "/insights/facial",
    risk: "/insights/risk",
  },
  settings: {
    profile: "/settings/profile",
    verification: "/settings/verification",
    privacy: "/settings/privacy",
    security: "/settings/security",
    notifications: "/settings/notifications",
    export: "/settings/export",
    trustedContacts: "/settings/trusted-contacts",
  },
  admin: {
    verifications: "/admin/verifications",
  },
  tools: {
    grounding: "/tools/grounding",
  },
  support: {
    findHelp: "/support/find-help",
  },
  professionalSupport: {
    index: "/professional-support",
    discover: "/professional-support/discover",
    requests: "/professional-support/requests",
    request: (id: string): string => `/professional-support/requests/${encodeURIComponent(id)}`,
    newRequest: "/professional-support/requests/new",
    appointments: "/professional-support/appointments",
    messages: "/professional-support/messages",
    history: "/professional-support/history",
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
