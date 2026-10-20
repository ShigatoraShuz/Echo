/** Read-only cloud inspection. Never provisions roles or invokes the Supabase CLI. */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

export const cloudProject = "lruciislmmqvcwweqjop";
export async function cloudReadOnly() {
  const script = `Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices; using System.Runtime.InteropServices.ComTypes;
public class EchoReadCredential {
 [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] public struct Credential {
 public uint Flags,Type; public string TargetName,Comment; public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
 public uint Size; public IntPtr Blob; public uint Persist,Count; public IntPtr Attributes; public string Alias,User;
 }
 [DllImport("advapi32.dll", EntryPoint="CredReadW", CharSet=CharSet.Unicode, SetLastError=true)] public static extern bool Read(string target,uint type,uint flags,out IntPtr credential);
 [DllImport("advapi32.dll")] public static extern void CredFree(IntPtr credential);
}
'@
foreach($target in @('Supabase CLI:supabase','Supabase CLI:access-token')) {
 $pointer=[IntPtr]::Zero
 if([EchoReadCredential]::Read($target,1,0,[ref]$pointer)) {
  try { $c=[Runtime.InteropServices.Marshal]::PtrToStructure($pointer,[type][EchoReadCredential+Credential]); $bytes=New-Object byte[] $c.Size; [Runtime.InteropServices.Marshal]::Copy($c.Blob,$bytes,0,$c.Size); [Console]::Out.Write([Text.Encoding]::UTF8.GetString($bytes)); break }
  finally { [EchoReadCredential]::CredFree($pointer) }
 }
}`;
  let token: string;
  try { token = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch { throw new Error("Authorized Management credential unavailable."); }
  if (!token.startsWith("sbp_")) throw new Error("Authorized Management credential unavailable.");
  const management = async (path: string, query?: string) => {
    if (query && !/^select\s/i.test(query)) throw new Error("Only SELECT inspection is permitted.");
    const response = await fetch(`https://api.supabase.com/v1/projects/${cloudProject}${path}`, {
      method: query ? "POST" : "GET", redirect: "error", signal: AbortSignal.timeout(60_000),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      ...(query ? { body: JSON.stringify({ query, read_only: true }) } : {}),
    });
    if (!response.ok) throw new Error(`Read-only Management inspection HTTP ${response.status}.`);
    return response.json();
  };
  const identity = await management("");
  if (identity.id !== cloudProject || identity.name !== "ECHO UPDATED THESIS2" || identity.region !== "ap-south-1") throw new Error("Cloud identity mismatch.");
  const environment = parseEnv(readFileSync(new URL("../../.env", import.meta.url), "utf8"));
  if (environment.SUPABASE_URL !== `https://${cloudProject}.supabase.co`) throw new Error("Backend cloud project mismatch.");
  return {
    environment,
    query: (query: string) => management("/database/query", query),
    storageGet: async (bucket: string, name: string) => {
      if (!environment.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Authorized Storage credential unavailable.");
      const path = [bucket, ...name.split("/")].map(encodeURIComponent).join("/");
      const response = await fetch(`https://${cloudProject}.supabase.co/storage/v1/object/authenticated/${path}`, {
        method: "GET", redirect: "error", signal: AbortSignal.timeout(60_000),
        headers: { apikey: environment.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${environment.SUPABASE_SERVICE_ROLE_KEY}` },
      });
      if (!response.ok) throw new Error(`Read-only Storage download HTTP ${response.status}.`);
      return response;
    },
  };
}
