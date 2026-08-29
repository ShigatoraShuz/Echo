export function referencedDatabaseTables(content) {
  const tables = new Set();
  for (const pattern of [
    /\.from\(\s*["']([a-z_]+)["']\s*\)/g,
    /\.table\(\s*["']([a-z_]+)["']\s*\)/g,
    /\/rest\/v1\/([a-z_]+)/g,
  ]) {
    for (const match of content.matchAll(pattern)) tables.add(match[1]);
  }
  return [...tables];
}

export function usesDirectSupabaseClient(content) {
  return /\bcreateClient\s*\(|\bcreate_client\s*\(/.test(content);
}
