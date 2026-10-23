import { PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { NewBrandForm } from "./new-brand-form";

// Scraping + Claude analysis can take a while.
export const maxDuration = 300;

export default function NewBrandPage() {
  return (
    <>
      <PageHeader
        title="Nowa marka"
        description="Wklej link do sklepu. Profil, grupę docelową i problemy klientów Claude przygotuje sam."
        back={<BackLink href="/brands">Marki</BackLink>}
      />
      <NewBrandForm />
    </>
  );
}

