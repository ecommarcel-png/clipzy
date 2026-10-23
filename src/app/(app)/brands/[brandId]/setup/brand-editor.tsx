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
    <div className="space-y-5">
      <Card className="flex flex-wrap items-center gap-4 py-4">
        <Logo url={props.logoUrl} name={props.profile.name || "?"} size={48} />
        <div className="min-w-0 flex-1">
          <div className="font-bold">Logo</div>
          <p className="text-xs text-muted">{props.logoUrl ? "Pobrane ze strony." : "Nie znalazłem logo na stronie — wgraj PNG z przezroczystym tłem."}</p>
        </div>
        <ImageUpload
          folder={props.logoFolder}
          label={props.logoUrl ? "Zmień" : "Wgraj logo"}
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
