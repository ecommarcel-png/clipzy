import { requireUser } from "@/lib/auth";
import { getBrand } from "@/lib/data";
import { BRAND_FORM } from "@/lib/profiles/brand";
import { brandFolder, signedUrls } from "@/lib/storage";
import { PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
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
        title="Profil marki"
        description="Sprawdź, dla kogo jest marka i z czym mierzą się klienci. Jeśli się zgadza, zatwierdź."
        back={<BackLink href={`/brands/${brand.id}`}>{brand.name}</BackLink>}
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
