/** Chamfer i18n: EN (translated from the canonical RU content). */
export const en = {
  app: { subtitle: 'Letters to German authorities: DIN 5008 format, the recipient and how to file.' },

  steps: {
    label: 'Steps',
    place: 'City',
    triage: 'Situation',
    letter: 'Letter',
    faq: 'FAQ',
  },

  common: {
    downloadFailed: '{{format}} download failed. Try the download again, or copy the text.',
    back: 'Back',
    next: 'Continue',
    change: 'Change',
    edit: 'Edit',
    optional: 'optional',
    copy: 'Copy text',
    copied: 'Copied',
    downloadPdf: 'Download PDF (DIN 5008)',
    downloadDocx: 'Download DOCX (template)',
    pdfFailed:
      'PDF service currently unavailable. Copy the text or use e-mail.',
    openMail: 'Open in mail app',
    mailtoTooLong:
      'The letter text is long, so it was copied to the clipboard. Paste it into the e-mail manually.',
  },

  place: {
    plzMismatch: 'This postal code does not match the selected municipality. Check your code or change the municipality.',
    title: 'Where do you live?',
    hint:
      'From your city or municipality, we determine the competent authorities and court using official data (Taper). If several places share the name, the federal state in brackets tells them apart.',
    inputPlaceholder: 'e.g. Erding',
    noResults: 'Nothing found. Check the spelling (German name).',
    error: 'Data service unavailable. Please try again later.',
    didYouMean: 'Did you mean:',
    plzPrompt: 'Your postal code (PLZ)',
    plzWhy:
      'The postal code is needed for exact court assignment and the letter head.',
    skipLink: 'City not found? Skip this step',
    skipTitle: 'Why are you skipping?',
    skipNote:
      'Without a city we cannot determine the authority automatically: you will enter the recipient address manually, and the remedy path is shown conservatively (both variants).',
    skipReason: {
      not_found: 'My city does not come up in the search',
      abroad: 'I am currently outside Germany',
      other: 'Other reason / just looking',
    },
  },

  tree: {
    title: 'Your situation',
    hint:
      'A few questions, then we show the right steps and letters. General information, not legal advice.',
    lettersTitle: 'Recommended letters',
    yes: 'Yes',
    no: 'No',
    bescheidBelehrung: 'What appeal instructions does the decision contain?',
    'belehrung.yes': 'Complete and correct instructions',
    'belehrung.missing': 'Instructions missing or incorrect',
    'belehrung.unknown': 'I cannot tell',
    benefitsRegime: 'Who pays your benefits?',
    'regime.sozialamt': 'Sozialamt (AsylbLG)',
    'regime.jobcenter': 'Jobcenter (Grundsicherungsgeld, formerly Bürgergeld)',
    'regime.unknown': 'I don’t know',
    'scenario.unsure': 'Not sure / different constellation',
    'mahnung.unreachable': 'The authority does not respond at all / no access',
    rootArea: 'Which area of law concerns you?',
    'area.aufenthalt': 'Residence / temporary protection / asylum (AufenthG, AsylG)',
    'area.social': 'Benefits and social law (AsylbLG, SGB II)',
    'area.data': 'Data and file access (DSGVO, Akteneinsicht)',
    'area.other': 'Something else / browse all letters',
    dataKind: 'Whose file is it about?',
    'data.bamf': 'My file at the BAMF (asylum)',
    'data.other': 'A file at another authority (ABH, Sozialamt etc.)',
    root: 'What are you facing?',
    'root.waiting': 'I applied for § 24 and am waiting for a decision',
    'root.oralRefusal': 'Oral refusal / they will not accept my application',
    'root.writtenBescheid': 'I received a written rejection (Bescheid)',
    'root.duldungVerzicht': 'I signed a waiver of § 24 / I have a Duldung',
    'root.noEat': 'Decision issued, but no eAT card',
    'root.complaint': 'I want to complain about the authority (supervisory complaint)',
    'root.benefits': 'Benefits / translation costs',
    waitingFiktion: 'Do you have a valid Fiktionsbescheinigung?',
    waiting3Months: 'Have more than 3 months passed since you applied?',
    waitingMahnung:
      'Have you already sent a written reminder with a deadline (Mahnung)?',
    'mahnung.notSent': 'Not yet',
    'mahnung.sentExpired': 'Yes, the deadline passed with no answer',
    'mahnung.sentWaiting': 'Yes, the deadline is still running',
    out: {
      fiktion:
        'First step: get the Fiktionsbescheinigung. You have an unconditional right to it (§ 81 Abs. 5 AufenthG), and it solves most practical problems (work, benefits, housing). You can request the case status in parallel.',
      status:
        'The authority needs time to decide. A polite status inquiry (Sachstandsanfrage) asking which documents are missing is the right move now.',
      mahnung:
        'Next stage: the formal reminder with a deadline (Erinnerung und Fristsetzung). It is the mandatory step before complaints and a lawsuit, and it documents your diligence.',
      waitMahnung:
        'Wait until the deadline in your reminder expires. If no answer comes, return here: next are the supervisory complaint and/or the lawsuit. Keep every proof of dispatch.',
      escalate:
        'Your reminder deadline expired without an answer. Now appropriate: the free supervisory complaint (Fachaufsichtsbeschwerde) and, if the § 75 VwGO conditions are met, the Untätigkeitsklage at the administrative court.',
      oral:
        'An oral refusal or a refusal to accept your application does not bind you, but it must be put in writing. Demand a written Bescheid with reasons and a Rechtsbehelfsbelehrung.',
      bescheid:
        'An appeal deadline is running. What to do depends on your federal state; see the block below. With a written rejection we strongly recommend counseling.',
      reapply:
        'Re-applying is possible, but the outcome depends heavily on your exact constellation. Pick your scenario in the letter form and read the warning carefully.',
      eat:
        'The eAT card is the standard form of the title (§ 78 AufenthG). If you only got a sticker or paper, request the eAT in writing.',
      translation:
        'Costs of necessary translations can be covered: under AsylbLG as “other benefits” (§ 6 Abs. 1), under SGB II as Mehrbedarf (§ 21 Abs. 6).',
      aufsicht:
        'The Fachaufsichtsbeschwerde is free and has no deadline. It often speeds things up. State the facts (dates, dispatches, silence); the supervisory body must review and respond.',
      dsgvoBamf:
        'You can request a copy of your BAMF file under Art. 15 DSGVO: free, answered within a month (Art. 12 Abs. 3 DSGVO). Useful before the interview and after an Außenstelle change.',
      dsgvoOther:
        'From any authority you can cumulatively request file access (VwVfG) and a copy of your data (Art. 15 DSGVO), asking for partial access instead of a full refusal. Lawyer-vetted template.',
      browse:
        'The full catalog below is grouped by situation. If nothing fits, start with data access or counseling.',
      counselTitle:
        'You hold a valid protection status in another EU state. Per the BMI guidance and recital 4 of Decision (EU) 2025/1460 the authority will most likely refuse; whether this exclusion binds under EU law is open (C-753/23). We deliberately do not generate an application for this constellation: counseling/lawyer first.',
      counselRenounced:
        'Courts may treat a formal renunciation of a protection status in another EU state as an abuse of rights (BayVGH 19 ZB 25.898). We deliberately do not generate an application for this constellation: lawyer only.',
    },
  },

  notes: {
    regimeHowTell:
      'How to tell: benefit letters from the Jobcenter mention Grundsicherungsgeld (formerly Bürgergeld)/SGB II, from the Sozialamt the AsylbLG. The template adapts after your pick in the form.',
    channel:
      'Legally safest: fax (keep the transmission report) or tracked letter (Einschreiben). E-mail only as an additional notice.',
    document:
      'Document everything: copies, dates, proofs of dispatch. These become your evidence if the case reaches court.',
    lawsuitLast:
      'A lawsuit is the last step. Try the supervisory complaint first: it is free and often unblocks things.',
    witness:
      'If possible, visit the authority with a witness and note the date, time and the clerk’s name.',
    deadlineOneMonth:
      'Standard deadline: 1 month from receipt of the Bescheid (12 months if the Rechtsbehelfsbelehrung was missing or wrong). Do not delay.',
    scenarioMatters:
      'The scenarios differ a lot legally, from “case law on your side” to “high risk of rejection”. Your choice activates the right arguments and warnings.',
    rechtskreiswechsel:
      'Note: a bill in the Bundestag moves part of the recipients from Grundsicherung (Jobcenter) to AsylbLG (Sozialamt); the criterion is the first issuance of the § 24 title or Fiktion after 31.03.2025. Check the current status.',
    counseling:
      'We recommend counseling: your state’s Flüchtlingsrat, Caritas, Diakonie or a lawyer. Letters from this module prepare counseling; they do not replace it.',
  },

  urgency: {
    deadline: 'Deadline running',
    high: 'Action needed',
    normal: 'Regular course',
  },

  remedies: {
    title: 'Remedy path: {{land}}',
    directKlage:
      'In your state there is no Widerspruch in residence-law matters: the rejection is challenged directly by lawsuit (Klage) at the Verwaltungsgericht, within {{klageMonths}} month of receipt ({{wrongMonths}} months if the Rechtsbehelfsbelehrung was missing or wrong).',
    widerspruch:
      'In your state a Widerspruch comes first, within 1 month of receiving the Bescheid. If it is rejected, a lawsuit follows within {{klageMonths}} month.',
    double:
      'For your state we cannot yet reliably confirm whether a Widerspruch exists in residence-law matters. Safe strategy: file a Widerspruch within the month AND clarify the path in counseling. The key is not to miss the month.',
    verifyFlag:
      'This state’s entry is not yet lawyer-confirmed. Double-check the remedy path.',
    by:
      'In Bavaria residence-law appeals go straight to the Verwaltungsgericht: the optional Widerspruch (Art. 15 AGVwGO) does not cover immigration law.',
  },

  recipient: {
    title: 'Recipient',
    loading: 'Determining the competent authority…',
    error:
      'Could not determine the authority. Try again later, or check the city and postal code.',
    pickOrt: 'Your postal code covers several places. Pick yours:',
    pickOffice: 'Select the responsible office:',
    pickKind: 'Which authority should receive the request?',
    'kind.abh': 'Ausländerbehörde (immigration)',
    'kind.sozialamt': 'Sozialamt / AsylbLG authority',
    supervisoryTitle: 'Supervisory authority (for escalation)',
    supervisoryNote:
      'The Fachaufsichtsbeschwerde goes here when the authority does not respond.',
    edit: 'Edit recipient',
    incompletePostal: 'The directory has no complete mailing address for this office. Enter its postal address for the letter.',
    completePostal: 'Add mailing address',
    confirmRegime: 'Confirm the name and address of the office responsible for {{regime}}.',
    enterManually: 'Enter the recipient manually',
    manualTitle: 'Recipient (manual)',
    manualName: 'Name of the authority / court',
    manualAddress: 'Address (one line per entry)',
    manualFax: 'Fax',
    manualNote:
      'Verify the address on the official website. A wrong addressee can cost you the deadline.',
    manualEntered: 'Address entered manually. Double-check before sending.',
    provenance: 'Source: {{source}} · data as of {{date}} · Taper',
  },

  channels: {
    notice:
      'Legally safest: fax (with transmission report) or a tracked letter. Send e-mail in addition, not instead. For deadlines, provable receipt (Zugang) is what counts.',
    preferred: 'preferred',
    supplementary: 'supplementary',
    fax: 'Fax',
    email: 'E-mail',
    emailNote:
      'E-mail is the supplementary channel. For anything deadline-relevant, send a fax or Einschreiben.',
  },

  gate: {
    regimeRequired: 'Choose the benefit shown in your benefits decision. This determines the legal basis and the recipient.',
    confirmTitle: 'Confirm before continuing',
    confirm: {
      application_provable:
        'My application was filed in writing and I can prove it (copy, receipt, fax report).',
      mahnung_sent_expired:
        'I sent a written reminder with a deadline, and it expired without an answer.',
      has_basic_evidence:
        'I have at least basic evidence of my stay in Ukraine / the protection prerequisites (passport stamps, certificates, tickets, documents).',
      counseling_sought:
        'I have sought or plan to seek counseling (Flüchtlingsrat, Caritas, Diakonie, lawyer).',
      contested_law_understood:
        'I understand that courts decide such situations differently and the outcome is not guaranteed.',
    },
    date: {
      required: 'Enter the date first. Without it the conditions cannot be checked.',
      approx:
        'Only the month is given: deadlines are counted conservatively from the end of that month. Enter the exact date once you recall it.',
    },
    minWait:
      '{{elapsed}} of the required {{months}} months have passed (§ 75 VwGO). A lawsuit now is premature: it can damage your case and create costs.',
    remedy: {
      absent:
        'In {{land}} there is no Widerspruch in residence-law matters, so this template does not apply. The path: direct lawsuit (Klage) at the Verwaltungsgericht within 1 month. Seek counseling without delay.',
      verify:
        'For {{land}} the Widerspruch path is not confirmed. Safe: file the Widerspruch AND clarify the path in counseling in parallel, all within the month.',
    },
    deadline: {
      unknownInstruction: 'The status of the appeal instructions is unclear. Check the remedy, where to file, the location of the authority and the time limit. The ordinary one-month period may already be running.',
      unknownNotification: 'The deadline cannot be calculated without a known date of notification. Check your proof of service.',
      unknownCalendar: 'Check the deadline at the location of the receiving authority. The holiday calendar for this locality or year cannot be determined here.',
      invalidNotification: 'Check the notification date. It cannot precede the printed decision date or be in the future.',
      passed: 'The calculated period ended on {{deadline}}. Check the dates and promptly seek advice on exceptions or reinstatement.',
      oneMonth: 'Deadline {{deadline}} (one month from notification). The authority must receive the objection in time.',
      yearRule: 'For the missing or incorrect instructions you indicated, the ordinary one-year period ends on {{deadline}} (§ 58(2) VwGO).',
    },
    mahnung: {
      notExpired:
        'The deadline from your reminder has not expired yet. Wait for it to pass. A premature lawsuit harms your case.',
    },
    scenario: {
      required:
        'Pick your scenario above. It determines the letter’s arguments and whether the template applies at all.',
      titleElsewhere:
        'You hold a valid protection status in another EU state. For applications after 13.08.2025 the authority, relying on the BMI guidance and recital 4 of Decision (EU) 2025/1460, will most likely refuse. The exclusion sits in a recital, not in the operative articles; whether it binds under EU law has not been finally settled by the courts (C-753/23). The template does not apply: lawyer/counseling first.',
      renounced:
        'Courts may treat a formal renunciation of a protection status in another EU state as an abuse of rights (BayVGH 19 ZB 25.898). Do not file without a lawyer.',
    },
  },

  profile: {
    title: 'Your details',
    name: 'First name',
    surname: 'Last name',
    dob: 'Date of birth',
    street: 'Street, house number',
    plzCity: 'Postal code, city',
    coTitle: 'Co-applicants (family)',
    coAdd: 'Add a person',
    coRemove: 'Remove',
    coName: 'First and last name (Latin script)',
    coRelation: 'Relationship to you',
    relations: {
      partner: 'Partner',
      husband: 'Husband',
      wife: 'Wife',
      son: 'Son',
      daughter: 'Daughter',
      other: 'Family member',
    },
    latinWarn:
      'Please use Latin letters (as in your passport). Cyrillic characters were removed.',
    openPicker: 'Open calendar',
    invalidDate: 'Enter a valid date in DD.MM.YYYY format.',
    futureDate: 'The date of birth is in the future.',
    handFill: 'I will fill in my details by hand (on the printout)',
    handFillNote:
      'The letter will contain blank lines instead of your name and address. Fill them in by pen before sending and sign.',
  },

  letter: {
    allLetters: 'All letters',
    fieldsTitle: 'Letter details',
    previewButton: 'Show the letter',
    fillAll: 'Fill in the required fields (*)',
  },

  fields: {
    applicationDate: 'Application date',
    oralRefusalDate: 'Date of the oral refusal',
    mahnungDeadline: 'Deadline from the reminder',
    notificationDate: 'Date of notification',
    notificationDateHint: 'When were you formally notified of the decision? Leave this blank if the effective date is unclear.',
    bescheidDate: 'Bescheid date',
    aktenzeichen: 'File number (if known)',
    authorityLetterDate: 'Date of the authority’s letter',
    inquiryDate: 'Date of the status inquiry',
    fiktionExpiry: 'Fiktion expiry date',
    applicationDateHint: 'The day you filed the application (in person or by letter).',
    oralRefusalDateHint: 'When you were refused orally. Leave empty if you do not remember.',
    mahnungDeadlineHint: 'The deadline you set for the authority in your reminder.',
    bescheidDateHint: 'The date at the top of the written decision (Bescheid).',
    aktenzeichenHint: 'File number from the authority’s letters (Az./Gz.). Leave empty if none.',
    authorityLetterDateHint: 'Date of the authority letter you are responding to (in its letterhead).',
    inquiryDateHint: 'When you sent the status inquiry.',
    fiktionExpiryHint: 'The “gültig bis” date on your Fiktionsbescheinigung.',
    anlagen: 'Attachments (Anlagen)',
    anlagenPlaceholder: 'Kopie des Ausweisdokuments',
    anlagenHint:
      'One line per document. Keep it generic: “Kopie des Ausweisdokuments”, “Nachweise laut Text”. No unnecessary detail.',
    approxToggle: 'I only remember the month',
  },

  letters: {
    fiktion_demand: {
      title: 'Demand the Fiktionsbescheinigung',
      description:
        'Demand to issue or renew the certificate under § 81 Abs. 5 AufenthG. You have an unconditional right to it.',
    },
    decision_request: {
      title: 'Status inquiry (Sachstandsanfrage)',
      description:
        'A polite inquiry: what stage is the application at, which documents are missing.',
    },
    oral_refusal: {
      title: 'Demand a written decision',
      description:
        'Turns an oral refusal into a written one, with reasons and a Rechtsbehelfsbelehrung.',
    },
    eat_demand: {
      title: 'Request the eAT card',
      description:
        'Demand the electronic residence title (§ 78 AufenthG) if you only got a sticker.',
    },
    mahnung_fristsetzung: {
      title: 'Reminder with deadline (Mahnung)',
      description:
        'A formal reminder with a concrete deadline: the mandatory stage before escalation.',
    },
    new_application: {
      title: 'Re-application for § 24',
      description:
        'Re-filing after a rejection or Duldung, with arguments for your scenario. Requires preparation.',
    },
    translation_costs: {
      title: 'Translation costs',
      description:
        'Application to cover the costs of necessary translations (AsylbLG / SGB II).',
    },
    aufsichtsbeschwerde: {
      title: 'Supervisory complaint',
      description:
        'Fachaufsichtsbeschwerde to the supervisory authority: free, no deadline, often speeds things up.',
    },
    widerspruch_aufenthg: {
      title: 'Widerspruch against the Bescheid',
      description:
        'Administrative appeal against the rejection, where state law provides it. Deadline: 1 month.',
    },
    dsgvo_bamf: {
      title: 'File copy from the BAMF (Art. 15 DSGVO)',
      description:
        'Request a full copy of your BAMF file: free, PDF by e-mail. The address is prefilled.',
    },
    dsgvo_behoerde: {
      title: 'Akteneinsicht + DSGVO (any authority)',
      description:
        'Cumulative request: file access (VwVfG) + data copy (Art. 15 DSGVO), asking for redactions instead of refusal.',
    },
    untaetigkeitsklage: {
      title: 'Untätigkeitsklage (lawsuit)',
      description:
        'Lawsuit at the Verwaltungsgericht over inaction (§ 75 VwGO). The last step, only after exhausting the rest.',
    },
  },

  groups: {
    waiting: 'Waiting for a decision',
    refused: 'Rejection',
    documents: 'Documents',
    escalation: 'Escalation',
    data: 'Data and file',
  },

  q: {
    urgencyReason: 'Why is it urgent? (adds a paragraph to the letter)',
    'urgencyReason.none': 'Do not mention',
    'urgencyReason.job': 'Job at risk',
    'urgencyReason.benefits': 'Benefit problems',
    'urgencyReason.housing': 'Cannot rent housing',
    fiktionSituation: 'Status of the Fiktionsbescheinigung?',
    'fiktionSituation.never': 'Never issued',
    'fiktionSituation.expired': 'Issued, but expired',
    oralRefusalKind: 'What exactly happened?',
    'oralRefusalKind.refusedToAccept': 'They refused to accept the application',
    'oralRefusalKind.announcedRejection':
      'They said it will be rejected / refused orally',
    reapplyScenario: 'Your scenario',
    'reapplyScenario.germanVerzicht':
      'I signed a waiver of the German § 24 (e.g. at the ABH)',
    'reapplyScenario.thirdCountryStay':
      'Before Germany I lived in a third country or another EU state, but received no protection status there',
    'reapplyScenario.appliedElsewhere':
      'I applied in another EU state but received no title',
    'reapplyScenario.titleElsewhere':
      'I hold a valid protection status in another EU state',
    'reapplyScenario.renouncedElsewhere':
      'I formally renounced the status in another EU state',
    benefitRegime: 'Which benefits do you receive?',
    'benefitRegime.asylblg': 'AsylbLG (Sozialamt)',
    'benefitRegime.sgb2': 'Grundsicherungsgeld, formerly Bürgergeld (Jobcenter)',
    repeatRequest: 'I have requested the file before (repeat request)',
    priorInquirySent: 'I already sent a status inquiry (Sachstandsanfrage)',
    fiktionAlsoMissing: 'The Fiktionsbescheinigung is also missing',
    hadRechtsbehelfsbelehrung:
      'The Bescheid contained a Rechtsbehelfsbelehrung (appeal instruction)',
  },

  interstitials: {
    accept: 'Read and understood',
    reapplication_scenarios: {
      title: 'Read before filing',
      body:
        'Re-application is legally complex, and courts decide differently.\n\n' +
        '• Lived in a third country without obtaining status: case law is on your side, but the authority may still refuse. Be ready to appeal.\n' +
        '• Applied in another EU state without a title: does not exclude protection in Germany.\n' +
        '• Valid title in another EU state: after 13.08.2025 the authority will most likely refuse (BMI guidance; recital 4 of Decision (EU) 2025/1460); whether that binds under EU law is open (C-753/23). Litigate only with a lawyer.\n' +
        '• Formal renunciation of a status in another EU state: risk of an abuse-of-rights finding.\n' +
        '• Waiver of the German § 24: the outcome depends on the circumstances (written? translated? under pressure?); the waiver itself can be contested (Anfechtung, §§ 119, 123 BGB by analogy), but deadlines are tight and a lawyer is needed.\n\n' +
        'Collect documents about the circumstances and get counseling BEFORE filing. This letter is preparation, not a substitute.',
    },
    widerspruch_deadline: {
      title: 'Attention: deadline',
      body:
        'The Widerspruch must be filed within 1 month of receiving the Bescheid (12 months only if the Rechtsbehelfsbelehrung was missing or wrong). Send it so that receipt is provable: fax with report or Einschreiben. The reasoning can follow later. What matters is filing the Widerspruch itself in time.',
    },
    lawsuit_last_resort: {
      title: 'The lawsuit is the last step',
      body:
        'The Untätigkeitsklage is appropriate only if:\n' +
        '1. the application was filed in writing and provably;\n' +
        '2. you sent a reminder with a deadline, and it expired;\n' +
        '3. at least 3 months have passed since filing (§ 75 VwGO);\n' +
        '4. you have at least basic evidence on the merits.\n\n' +
        'A premature or unsubstantiated lawsuit harms your own case and can create costs. No lawyer is required at the VG first instance, but counseling is strongly recommended.',
    },
  },

  email: {
    title: 'E-mail (in addition to fax/post)',
    edit: 'Edit text',
    body: 'Message',
    reset: 'Restore generated draft',
    fullscreen: 'Full screen',
    exitFullscreen: 'Close full screen',
    fullscreenHint: 'Esc or swipe down to close',
    open: 'Other email app',
    from: 'From',
    fromAuto: 'filled automatically by your mail client',
    to: 'To',
    subject: 'Subject',
    gmail: 'Gmail',
  },

  toast: {
    copied: 'Copied to clipboard',
    copyFailed: 'Copy failed. Please select the text manually.',
  },

  send: {
    letter: {
      title: 'How to send',
      body:
        'Steps: 1) download the PDF/DOCX and print it; 2) sign by pen; 3) keep a copy/photo for yourself; 4) send by fax (online services: simple-fax.de, fax.de) and keep the transmission report, or send by Einschreiben at the post office and keep the receipt; 5) e-mail only as a duplicate.',
    },
    lawsuit: {
      title: 'How to file the lawsuit',
      body:
        'The lawsuit is filed with the Verwaltungsgericht in writing (post/fax) or recorded at the court’s Rechtsantragstelle. Attach copies. No lawyer is required at first instance (§ 67 VwGO).',
    },
  },

  preview: {

    title: 'Letter',
    faxToggle: 'Line “Per Fax vorab: {{fax}}” in the letterhead',
    disclaimer:
      'Created with Chamfer (SNTIQ). General information, not legal advice and no representation (kein Rechtsbeistand). Check all details before sending.',
  },

  consent: {
    title: 'Before you start',
    intro: 'Chamfer is a free tool for preparing your own letters and court filings.',
    p1:
      'General information, not legal advice: your individual case is not reviewed.',
    p2:
      'You file documents in your own name and on your own responsibility. Check everything before sending.',
    p3:
      'Your data stays in the browser; for PDF generation it is sent to our server only for rendering and discarded immediately. The place and authority lookup also sends the place or postal code you enter to our server.',
    p4:
      'For complex situations seek counseling (Flüchtlingsrat, Caritas, Diakonie, a lawyer).',
    accept: 'I understand and accept',
  },

  draft: {
    toggle: 'Save draft on this device',
    note:
      'The draft is stored unencrypted on this device only and is never uploaded. Do not enable this on a shared or public computer.',
    found: 'Draft from {{date}}',
    restore: 'Restore',
    delete: 'Delete',
  },

  faq: {
    back: 'Back to the assistant',
    title: 'Frequently asked questions',
    fiktion: {
      q: 'What is the Fiktionsbescheinigung and why does everyone ask for it?',
      a: 'A provisional certificate that your residence-permit application is being processed (§ 81 Abs. 5 AufenthG). You have an unconditional right to it. The authority has no discretion. Without it, work, benefits and housing get difficult; that is why it is usually the first letter.',
    },
    oral: {
      q: 'I was refused orally. Is that even allowed?',
      a: 'A decision on an application must be issued in writing, with reasons and an appeal instruction (Rechtsbehelfsbelehrung). An oral “no” at the counter does not bind you. Demand a written Bescheid (template available); bring a witness if possible and note the date and the clerk’s name.',
    },
    wait: {
      q: 'How long may the authority take, and what then?',
      a: 'Weeks are reasonable, months are not. Escalation: polite status inquiry → formal reminder with a deadline → free supervisory complaint → after 3 months from filing (§ 75 VwGO) the inaction lawsuit becomes available. Document every step in writing.',
    },
    fax: {
      q: 'Why do you recommend fax? It is 2026.',
      a: 'Because deadlines turn on PROVABLE receipt (Zugang). A fax transmission report and an Einschreiben receipt are evidence; plain e-mail is not. Some authorities explicitly exclude legally relevant applications by e-mail. Send e-mail additionally, for speed.',
    },
    duldung: {
      q: 'I waived § 24 / I have a Duldung. Is everything lost?',
      a: 'No, but constellations differ a lot. A third-country stay without status: case law is on your side. A valid status in another EU state: after 13.08.2025 refusal is near-certain. A waiver under pressure/without an interpreter can be attacked (up to Anfechtung by analogy to §§ 119, 123 BGB). Run our triage to see your scenario and get counseling before filing.',
    },
    dsgvo: {
      q: 'Why would I need a copy of my file (DSGVO request)?',
      a: 'You see what the authority actually knows and relies on: internal notes, queries to other agencies, memos. Free of charge, answered within a month (Art. 12 Abs. 3 DSGVO). Useful before the BAMF interview, before complaints, and when changing lawyers.',
    },
    who: {
      q: 'Is Chamfer a law firm? Do you file for me?',
      a: 'No. Chamfer is self-help: vetted templates and information, but no case review, no individual advice, no representation (RDG). You sign and file yourself, in your own name and on your own responsibility.',
    },
  },

  footer: {
    disclaimer: 'Chamfer: general information, not legal advice.',
  },
} as const;
