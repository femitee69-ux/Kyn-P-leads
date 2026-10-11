import type { Metadata } from 'next'
import { LegalShell, Section, Bullets } from '@/components/kynp/legal-shell'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    "Kyn'P Leads Terms of Service — the rules and conditions for using the Kyn'P Leads lead-generation and outreach automation platform.",
  alternates: { canonical: 'https://kynpleads.app/terms' },
  robots: { index: true, follow: true },
}

export default function TermsPage() {
  return (
    <LegalShell
      eyebrow="Legal"
      title="Terms of Service"
      effectiveDate="October 11, 2026"
    >
      <p>
        Welcome to Kyn&rsquo;P Leads. These Terms of Service (&ldquo;Terms&rdquo;) govern your access
        to and use of the Kyn&rsquo;P Leads web application, located at kynpleads.app and any
        subdomain operated by Kyn&rsquo;P Leads (the &ldquo;Service&rdquo;). By creating an account
        or using the Service, you agree to be bound by these Terms in full. If you do not agree to
        these Terms, you must not access or use the Service.
      </p>
      <p>
        These Terms are a legally binding contract between you (&ldquo;you&rdquo;,
        &ldquo;User&rdquo;) and Kyn&rsquo;P Leads (&ldquo;Kyn&rsquo;P&rdquo;,
        &ldquo;we&rdquo;, &ldquo;us&rdquo;). If you are using the Service on behalf of an employer or
        another entity, you represent that you have authority to bind that entity to these Terms,
        and the words &ldquo;you&rdquo; and &ldquo;User&rdquo; will refer to that entity.
      </p>

      <Section title="1. Description of Service">
        <p>
          Kyn&rsquo;P Leads is a multi-tenant, web-based platform that helps users find
          prospective business contacts (&ldquo;leads&rdquo;) in a target country, compose
          personalized outreach messages using artificial intelligence, and dispatch those
          messages on a 30-second cadence through up to five (5) Gmail accounts the user has
          linked to the Service. The Service also includes optional follow-up automation that
          sends a second message to a lead twenty-four (24) hours after the initial message if
          no reply has been received.
        </p>
        <p>
          The Service integrates with several third-party providers to perform its functions,
          including Serper.dev (lead discovery via Google Search), OpenAI or alternative large
          language model providers (message composition), and Google (Gmail OAuth for email
          sending). These integrations are optional and Users may use the Service without
          configuring all of them.
        </p>
      </Section>

      <Section title="2. Account Registration and Security">
        <p>
          You must create an account to use the Service. Account registration requires a valid
          email address and a password of at least eight (8) characters. You are responsible for
          maintaining the confidentiality of your account credentials and for all activity that
          occurs under your account. You agree to notify us immediately of any unauthorized use of
          your account or any other breach of security.
        </p>
        <p>
          You represent that all information you provide in connection with your account is
          accurate and complete. You may not create an account for someone else without their
          permission, and you may not use the Service under a false identity or on behalf of a
          person or entity that does not exist.
        </p>
        <Bullets items={[
          'You must be at least 18 years old, or the age of majority in your jurisdiction, to use the Service.',
          'You may not create more than one account for the purpose of evading quota limits or bans.',
          'You are responsible for keeping your linked Gmail API tokens and any API keys stored in the Service confidential.',
        ]} />
      </Section>

      <Section title="3. Acceptable Use and Anti-Spam Compliance">
        <p>
          The Service is intended exclusively for outreach to recipients with whom you have a
          legitimate business basis to communicate. By using the Service, you represent and
          warrant that every lead you contact through Kyn&rsquo;P Leads has been identified
          through lawful means, that the recipient has a reasonable expectation of receiving your
          message, and that the content of your outreach is truthful, non-deceptive, and
          relevant to the recipient&rsquo;s business.
        </p>
        <p>
          You are solely responsible for compliance with all applicable anti-spam and
          electronic-communications laws, including without limitation the United States
          CAN-SPAM Act, the European Union General Data Protection Regulation (GDPR), the United
          Kingdom Privacy and Electronic Communications Regulations (PECR), Canada&rsquo;s
          Anti-Spam Legislation (CASL), and any equivalent laws in the recipient&rsquo;s
          jurisdiction.
        </p>
        <p>You specifically agree that you will NOT:</p>
        <Bullets items={[
          'Use the Service to send unsolicited commercial email (UCE) or unsolicited bulk email (UBE) to recipients who have not consented or with whom you do not have an existing business relationship.',
          'Send content that is illegal, deceptive, fraudulent, harassing, defamatory, pornographic, or that infringes the intellectual-property rights of any third party.',
          'Use the Service to distribute malware, phishing attempts, or any form of malicious payload.',
          'Disguise the origin of your messages or use misleading subject lines or sender identities.',
          'Use a Gmail account you do not own or have not been authorized to use for sending through the Service.',
          'Attempt to exceed Gmail&rsquo;s daily sending limits or to circumvent rate limits imposed by Google.',
          'Use the Service to contact minors or to target protected classes in violation of applicable law.',
        ]} />
        <p>
          We reserve the right, in our sole discretion, to suspend or terminate any account that
          we believe has violated this Section, with or without notice and with no refund of any
          unused credits (if applicable).
        </p>
      </Section>

      <Section title="4. Prohibited Activities">
        <p>In addition to the restrictions in Section 3, you agree not to:</p>
        <Bullets items={[
          'Reverse-engineer, decompile, or disassemble any part of the Service.',
          'Access, tamper with, or use non-public areas of the Service, our servers, or our databases.',
          'Attempt to overwhelm, crash, or disable the Service through high-volume requests or other attack vectors.',
          'Scrape, mine, or harvest data about other users of the Service.',
          'Use the Service in a manner that could reasonably be expected to damage, disable, overburden, or impair the Service.',
          'Use the Service in violation of any applicable law, regulation, or third-party agreement.',
        ]} />
      </Section>

      <Section title="5. Third-Party Services">
        <p>
          The Service integrates with several third-party providers, including Google (Gmail OAuth
          and the Gmail API), Serper.dev (lead discovery), and large language model providers
          such as OpenAI. Your use of these third-party services is also governed by their
          respective terms of service and privacy policies, which we encourage you to review.
        </p>
        <p>
          Kyn&rsquo;P is not responsible for the acts or omissions of these third-party providers,
          including any suspension of your Google account, throttling of your Gmail send quota,
          depletion of your Serper.dev credits, or charges imposed by your LLM provider. Where
          required, you grant Kyn&rsquo;P Leads a limited right to access, store, and use the
          credentials you provide solely for the purpose of operating the Service on your behalf.
        </p>
      </Section>

      <Section title="6. User Content and Outreach Material">
        <p>
          You retain all right, title, and interest in the lead lists, brand information, service
          descriptions, and outreach messages you submit to or generate through the Service
          (collectively, &ldquo;User Content&rdquo;). By submitting User Content to the Service,
          you grant Kyn&rsquo;P Leads a non-exclusive, worldwide, royalty-free, sublicensable
          license to host, store, process, and transmit your User Content solely for the purpose
          of providing the Service to you.
        </p>
        <p>
          You represent and warrant that you own all rights in your User Content or have obtained
          all necessary permissions to use it through the Service. You are solely responsible for
          the content of every email sent through the Service, including its accuracy, legality,
          and compliance with applicable laws and third-party rights.
        </p>
      </Section>

      <Section title="7. Intellectual Property">
        <p>
          The Service, including its design, source code, user interface, brand assets, and
          documentation, is the intellectual property of Kyn&rsquo;P Leads and is protected by
          applicable copyright, trademark, and other laws. These Terms do not grant you any
          right to use the Kyn&rsquo;P Leads name, logo, or other brand identifiers except as
          expressly set out herein.
        </p>
        <p>
          You may not copy, redistribute, or create derivative works of the Service without our
          prior written consent. The Kyn&rsquo;P Leads name, the yellow-and-black speech-bubble
          logo, and the slogans &ldquo;Find. Compose. Send. Follow up.&rdquo; and &ldquo;Kyn&rsquo;P
          Leads&rdquo; are our trademarks.
        </p>
      </Section>

      <Section title="8. Free Tier and Future Paid Plans">
        <p>
          During the current launch phase, the Service is offered at no cost. We may, at our
          discretion, introduce paid plans, subscription tiers, or usage-based pricing in the
          future. If we introduce paid features, we will provide at least thirty (30) days&rsquo;
          advance notice before changes take effect for existing accounts, and you will have the
          opportunity to discontinue use of the paid features before any charges are applied.
        </p>
        <p>
          The Service&rsquo;s functionality is also subject to the rate limits, credit
          allowances, and terms of your third-party providers (e.g., Serper.dev, OpenAI, Gmail).
          We are not responsible for any charges those providers may impose on you.
        </p>
      </Section>

      <Section title="9. Disclaimers">
        <p>
          THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo;, WITHOUT
          WARRANTY OF ANY KIND, EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE
          UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS. WE DO NOT WARRANT THAT EMAILS
          SENT THROUGH THE SERVICE WILL BE DELIVERED, OPENED, OR READ BY RECIPIENTS, NOR THAT
          THEY WILL AVOID SPAM CLASSIFICATION.
        </p>
        <p>
          YOU USE THE SERVICE AT YOUR OWN RISK. ANY OUTREACH RESULTS, REPLY RATES, OR BUSINESS
          OUTCOMES DEPEND ON FACTORS OUTSIDE OUR CONTROL, INCLUDING THE QUALITY OF YOUR OFFER,
          THE WARMTH OF YOUR LEADS, AND THE DELIVERABILITY REPUTATION OF YOUR GMAIL ACCOUNTS.
        </p>
      </Section>

      <Section title="10. Limitation of Liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, KYN&rsquo;P LEADS AND ITS
          AFFILIATES, OFFICERS, EMPLOYEES, AND SUPPLIERS SHALL NOT BE LIABLE FOR ANY INDIRECT,
          INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS,
          BUSINESS, GOODWILL, DATA, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR IN CONNECTION
          WITH YOUR ACCESS TO OR USE OF (OR INABILITY TO ACCESS OR USE) THE SERVICE.
        </p>
        <p>
          THE AGGREGATE LIABILITY OF KYN&rsquo;P LEADS FOR ANY CLAIM ARISING OUT OF OR RELATED TO
          THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE AMOUNT YOU HAVE PAID TO KYN&rsquo;P
          LEADS IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR ONE HUNDRED U.S. DOLLARS
          ($100.00), WHICHEVER IS GREATER. IF YOU HAVE NOT PAID ANYTHING TO KYN&rsquo;P LEADS, OUR
          TOTAL LIABILITY IS LIMITED TO ONE HUNDRED U.S. DOLLARS ($100.00).
        </p>
      </Section>

      <Section title="11. Indemnification">
        <p>
          You agree to indemnify, defend, and hold harmless Kyn&rsquo;P Leads and its affiliates,
          officers, employees, and suppliers from any claim, demand, action, loss, or damage
          (including reasonable attorneys&rsquo; fees) arising out of or related to: (a) your
          User Content; (b) your use of the Service; (c) your violation of these Terms; or (d)
          your violation of any law or the rights of any third party, including recipients of
          your outreach.
        </p>
      </Section>

      <Section title="12. Termination">
        <p>
          You may delete your account at any time by signing in and using the account-deletion
          option in the workspace menu. Upon account deletion, we will remove your personal
          information, API keys, Gmail OAuth tokens, and lead data from our active systems within
          thirty (30) days, except where retention is required by law.
        </p>
        <p>
          We may suspend or terminate your access to the Service at any time, with or without
          cause, and with or without notice. Upon termination, all licenses granted to you under
          these Terms will immediately cease. Sections of these Terms that by their nature should
          survive termination — including ownership, warranty disclaimers, indemnification, and
          limitation of liability — will continue in effect.
        </p>
      </Section>

      <Section title="13. Changes to These Terms">
        <p>
          We may update these Terms from time to time. When we do, we will revise the
          &ldquo;Last updated&rdquo; date at the top of this page. For material changes that
          affect your rights, we will provide at least thirty (30) days&rsquo; advance notice by
          email or in-app notification before the changes take effect.
        </p>
        <p>
          Your continued use of the Service after the effective date of any change constitutes
          your acceptance of the updated Terms. If you do not agree to the updated Terms, you
          must stop using the Service and request account deletion.
        </p>
      </Section>

      <Section title="14. Governing Law and Disputes">
        <p>
          These Terms shall be governed by and construed in accordance with the laws of the
          jurisdiction in which Kyn&rsquo;P Leads is registered, without regard to conflict of
          law principles. Any dispute arising out of or relating to these Terms or the Service
          shall be resolved exclusively in the courts of that jurisdiction, and you consent to
          personal jurisdiction and venue therein.
        </p>
        <p>
          Before initiating litigation, you agree to first attempt to resolve any dispute through
          good-faith negotiation by contacting us at the address listed in Section 15. If the
          dispute is not resolved within thirty (30) days, either party may proceed with formal
          proceedings.
        </p>
      </Section>

      <Section title="15. Contact Us">
        <p>
          If you have any questions, concerns, or notices relating to these Terms, you may
          contact us at:
        </p>
        <Bullets items={[
          'Email: support@kynpleads.app',
          'Subject line: “Terms of Service Inquiry”',
          'For legal notices (DMCA, data-protection requests): legal@kynpleads.app',
        ]} />
        <p>
          We aim to respond to all inquiries within three (3) business days.
        </p>
      </Section>

      <p className="text-xs text-muted-foreground pt-6">
        This Terms of Service document is provided for general informational purposes and does
        not constitute legal advice. We recommend that you consult a qualified attorney if you
        have specific concerns about your use of the Service.
      </p>
    </LegalShell>
  )
}
