import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reel maker · WhatsUpDurbs",
  robots: { index: false, follow: false },
};

export default function ReelLayout({ children }: { children: React.ReactNode }) {
  return children;
}
