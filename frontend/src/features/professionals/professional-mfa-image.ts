/** Supabase can return an SVG data URL containing literal XML line breaks.
 * Encode its payload before passing it to Next Image's URL validation.
 */
export function professionalMfaImage(source: string): string {
  const comma = source.indexOf(",");
  if (comma < 0 || !source.startsWith("data:image/svg+xml")) throw new Error("Authenticator image unavailable.");
  if (source.slice(0, comma).includes(";base64")) return source;
  const payload = source.slice(comma + 1);
  const svg = payload.trimStart().startsWith("<") ? payload : decodeURIComponent(payload);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
