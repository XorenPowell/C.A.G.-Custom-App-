import type { Metadata, Viewport } from "next";
import { Inter, Oswald } from "next/font/google";
import "./globals.css";

// Oswald drives numeric stats, section titles, ticket times and headlines;
// Inter is everything else. Both are exposed as CSS variables consumed by
// --font-sans / --font-heading in globals.css — that @theme block is the
// only place a font-family should be referenced from.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});
const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-oswald",
});

export const metadata: Metadata = {
  title: "C.A.G. Dispatch",
  description: "Call A Guy Chicago — internal dispatch",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // Mirrors --bg in globals.css. A literal value is unavoidable here —
  // this meta tag can't reference a CSS custom property — so keep the two
  // in sync by hand if the background token ever changes.
  themeColor: "#17191c",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${oswald.variable}`}>
      <body>{children}</body>
    </html>
  );
}
