import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enBuddy from "./locales/en/buddy.json";
import enCommon from "./locales/en/common.json";
import enSettings from "./locales/en/settings.json";

const resources = {
  en: {
    buddy: enBuddy,
    common: enCommon,
    settings: enSettings,
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  ns: ["common", "buddy", "settings"],
  defaultNS: "common",
  interpolation: { escapeValue: false },
});

export default i18n;
