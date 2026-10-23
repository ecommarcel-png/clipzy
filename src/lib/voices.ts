// Voices Clipzy can generate a voiceover with (ElevenLabs). The ElevenLabs id is
// looked up by name in the user's own account, so a cloned voice works too.
export type Voice = {
  id: string;
  label: string;
  elevenName: string;
  model: string;
  settings: { speed: number; stability: number; similarity_boost: number; style: number; use_speaker_boost: boolean };
  /** spoken words per second at this speed — turns the length slider into a word budget */
  wordsPerSecond: number;
};

export const VOICES: Voice[] = [
  {
    id: "test",
    label: "test",
    elevenName: "Lena Suzuki",
    model: "eleven_multilingual_v2",
    settings: { speed: 1.1, stability: 0.5, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true },
    wordsPerSecond: 2.6,
  },
];

export function getVoice(id: string | undefined): Voice {
  return VOICES.find((v) => v.id === id) ?? VOICES[0];
}

export const VOICE_SAMPLE_TEXT = "Cześć! Tak brzmi lektor Twoich reklam w Clipzy.";
