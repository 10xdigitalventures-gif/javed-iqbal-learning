import Link from "next/link";

export const metadata = {
  title: "Privacy Policy · Consult Hub",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-brand hover:underline">
        ← Back to home
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-slate-900">Privacy Policy</h1>
      <p className="mt-2 text-sm text-slate-500">
        Last updated: {new Date().getFullYear()}
      </p>

      <section className="prose prose-slate mt-8 space-y-6 text-slate-700">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Overview</h2>
          <p>
            Consult Hub (&quot;the platform&quot;) connects clients with
            consultants for paid messaging and live mentorship sessions. This
            policy explains what we collect, how we use it, and the rights you
            have over your data.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Information we collect
          </h2>
          <ul className="list-disc pl-6">
            <li>Account details: name, email, phone, and role.</li>
            <li>
              Communication content: text, audio, and video messages, and
              meeting metadata exchanged between clients and consultants.
            </li>
            <li>
              Billing data: package purchases and payment references processed
              through our payment provider (PayFast). We do not store full card
              numbers.
            </li>
            <li>Usage and activity logs used for security and support.</li>
          </ul>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-xl font-semibold text-amber-900">
            Administrator access to communications
          </h2>
          <p className="text-amber-900">
            To operate the platform, enforce package limits, resolve disputes,
            and comply with legal obligations, platform administrators may
            access records of communications between clients and consultants,
            including text, audio, and video messages and meeting details. We
            limit this access to authorized personnel and to the purposes
            described in this policy. By using the platform you acknowledge and
            consent to this administrative access.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            How we use your information
          </h2>
          <ul className="list-disc pl-6">
            <li>To deliver messaging, meetings, and community features.</li>
            <li>To process payments and apply package allowances.</li>
            <li>To send notifications by in-app message, email, and push.</li>
            <li>To protect the platform and investigate abuse.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Data retention &amp; security
          </h2>
          <p>
            Media is stored in access-controlled object storage and served
            through short-lived signed URLs. Data is encrypted in transit. We
            retain communication records for as long as your account is active
            or as required by law, after which it is deleted or anonymized.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-slate-900">Your rights</h2>
          <p>
            You may request access to, correction of, or deletion of your
            personal data by contacting your platform administrator. Some data
            may be retained where required for legal or accounting purposes.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-slate-900">Contact</h2>
          <p>
            Questions about this policy can be directed to the platform
            administrator at the email address shown in your workspace settings.
          </p>
        </div>
      </section>
    </main>
  );
}
