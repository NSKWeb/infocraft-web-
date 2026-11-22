import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InfoCraft — Visual stories, engineered with AI",
  description: "Turn raw information into clear, editorial-grade visual stories."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className="dark"><body>{children}</body></html>;
}
