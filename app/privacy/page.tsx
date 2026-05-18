import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Hive",
  description: "How Hive collects, uses, and protects your data.",
};

const LAST_UPDATED = "May 18, 2026";
const APP_NAME = "Hive";
const DOMAIN = "hive.qurne.com";
const CONTACT_EMAIL = "bintangqurne07@gmail.com";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 text-sm leading-relaxed text-slate-700">
      <div className="mb-8">
        <Link href="/" className="text-indigo-600 hover:underline">
          ← Back to {APP_NAME}
        </Link>
      </div>

      <h1 className="mb-2 text-3xl font-bold text-slate-900">Privacy Policy</h1>
      <p className="mb-8 text-xs text-slate-500">Last updated: {LAST_UPDATED}</p>

      <Section title="1. Who We Are">
        <p>
          {APP_NAME} (<strong>{DOMAIN}</strong>) is a team scheduling and
          collaboration platform. By using our service you agree to this Privacy
          Policy. If you have questions, contact us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo-600 underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </Section>

      <Section title="2. Information We Collect">
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>
            <strong>Account information</strong> — name, email address, and
            profile picture obtained when you sign in with Google.
          </li>
          <li>
            <strong>Google Calendar data</strong> — we access your calendar
            events and free/busy information <em>only</em> to show scheduling
            availability inside the app. We do not store raw event content
            beyond what is needed to display your schedule.
          </li>
          <li>
            <strong>Usage data</strong> — tasks, meetings, files, and messages
            you create inside the platform.
          </li>
          <li>
            <strong>Device & log data</strong> — browser type, IP address, and
            error logs for security and debugging purposes.
          </li>
        </ul>
      </Section>

      <Section title="3. How We Use Your Data">
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>To provide, operate, and improve the {APP_NAME} service.</li>
          <li>
            To display your calendar availability to teammates when scheduling
            meetings (Free/Busy only — we never share your full event details
            with other users without your knowledge).
          </li>
          <li>
            To send deadline reminders and meeting notifications to your
            registered email address.
          </li>
          <li>To authenticate you securely via Google OAuth 2.0.</li>
        </ul>
        <p className="mt-3">
          We do <strong>not</strong> sell, rent, or share your personal data
          with third parties for advertising or marketing purposes.
        </p>
      </Section>

      <Section title="4. Google API Data — Limited Use Policy">
        <p>
          {APP_NAME}'s use of information received from Google APIs adheres to
          the{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noreferrer"
            className="text-indigo-600 underline"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>
            We use Google Calendar data only to display free/busy availability
            to help users schedule team meetings.
          </li>
          <li>
            We do not use Google user data to serve advertisements or for any
            purpose unrelated to scheduling features.
          </li>
          <li>
            We do not allow humans to read your Google data unless you
            explicitly share it, required for security, or required by law.
          </li>
          <li>
            We do not transfer Google user data to third parties except as
            necessary to provide our scheduling service.
          </li>
        </ul>
      </Section>

      <Section title="5. Data Storage & Security">
        <p>
          Your data is stored on AWS (Amazon Web Services) infrastructure in
          the ap-southeast-3 (Jakarta) region. We use industry-standard
          encryption in transit (HTTPS/TLS) and at rest (AWS-managed
          encryption). Access tokens for Google Calendar are stored encrypted
          and are only used server-side.
        </p>
      </Section>

      <Section title="6. Data Retention">
        <p>
          We retain your data for as long as your account is active. You may
          request deletion of your account and associated data at any time by
          contacting{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo-600 underline">
            {CONTACT_EMAIL}
          </a>
          . Deleted data is permanently removed within 30 days.
        </p>
      </Section>

      <Section title="7. Cookies">
        <p>
          We use a single session cookie (<code>auth_token</code>) to keep you
          signed in. We do not use tracking or advertising cookies.
        </p>
      </Section>

      <Section title="8. Your Rights">
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>Access the personal data we hold about you.</li>
          <li>Request correction of inaccurate data.</li>
          <li>Request deletion of your account and data.</li>
          <li>
            Revoke Google Calendar access at any time via{" "}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-600 underline"
            >
              Google Account Permissions
            </a>{" "}
            or through Settings inside {APP_NAME}.
          </li>
        </ul>
      </Section>

      <Section title="9. Children's Privacy">
        <p>
          {APP_NAME} is not directed at children under 13. We do not knowingly
          collect personal information from children.
        </p>
      </Section>

      <Section title="10. Changes to This Policy">
        <p>
          We may update this policy periodically. We will notify users of
          material changes via email or an in-app notice at least 7 days before
          the change takes effect.
        </p>
      </Section>

      <Section title="11. Contact">
        <p>
          For any privacy-related questions or requests:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo-600 underline">
            {CONTACT_EMAIL}
          </a>
        </p>
      </Section>

      <div className="mt-10 border-t border-slate-200 pt-6 text-xs text-slate-400">
        © {new Date().getFullYear()} {APP_NAME} · {DOMAIN}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-7">
      <h2 className="mb-2 text-base font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}
