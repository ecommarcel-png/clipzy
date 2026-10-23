import { requireUser } from "@/lib/auth";
import { getBrand, getProduct, getProductImages } from "@/lib/data";
import { PRODUCT_FORM } from "@/lib/profiles/product";
import { productFolder, signedUrls } from "@/lib/storage";
import { Badge, PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { ConfirmButton } from "@/components/confirm-button";
import { ProductEditor } from "./product-editor";
import { ResearchCard } from "./research-card";
import { LibrarySection } from "./library-section";
import { libraryCards } from "@/lib/clips/library-view";
import type { ResearchReport } from "@/lib/ai/research";
import { deleteProduct } from "../actions";

export const maxDuration = 300;

export default async function ProductPage({ params }: PageProps<"/brands/[brandId]/products/[productId]">) {
  const { brandId, productId } = await params;
  const { supabase, user } = await requireUser();
  const brand = await getBrand(supabase, brandId);
  const product = await getProduct(supabase, brand.id, productId);
  const images = await getProductImages(supabase, product.id);
  const urls = await signedUrls(supabase, images.map((i) => i.storage_path));
  const saved = await libraryCards(supabase, { brandId: brand.id, productId: product.id }, true);

  return (
    <>
      <PageHeader
        title={product.name}
        description={
          <span className="flex flex-wrap items-center gap-3">
            {product.status === "ready" ? <Badge tone="ok" dot>Gotowy</Badge> : <Badge tone="warn" dot>Do zatwierdzenia</Badge>}
            {product.product_url ? (
              <a href={product.product_url} target="_blank" rel="noreferrer" className="hover:text-text">strona produktu ↗</a>
            ) : null}
          </span>
        }
        back={<BackLink href={`/brands/${brand.id}`}>{brand.name}</BackLink>}
      />

      <div className="mb-5">
        <ResearchCard
          brandId={brand.id}
          productId={product.id}
          research={(product.source.research as ResearchReport | undefined) ?? null}
        />
      </div>

      <div className="mb-5">
        <LibrarySection items={saved} brandId={brand.id} productId={product.id} />
      </div>

      <ProductEditor
        brandId={brand.id}
        productId={product.id}
        sections={PRODUCT_FORM}
        profile={product.profile}
        questions={product.questions}
        summary={product.summary}
        review={product.review}
        images={images.map((i) => ({ id: i.id, url: urls[i.storage_path] ?? "" }))}
        imageFolder={productFolder(user.id, product.id)}
      />

      <div className="mt-16 flex justify-end">
        <form action={deleteProduct}>
          <input type="hidden" name="brandId" value={brand.id} />
          <input type="hidden" name="productId" value={product.id} />
          <ConfirmButton subtle message={`Usunąć produkt „${product.name}” razem ze zdjęciami?`}>Usuń produkt</ConfirmButton>
        </form>
      </div>
    </>
  );
}
