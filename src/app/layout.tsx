import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

// Font z przewodnika identyfikacji: nagłówki 800, tekst 400 i 700.
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: { default: "Clipzy", template: "%s · Clipzy" },
  description: "Sklejki, AI nagrania i image ads pod Meta Ads.",
};

export const viewport: Viewport = {
  themeColor: "#100c16",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pl" className={`${nunito.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
