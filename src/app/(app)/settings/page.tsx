import { requireUser } from "@/lib/auth";
import { PROVIDERS, PROVIDER_INFO } from "@/lib/providers";
import { PageHeader } from "@/components/ui";
import { KeyCard, type KeyRow } from "./key-card";

export default async function SettingsPage() {
  const { supabase } = await requireUser();
  // Never select the ciphertext here: this data goes to the browser.
  const { data } = await supabase.from("api_keys").select("provider, last4, status, status_note, tested_at");
  const byProvider = new Map((data ?? []).map((row) => [row.provider, row as KeyRow]));

  return (
    <>
      <PageHeader
        title="Ustawienia"
        description="Klucze API do modeli. Każdy klucz jest szyfrowany na serwerze i nigdy nie trafia z powrotem do przeglądarki — po zapisaniu widać tylko jego ostatnie 4 znaki. Płacisz bezpośrednio u dostawców, bez subskrypcji."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {PROVIDERS.map((p) => (
          // Remount when the saved key changes so the card returns to its "saved" view.
          <KeyCard
            key={`${p}:${byProvider.get(p)?.last4 ?? ""}:${byProvider.get(p)?.tested_at ?? ""}`}
            info={PROVIDER_INFO[p]}
            row={byProvider.get(p) ?? null}
          />
        ))}
      </div>
    </>
  );
}
