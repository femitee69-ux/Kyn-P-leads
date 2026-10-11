import type { Metadata } from 'next'
import { LegalShell, Section, Bullets } from '@/components/kynp/legal-shell'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    "Kyn'P Leads Privacy Policy — what personal data we collect, how we use it, who we share it with, and your rights under GDPR, CCPA, and other privacy laws.",
  alternates: { canonical: 'https://kynpleads.app/privacy' },
  robots: { index: true, follow: true },
}

export default function PrivacyPage() {
  return (
    <LegalShell
      eyebrow="Legal"
      title="Privacy Policy"
      effectiveDate="October 11, 2026"
    >
      <p>
        Kyn&rsquo;P Leads (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;Kyn&rsquo;P&rdquo;) is a
        multi-tenant lead-generation and outreach automation platform. We respect your privacy
        and are committed to protecting the personal data you share with us. This Privacy Policy
        explains what information we collect, how we use it, where it is stored, with whom we
        share it, and the rights you have over your data.
      </p>
      <p>
        This Policy applies to the Kyn&rsquo;P Leads web application (the &ldquo;Service&rdquo;)
        and any related communications. It does not apply to the third-party services the Service
        integrates with (Google, Serper.dev, OpenAI, etc.), each of which has its own privacy
        policy that you should review.
      </p>

      <Section title="1. Overview of Our Role">
        <p>
          Kyn&rsquo;P Leads acts as both a <strong>data controller</strong> and a{' '}
          <strong>data processor</strong> depending on the data category. We are the controller
          for the personal data you provide to operate your account (email, password,
          authentication data). We are the processor for the lead lists, brand information, and
          outreach messages you submit — you remain the controller of that User Content, and we
          process it solely to provide the Service to you.
        </p>
        <p>
          We do not sell your personal data to third parties. We do not use your personal data
          for cross-contextual behavioral advertising.
        </p>
      </Section>

      <Section title="2. Information We Collect">
        <p>
          We collect only the information needed to operate your account, generate leads on your
          behalf, send outreach through your Gmail accounts, and keep the Service secure.
        </p>
        <Bullets items={[
          <><strong>Account information:</strong> Your email address and a bcrypt-hashed password. We never see your password in plain text — only the one-way hash used to verify your sign-in.</>,
          <><strong>Display name:</strong> Optional. You can change or remove it at any time.</>,
          <><strong>API keys:</strong> Any API keys you choose to store in the Service (Serper.dev, OpenAI/LLM, SMTP). Keys are stored encrypted at rest and never shared between accounts.</>,
          <><strong>Gmail OAuth tokens:</strong> When you click &ldquo;Login Gmail&rdquo;, Google returns an access token and a refresh token that we store so we can send emails on your behalf. We only request the <code>gmail.send</code>, <code>userinfo.email</code>, and <code>openid</code> scopes — we cannot read your inbox.</>,
          <><strong>Lead and message data:</strong> Country, brand, service description, AI-generated prospect personas, email addresses, company names, positions, and the personalized outreach messages composed on your behalf.</>,
          <><strong>Campaign metadata:</strong> The country, brand, service, follow-up toggle, and timestamps for each campaign you run.</>,
          <><strong>Usage and security logs:</strong> Aggregated, non-identifying telemetry about how the Service is performing, plus short-lived access logs used for security and abuse prevention.</>,
        ]} />
      </Section>

      <Section title="3. How We Use Your Information">
        <p>We use the information we collect to:</p>
        <Bullets items={[
          'Operate your account, authenticate your sessions, and enforce multi-tenant isolation between users.',
          'Generate prospect leads and compose personalized outreach messages via the third-party services you have configured (Serper.dev, OpenAI, etc.).',
          'Dispatch outreach emails through your linked Gmail accounts on the 30-second cadence you initiate.',
          'Schedule and dispatch 24-hour follow-up messages when you have enabled the follow-up feature.',
          'Notify you when an API key has run out of credit or a Gmail link has expired.',
          'Investigate, prevent, and respond to fraud, abuse, or violations of our Terms of Service.',
          'Comply with our legal obligations, including responding to lawful requests from public authorities.',
        ]} />
        <p>
          We do not use your personal data to train machine-learning models. Any AI message
          composition is performed through your own configured LLM provider (e.g., OpenAI), under
          the terms of that provider.
        </p>
      </Section>

      <Section title="4. Data Storage and Security">
        <p>
          Account data, API keys, Gmail OAuth tokens, leads, and messages are stored in a
          relational database (SQLite in development, Turso or another managed SQL database in
          production). The database is encrypted at rest. Each user&rsquo;s data is logically
          isolated through a unique <code>userId</code> foreign key on every row, and every API
          request is scoped to the authenticated user.
        </p>
        <p>
          Gmail OAuth refresh tokens are stored with the corresponding Gmail account record.
          Access tokens are refreshed automatically when they expire; we never expose OAuth
          tokens to other users or to the client side. API keys are masked when displayed in the
          user interface — only the first four and last four characters are shown.
        </p>
        <p>
          We use industry-standard transport-layer security (HTTPS / TLS) for all
          communications between your browser, our servers, and our integrated providers. We
          maintain access controls that limit internal access to your data to engineers
          investigating support tickets, with all access logged.
        </p>
        <p>
          No method of transmission or storage is 100% secure. While we work hard to protect
          your data, we cannot guarantee its absolute security. In the event of a confirmed
          data breach affecting your personal data, we will notify affected users within
          seventy-two (72) hours of becoming aware of the breach, consistent with our
          obligations under GDPR Article 33.
        </p>
      </Section>

      <Section title="5. Third-Party Services We Share Data With">
        <p>
          To operate the Service, we share the minimum data necessary with the following
          categories of third parties. Each provider processes data in accordance with their own
          privacy policy and the applicable terms of the integration.
        </p>
        <Bullets items={[
          <><strong>Google (Gmail API &amp; Google OAuth):</strong> When you initiate a send, we transmit the message body and recipient email to Google&rsquo;s Gmail API to send from your linked Gmail. We do not request, and do not have access to, your inbox contents — only the <code>gmail.send</code> scope is requested. Google&rsquo;s privacy policy: https://policies.google.com/privacy</>,
          <><strong>Serper.dev:</strong> If you configure a Serper.dev API key, we transmit your target country, brand, and service description to Serper.dev to discover real prospect websites via Google Search. Serper.dev&rsquo;s privacy policy: https://serper.dev/privacy</>,
          <><strong>Large language model providers (e.g., OpenAI, Groq):</strong> If you configure an LLM API key, we transmit your target country, brand, service description, and (optionally) the names of companies discovered by Serper.dev to the LLM provider to compose personalized outreach messages. The LLM provider&rsquo;s terms govern how that data is retained or used.</>,
          <><strong>Hosting provider:</strong> The Service runs on a cloud hosting provider (e.g., Vercel, Cloudflare) that processes IP addresses and request metadata for the purpose of delivering the Service. The hosting provider does not have access to the contents of your stored data.</>,
        ]} />
        <p>
          We do not share your personal data with advertising networks, data brokers, or social
          media platforms. We do not use cross-site tracking cookies.
        </p>
      </Section>

      <Section title="6. Cookies and Local Storage">
        <p>
          The Service uses local storage and cookies strictly for authentication and theme
          persistence. We do not use advertising cookies, analytics cookies, or third-party
          tracking cookies.
        </p>
        <Bullets items={[
          <><strong>Authentication cookies:</strong> Set by NextAuth.js to maintain your signed-in session. They are HttpOnly, Secure, and SameSite=Lax. They expire after 30 days of inactivity.</>,
          <><strong>Theme preference:</strong> Stored in local storage to remember your choice of light or dark theme across sessions.</>,
          <><strong>OAuth state parameter:</strong> A short-lived (10-minute) encoded value used to prevent CSRF attacks during the Gmail OAuth flow. It is not persistent.</>,
        ]} />
        <p>
          You can clear all cookies and local storage at any time via your browser settings.
          Note that clearing authentication cookies will sign you out.
        </p>
      </Section>

      <Section title="7. Data Retention">
        <p>
          We retain your personal data for as long as your account is active, plus a short grace
          period to allow for recovery in case of accidental deletion. Specifically:
        </p>
        <Bullets items={[
          'Account information, API keys, Gmail OAuth tokens, leads, and messages: retained until you request account deletion. After deletion, we remove this data from active systems within 30 days and from backups within 90 days.',
          'Aggregated, anonymized usage telemetry: retained for up to 24 months.',
          'Security and access logs: retained for up to 12 months, after which they are automatically purged.',
        ]} />
        <p>
          If you initiate a campaign and then delete your account, the leads and messages
          generated for that campaign are also deleted. We do not retain copies of your outreach
          messages beyond what is necessary to provide the Service to you.
        </p>
      </Section>

      <Section title="8. Your Rights — European Union (GDPR) and United Kingdom (UK GDPR)">
        <p>
          If you are located in the European Economic Area, the United Kingdom, or Switzerland,
          you have the following rights under the GDPR:
        </p>
        <Bullets items={[
          'Right of access: You may request a copy of the personal data we hold about you.',
          'Right to rectification: You may request correction of inaccurate or incomplete personal data.',
          'Right to erasure (&ldquo;right to be forgotten&rdquo;): You may request deletion of your personal data, subject to limited exceptions (e.g., legal retention requirements).',
          'Right to restrict processing: You may request that we limit our processing of your data in certain circumstances, such as while a rectification request is being evaluated.',
          'Right to data portability: You may request an export of your personal data in a structured, machine-readable format.',
          'Right to object: You may object to processing based on legitimate interests or to processing for direct marketing.',
          'Right to withdraw consent: For processing that relies on consent (e.g., Gmail OAuth), you may withdraw consent at any time without affecting the lawfulness of processing before withdrawal.',
          'Right to lodge a complaint: You may lodge a complaint with your local supervisory authority. We encourage you to contact us first at privacy@kynpleads.app so we can attempt to resolve the issue.',
        ]} />
        <p>
          To exercise any of these rights, email us at <code>privacy@kynpleads.app</code> from the
          email address associated with your account. We will verify your identity before
          processing your request and respond within thirty (30) days, or as required by
          applicable law.
        </p>
      </Section>

      <Section title="9. Your Rights — California (CCPA/CPRA)">
        <p>
          If you are a California resident, you have the following rights under the California
          Consumer Privacy Act (as amended by the California Privacy Rights Act):
        </p>
        <Bullets items={[
          'Right to know: The categories of personal information we collect, the sources, the business purpose for collecting it, and the third parties with whom we share it.',
          'Right to access: A copy of the specific pieces of personal information we have collected about you in the last 12 months.',
          'Right to delete: You may request that we delete your personal information, subject to limited exceptions.',
          'Right to correct: You may request that we correct inaccurate personal information.',
          'Right to opt-out of sale or sharing: We do not sell your personal information, and we do not share it for cross-context behavioral advertising. No opt-out is necessary.',
          'Right to limit the use of sensitive personal information: We limit our use of sensitive personal information (such as account credentials) to providing the Service to you.',
          'Right to non-discrimination: We will not discriminate against you for exercising any of these rights.',
        ]} />
        <p>
          To exercise these rights, submit a request to <code>privacy@kynpleads.app</code>. We
          will verify your identity and respond within forty-five (45) days, or as required by
          California law.
        </p>
      </Section>

      <Section title="10. International Transfers">
        <p>
          Your personal data may be processed in countries other than your own, including the
          United States (where Google, Serper.dev, OpenAI, and most cloud providers are based)
          and any country where our hosting provider operates. When we transfer personal data
          outside the European Economic Area, we rely on appropriate safeguards such as Standard
          Contractual Clauses adopted by the European Commission, or another lawful transfer
          mechanism under applicable data protection law.
        </p>
        <p>
          If you would like a copy of the safeguards we rely on for international transfers,
          email <code>privacy@kynpleads.app</code>.
        </p>
      </Section>

      <Section title="11. Children&rsquo;s Privacy">
        <p>
          The Service is not directed to children under the age of 16 (or the age of majority in
          your jurisdiction, if higher). We do not knowingly collect personal information from
          children. If you believe we have collected personal information from a child, please
          contact us at <code>privacy@kynpleads.app</code> and we will promptly delete it.
        </p>
      </Section>

      <Section title="12. Changes to This Privacy Policy">
        <p>
          We may update this Privacy Policy from time to time to reflect changes in our
          practices, legal obligations, or the features of the Service. When we do, we will revise
          the &ldquo;Last updated&rdquo; date at the top of this page.
        </p>
        <p>
          For material changes that affect your rights, we will provide at least thirty (30)
          days&rsquo; advance notice by email or in-app notification before the changes take
          effect. Your continued use of the Service after the effective date of any change
          constitutes your acceptance of the updated Privacy Policy.
        </p>
      </Section>

      <Section title="13. Contact">
        <p>
          If you have any questions, requests, or concerns about this Privacy Policy or your
          personal data, please contact us:
        </p>
        <Bullets items={[
          'Email: privacy@kynpleads.app',
          'General support: support@kynpleads.app',
          'For legal notices (DMCA, data-protection requests): legal@kynpleads.app',
        ]} />
        <p>
          We aim to respond to all privacy inquiries within three (3) business days.
        </p>
      </Section>

      <p className="text-xs text-muted-foreground pt-6">
        This Privacy Policy is provided for general informational purposes and does not
        constitute legal advice. We recommend that you consult a qualified privacy professional
        or attorney if you have specific concerns about your data.
      </p>
    </LegalShell>
  )
}
