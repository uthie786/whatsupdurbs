import type { ReactNode } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";

export const CONTACT_EMAIL = "uthmaan.essack@gmail.com";

/** Shared layout for the privacy policy and data-deletion pages. */
export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <>
      <Navbar compact />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
        <div className="space-y-2">
          <h1 className="font-display text-4xl uppercase leading-none">{title}</h1>
          <p className="text-sm font-bold text-neutral-600">Last updated: {updated}</p>
        </div>
        <div className="legal space-y-5 border-4 border-black bg-white p-6 shadow-brutal-lg">{children}</div>
      </main>
      <Footer />
    </>
  );
}
