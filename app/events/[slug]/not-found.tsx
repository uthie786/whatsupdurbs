import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function EventNotFound() {
  return (
    <>
      <Navbar compact />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-20 text-center">
        <h1 className="font-display text-4xl uppercase">Eish, that event&apos;s gone.</h1>
        <p className="font-semibold">It may have been removed or the link is wrong.</p>
        <Link href="/#events" className="brutal-btn bg-durbs-yellow">
          See what&apos;s on
        </Link>
      </main>
      <Footer />
    </>
  );
}
