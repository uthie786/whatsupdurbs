"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import Navbar from "@/components/Navbar";
import EventFormFields, {
  EMPTY_EVENT_FORM,
  buildEventInput,
  type EventFormState,
} from "@/components/EventForm";
import { isSupabaseConfigured, submitEvent } from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";

export default function SubmitPage() {
  const [form, setForm] = useState<EventFormState>(EMPTY_EVENT_FORM);
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const built = buildEventInput(form);
    if ("error" in built) {
      setError(built.error);
      return;
    }
    setStatus("submitting");
    try {
      await submitEvent(built.input);
      setStatus("done");
      setForm(EMPTY_EVENT_FORM);
    } catch (err) {
      setStatus("error");
      setError(errorMessage(err, "Something went wrong. Try again?"));
    }
  }

  return (
    <>
      <Navbar compact />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-8 space-y-3">
          <span className="brutal-badge bg-durbs-cyan">For organisers</span>
          <h1 className="font-display text-4xl uppercase leading-none sm:text-5xl">
            Put your event on the <span className="bg-durbs-yellow px-2">Durbs</span> map
          </h1>
          <p className="font-semibold">
            Free to list. Every submission is reviewed by our team before it goes live — usually
            within 24 hours.
          </p>
          {!isSupabaseConfigured && (
            <p className="border-3 border-black bg-durbs-purple px-3 py-2 text-sm font-bold text-white shadow-brutal">
              Demo mode: submissions are kept in memory for this session only (visit /admin to see
              them).
            </p>
          )}
        </div>

        {status === "done" ? (
          <div className="space-y-4 border-4 border-black bg-durbs-cyan p-8 text-center shadow-brutal-xl">
            <CheckCircle2 className="mx-auto h-12 w-12" strokeWidth={2.5} />
            <h2 className="font-display text-3xl uppercase">Lekker! Submitted.</h2>
            <p className="font-semibold">
              Your event is in the moderation queue. Once approved it&apos;ll show up on the map.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button type="button" onClick={() => setStatus("idle")} className="brutal-btn bg-white">
                Submit another
              </button>
              <Link href="/" className="brutal-btn bg-durbs-pink text-white">
                Back to events
              </Link>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-5 border-4 border-black bg-white p-6 shadow-brutal-xl"
          >
            <EventFormFields form={form} onChange={setForm} />

            {error && (
              <p role="alert" className="border-3 border-black bg-red-500 px-3 py-2 font-bold text-white">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={status === "submitting"}
              className="brutal-btn w-full bg-durbs-pink py-3 text-base text-white"
            >
              {status === "submitting" ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Sending…
                </>
              ) : (
                <>
                  Submit for review <Send className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        )}
      </main>
    </>
  );
}
