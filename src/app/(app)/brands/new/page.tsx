import { PageHeader } from "@/components/ui";
import { NewBrandForm } from "./new-brand-form";

// Scraping + Claude analysis can take a while.
export const maxDuration = 300;

export default function NewBrandPage() {
  return (
    <>
      <PageHeader
        title="Nowa marka"
        description="Wklej link do sklepu. Clipzy przeczyta stronę (strona główna, „o nas”, FAQ, kolory, logo, produkty), przygotuje szkic profilu i zada pytania o wszystko, czego nie da się wyczytać."
      />
      <NewBrandForm />
    </>
  );
}
