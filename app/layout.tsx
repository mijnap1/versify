import type { Metadata } from "next";
import "@fontsource-variable/manrope";
import "@fontsource-variable/noto-sans-jp";
import "./globals.css";

export const metadata: Metadata = {
  title: "Versify",
  description: "Find your song. Follow every word. A quiet space for music and synchronized lyrics.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
