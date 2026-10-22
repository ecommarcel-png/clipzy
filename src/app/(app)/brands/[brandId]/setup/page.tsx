import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getBrand } from "@/lib/data";
import { BRAND_FORM } from "@/lib/profiles/brand";
import { brandFolder, signedUrls } from "@/lib/storage";
import { PageHeader, buttonClass } from "@/components/ui";
import { BrandEditor } from "./brand-editor";

// Each refinement round is a Claude call.
export const maxDuration = 300;

export default async function BrandSetupPage({ params }: PageProps<"/brands/[brandId]/setup">) {
  const { brandId } = await params;
  const { supabase, user } = await requireUser();
  const brand = await getBrand(supabase, brandId);
  const logoUrl = brand.logo_path ? (await signedUrls(supabase, [brand.logo_path]))[brand.logo_path] : undefined;

  return (
    <>
      <PageHeader
        title={`Profil marki: ${brand.name}`}
        description="Claude przygotował profil na podstawie strony. Sprawdź grupę docelową i problemy — jeśli się zgadzają, zatwierdź. Styl dopracujesz później feedbackiem do gotowych reklam."
        actions={<Link href={`/brands/${brand.id}`} className={buttonClass("ghost")}>← Wróć do marki</Link>}
      />
      <BrandEditor
        brandId={brand.id}
        sections={BRAND_FORM}
        profile={brand.profile}
        questions={brand.questions}
        summary={brand.summary}
        review={brand.review}
        logoUrl={logoUrl}
        logoFolder={brandFolder(user.id, brand.id)}
      />
    </>
  );
}
