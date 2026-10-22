"use client";

import { useRouter } from "next/navigation";
import type { FieldSection, Question } from "@/lib/profiles/common";
import type { BrandProfile } from "@/lib/profiles/brand";
import { ProfileEditor } from "@/components/profile-editor";
import type { ControlReport } from "@/lib/ai/control";
import { ImageUpload } from "@/components/image-upload";
import { Logo } from "@/components/logo";
import { Card } from "@/components/ui";
import { refineBrandAction, saveBrandAction, setBrandLogo } from "../../actions";

export function BrandEditor(props: {
  brandId: string;
  sections: FieldSection[];
  profile: BrandProfile;
  questions: Question[];
  summary: string;
  review: ControlReport | null;
  logoUrl?: string;
  logoFolder: string;
}) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center gap-4">
        <Logo url={props.logoUrl} name={props.profile.name || "?"} size={64} />
        <div className="flex-1">
          <div className="font-semibold">Logo</div>
          <p className="text-sm text-muted">
            {props.logoUrl ? "Pobrane ze strony. Jeśli to nie to, wgraj właściwe (najlepiej PNG z przezroczystym tłem)." : "Nie udało się znaleźć logo na stronie — wgraj je (najlepiej PNG z przezroczystym tłem)."}
          </p>
        </div>
        <ImageUpload
          folder={props.logoFolder}
          label="Wgraj logo"
          onUploaded={async (paths) => {
            const res = await setBrandLogo(props.brandId, paths[0]);
            if (res.ok) router.refresh();
            return res.ok ? { ok: true } : { ok: false, error: res.error };
          }}
        />
      </Card>

      <ProfileEditor
        kind="brand"
        sections={props.sections}
        initialProfile={props.profile as unknown as Record<string, unknown>}
        initialQuestions={props.questions}
        initialSummary={props.summary}
        initialReview={props.review}
        refine={(profile, answers) => refineBrandAction(props.brandId, profile, answers)}
        save={(profile, finish) => saveBrandAction(props.brandId, profile, finish)}
        finishLabel="Zatwierdź profil marki"
      />
    </div>
  );
}
