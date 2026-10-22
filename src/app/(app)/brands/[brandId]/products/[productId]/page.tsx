import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getBrand, getProduct, getProductImages } from "@/lib/data";
import { PRODUCT_FORM } from "@/lib/profiles/product";
import { productFolder, signedUrls } from "@/lib/storage";
import { Badge, PageHeader, buttonClass } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { ProductEditor } from "./product-editor";
import { deleteProduct } from "../actions";

export const maxDuration = 300;

export default async function ProductPage({ params }: PageProps<"/brands/[brandId]/products/[productId]">) {
  const { brandId, productId } = await params;
  const { supabase, user } = await requireUser();
  const brand = await getBrand(supabase, brandId);
  const product = await getProduct(supabase, brand.id, productId);
  const images = await getProductImages(supabase, product.id);
  const urls = await signedUrls(supabase, images.map((i) => i.storage_path));

  return (
    <>
      <PageHeader
        title={product.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {brand.name}
            {product.status === "ready" ? <Badge tone="ok">Gotowy</Badge> : <Badge tone="warn">Szkic</Badge>}
            {product.product_url ? (
              <a href={product.product_url} target="_blank" rel="noreferrer" className="hover:text-text">strona produktu ↗</a>
            ) : null}
          </span>
        }
        actions={<Link href={`/brands/${brand.id}`} className={buttonClass("ghost")}>← {brand.name}</Link>}
      />

      <ProductEditor
        brandId={brand.id}
        productId={product.id}
        sections={PRODUCT_FORM}
        profile={product.profile}
        questions={product.questions}
        completeness={product.completeness}
        summary={product.summary}
        images={images.map((i) => ({ id: i.id, url: urls[i.storage_path] ?? "" }))}
        imageFolder={productFolder(user.id, product.id)}
      />

      <div className="mt-16 border-t border-border pt-6">
        <form action={deleteProduct}>
          <input type="hidden" name="brandId" value={brand.id} />
          <input type="hidden" name="productId" value={product.id} />
          <ConfirmButton message={`Usunąć produkt „${product.name}” razem ze zdjęciami?`}>Usuń produkt</ConfirmButton>
        </form>
      </div>
    </>
  );
}
