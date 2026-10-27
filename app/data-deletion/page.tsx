import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { CONTACT_EMAIL } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Data Deletion | WhatsUpDurbs",
  description: "How to ask WhatsUpDurbs to delete your data or remove your events.",
};

export default function DataDeletionPage() {
  const subject = encodeURIComponent("Data deletion request");
  return (
    <LegalPage title="Data Deletion" updated="28 October 2026">
      <p>
        You can ask us to delete any information WhatsUpDurbs holds about you or your events at any time. Visitors
        don&apos;t need an account, and we don&apos;t use Facebook, Instagram or Google login.
      </p>

      <h2>How to request deletion</h2>
      <ol>
        <li>
          Email{" "}
          <a href={`mailto:${CONTACT_EMAIL}?subject=${subject}`}>{CONTACT_EMAIL}</a> with the subject
          &quot;Data deletion request&quot;.
        </li>
        <li>
          Tell us what to remove: for example a link to the event page, the event name and date, or the
          organiser or venue name if you&apos;d like all of your events removed.
        </li>
        <li>
          If you&apos;re asking about information that identifies you, we may ask you to confirm you&apos;re the account
          owner or organiser.
        </li>
      </ol>

      <h2>What happens next</h2>
      <ul>
        <li>We confirm your request within 7 days.</li>
        <li>
          We delete the event details, stored poster images and any records linked to you within 30 days.
        </li>
        <li>We email you when it&apos;s done.</li>
      </ul>

      <p>
        Some data is already removed automatically: declined submissions within 24 hours and abuse-prevention IP
        records within 2 days. See our <Link href="/privacy">privacy policy</Link> for details.
      </p>
    </LegalPage>
  );
}
