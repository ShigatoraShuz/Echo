"use client";
import { useState } from "react";
import { createApiClient } from "@/infrastructure/api/api-client";
import { supabaseAuthTokenProvider } from "@/infrastructure/api/supabase-auth-token-provider";
import { env } from "@/config/environment";
export function LocalDataControls() { const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false); const client = createApiClient({ baseUrl: env.apiBaseUrl, tokenProvider: supabaseAuthTokenProvider }); async function run(remove: boolean) { if (remove && !window.confirm('Delete all analysis results and saved Buddy conversations on this computer? Cloud journals will remain.'))
    return; setBusy(true); try {
    if (remove) {
        await client.delete('/local-data');
        setMessage('Local history deleted.');
    }
    else {
        const data = await client.get('/local-data');
        const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'echo-local-data.json';
        a.click();
        URL.revokeObjectURL(url);
        setMessage('Local history downloaded.');
    }
}
catch {
    setMessage('Local history is unavailable. Check that ECHO is running in local JSON mode.');
}
finally {
    setBusy(false);
} } return <section className="space-y-3 rounded-xl border p-4"><h2>Local analysis and Buddy history</h2><p>Readable JSON files stay on this computer until deleted. Cloud journals remain encrypted. Local history is separate from your cloud account export.</p><button disabled={busy} onClick={() => void run(false)}>Download local JSON</button>{' '}<button disabled={busy} onClick={() => void run(true)}>Delete local history</button><p role="status">{message}</p></section>; }
