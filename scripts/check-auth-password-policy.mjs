import { readFileSync } from "node:fs";
const config = readFileSync(new URL("../supabase/config.toml", import.meta.url), "utf8");
const source = readFileSync(
  new URL("../backend/src/features/registration/registration.service.ts", import.meta.url),
  "utf8",
);
const ui = readFileSync(
  new URL("../frontend/src/features/authentication/view/signup-view.tsx", import.meta.url),
  "utf8",
);
const failures = [];
if (!/minimum_password_length\s*=\s*8\b/.test(config)) failures.push("Supabase minimum password length must be 8.");
if (!/password_requirements\s*=\s*"lower_upper_letters_digits"/.test(config))
  failures.push("Supabase must require lowercase, uppercase, and digits.");
if (!/\(\?=\.\*\[a-z\]\).*\(\?=\.\*\[A-Z\]\).*\(\?=\.\*\\d\).*\{8,\}/s.test(source))
  failures.push("Backend password pattern differs from Supabase.");
if (!/\(\?=\.\*\[a-z\]\).*\(\?=\.\*\[A-Z\]\).*\(\?=\.\*\\d\).*\{8,\}/s.test(ui))
  failures.push("Frontend password pattern differs from Supabase.");
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("ECHO password policy is aligned across Supabase, backend, and frontend.");
