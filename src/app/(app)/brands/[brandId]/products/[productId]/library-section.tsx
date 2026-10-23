import Link from "next/link";
import { Disclosure, buttonClass } from "@/components/ui";
import { LibraryTile } from "@/components/library-tile";
import { ConfirmIconButton } from "@/components/confirm-icon-button";
import type { LibraryCard } from "@/lib/clips/library-view";
import { plural } from "@/lib/plural";
import { deleteLibraryItemAction } from "@/app/(app)/clips/actions";

// Saved footage of this product: what the next sklejka can use for free.
export function LibrarySection({ items, brandId, productId }: { items: LibraryCard[]; brandId: string; productId: string }) {
  const ai = items.filter((i) => i.kind === "generated").length;
  const back = `/brands/${brandId}/products/${productId}`;
  return (
    <Disclosure
      title="Biblioteka materiałów"
      meta={items.length ? `${items.length} ${plural(items.length, "plik", "pliki", "plików")}${ai ? ` · ${ai} AI` : ""}` : "pusta"}
    >
      {items.length ? (
        <>
          <p className="text-sm text-muted">
            Nagrania i ujęcia AI z Twoich sklejek, już przeanalizowane. Kolejna sklejka użyje ich od razu — wystarczy nowy lektor.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {items.map((i) => (
              <div key={i.id}>
                <a href={i.videoUrl ?? undefined} target="_blank" rel="noreferrer" title={i.summary || i.name} className="block">
                  <LibraryTile name={i.name} posterUrl={i.posterUrl} kind={i.kind} duration={i.duration} />
                </a>
                <div className="mt-1 flex items-center justify-between gap-1 text-[10px] text-faint">
                  <span>{i.uses > 1 ? `w ${i.uses} sklejkach` : "1 sklejka"}</span>
                  <form action={deleteLibraryItemAction}>
                    <input type="hidden" name="itemId" value={i.id} />
                    <input type="hidden" name="back" value={back} />
                    <ConfirmIconButton label="Usuń z biblioteki" message={`Usunąć „${i.name}” z biblioteki? Gotowe sklejki zostaną bez zmian.`}>×</ConfirmIconButton>
                  </form>
                </div>
              </div>
            ))}
          </div>
          <Link href={`/clips/new?brand=${brandId}&product=${productId}`} className={buttonClass("primary", "mt-5")}>
            Nowa sklejka z tymi materiałami
          </Link>
        </>
      ) : (
        <p className="text-sm text-muted">
          Pusto. Nagrania wgrane do sklejki tego produktu i ujęcia wygenerowane przez AI zapiszą się tu automatycznie — następna sklejka nie zapłaci za nie drugi raz.
        </p>
      )}
    </Disclosure>
  );
}
