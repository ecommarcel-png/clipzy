import raw from "@/generated/library.json";

// Music and SFX shipped in public/biblioteka (manifest built by scripts/build-library.mjs).
export type LibraryItem = { file: string; name: string; category: string | null; duration: number | null; start?: number; bytes: number };
export const library = raw as unknown as { music: LibraryItem[]; sfx: LibraryItem[] };
