import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { CONTACT_EMAIL } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy | WhatsUpDurbs",
  description: "How WhatsUpDurbs collects, uses and protects information.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="28 October 2026">
      <p>
        WhatsUpDurbs (&quot;we&quot;, &quot;us&quot;) is a free guide to events in Durban, South Africa, at{" "}
        <Link href="/">whatsupdurbs.vercel.app</Link>. This policy explains what information we handle, why, and your
        choices. We follow South Africa&apos;s Protection of Personal Information Act (POPIA). Questions:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>1. Visitors</h2>
      <ul>
        <li>You don&apos;t need an account to browse.</li>
        <li>
          <strong>Saved events</strong> (the ❤️ button) are stored only in your own browser and never sent to us.
        </li>
        <li>
          <strong>&quot;Near me&quot;</strong> asks your browser for your location only when you tap it. The distance is
          worked out on your device; your location is not sent to or stored by us.
        </li>
        <li>
          Our hosting provider (Vercel) keeps standard server logs, such as IP address and browser type, for security
          and reliability. Map tiles are loaded from OpenStreetMap, and event images may load from the sites that host
          them, so those services see your IP address.
        </li>
      </ul>

      <h2>2. Event organisers who submit events</h2>
      <ul>
        <li>
          When you use <Link href="/submit">Submit Event</Link>, we store the event details you enter and any poster you
          upload, and publish them if approved. Don&apos;t include personal information you don&apos;t want shown publicly.
        </li>
        <li>
          If you upload a poster, the image is sent to Google&apos;s Gemini AI service to read the event details for you.
        </li>
        <li>
          To prevent abuse we briefly record your IP address with poster uploads and reads. These records are deleted
          automatically after 2 days.
        </li>
        <li>Submissions we decline are deleted automatically within 24 hours.</li>
      </ul>

      <h2>3. Events we collect from public sources</h2>
      <ul>
        <li>
          <strong>Public event posters:</strong> our team may add events from posters that venues, promoters and
          organisers publish publicly (for example on their websites or social media). We store the event details and
          a copy of the poster, and credit or link the organiser where possible. We don&apos;t collect information about
          people who view or interact with those posts.
        </li>
        <li>
          <strong>Quicket:</strong> we use Quicket&apos;s public API to list public events near Durban, linking back to
          Quicket for tickets.
        </li>
        <li>Event posters and captions may be sent to Google&apos;s Gemini AI service to extract event details.</li>
      </ul>

      <h2>4. Administrators</h2>
      <p>Our moderators sign in with an email and password, stored by our database provider (Supabase).</p>

      <h2>5. Who processes data for us</h2>
      <p>
        Vercel (website hosting), Supabase (database and image storage), Google (Gemini AI), Quicket (event listings) and OpenStreetMap (maps). Some of these process data outside South Africa. We don&apos;t
        sell personal information or use it for advertising.
      </p>

      <h2>6. How long we keep data</h2>
      <p>
        Published events stay in our database as a record after they end (they&apos;re hidden from the site). Declined
        submissions are deleted within 24 hours and abuse-prevention IP records within 2 days. We remove anything on
        request, see below.
      </p>

      <h2>7. Your rights and removal requests</h2>
      <p>
        You can ask us what information we hold about you, ask us to correct it, or ask us to delete it. If you organise
        an event that appears here and want it changed or removed, email us. See our{" "}
        <Link href="/data-deletion">data deletion instructions</Link>. You may also complain to South Africa&apos;s
        Information Regulator.
      </p>

      <h2>8. Changes</h2>
      <p>We&apos;ll update this page if our practices change, with a new &quot;last updated&quot; date.</p>
    </LegalPage>
  );
}
