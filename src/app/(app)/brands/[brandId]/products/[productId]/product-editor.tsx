"use client";

import { useRouter } from "next/navigation";
import type { FieldSection, Question } from "@/lib/profiles/common";
import type { ProductProfile } from "@/lib/profiles/product";
import { ProfileEditor } from "@/components/profile-editor";
import type { ControlReport } from "@/lib/ai/control";
import { ImageUpload } from "@/components/image-upload";
import { Card } from "@/components/ui";
import { addProductImages, deleteProductImage, refineProductAction, saveProductAction } from "../actions";

export function ProductEditor(props: {
  brandId: string;
  productId: string;
  sections: FieldSection[];
  profile: ProductProfile;
  questions: Question[];
  summary: string;
  review: ControlReport | null;
  images: Array<{ id: string; url: string }>;
  imageFolder: string;
}) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Zdjęcia produktu</h2>
            <p className="mt-1 text-sm text-muted">
              Claude ogląda pierwsze 4 zdjęcia przy analizie, a modele wideo i obrazu używają ich jako referencji wyglądu produktu. Dodaj ujęcia z różnych stron i w użyciu.
            </p>
          </div>
          <ImageUpload
            folder={props.imageFolder}
            multiple
            label="+ Dodaj zdjęcia"
            onUploaded={async (paths) => {
              const res = await addProductImages(props.brandId, props.productId, paths);
              if (res.ok) router.refresh();
              return res.ok ? { ok: true } : { ok: false, error: res.error };
            }}
          />
        </div>
        {props.images.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Brak zdjęć — dodaj co najmniej 3.</p>
        ) : (
          <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {props.images.map((img) => (
              <div key={img.id} className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {img.url ? <img src={img.url} alt="" className="h-full w-full object-cover" /> : null}
                <form action={deleteProductImage} className="absolute right-1 top-1 opacity-0 transition group-hover:opacity-100">
                  <input type="hidden" name="imageId" value={img.id} />
                  <input type="hidden" name="brandId" value={props.brandId} />
                  <input type="hidden" name="productId" value={props.productId} />
                  <button className="rounded bg-black/70 px-2 py-0.5 text-xs text-white" aria-label="Usuń zdjęcie">Usuń</button>
                </form>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ProfileEditor
        kind="product"
        sections={props.sections}
        initialProfile={props.profile as unknown as Record<string, unknown>}
        initialQuestions={props.questions}
        initialSummary={props.summary}
        initialReview={props.review}
        refine={(profile, answers) => refineProductAction(props.brandId, props.productId, profile, answers)}
        save={(profile, finish) => saveProductAction(props.brandId, props.productId, profile, finish)}
        finishLabel="Zatwierdź profil produktu"
      />
    </div>
  );
}
