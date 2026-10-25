import type { Metadata } from "next";
import "@fontsource-variable/manrope";
import "@fontsource-variable/noto-sans-jp";
import "./globals.css";

export const metadata: Metadata = {
  title: "Versify",
  description: "Find your song. Follow every word. A quiet space for music and synchronized lyrics.",
};

// Runs before first paint so a saved or system night theme never flashes light. Mirrors readSettings' theme default.
const themeScript = `(function(){try{var t=JSON.parse(localStorage.getItem("verse-settings")||"{}").theme;if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-theme="light" suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
    <body>{children}</body>
  </html>;
}
