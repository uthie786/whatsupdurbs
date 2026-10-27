import Link from "next/link";
import { Plus } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t-4 border-black bg-black text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-8">
        <Link href="/" className="flex items-center gap-1.5 font-display text-xl">
          <span>WhatsUp<span className="text-durbs-pink">Durbs</span></span>
          <img src="/logo.svg" alt="" aria-hidden className="h-7 w-auto" />
        </Link>
        <p className="text-sm font-semibold text-neutral-300">
          Made with sunshine &amp; sea salt in Durban. *Roughly.
        </p>
        <Link href="/submit" className="brutal-btn bg-durbs-yellow text-black">
          Submit Event <Plus className="h-4 w-4" />
        </Link>
      </div>
    </footer>
  );
}
