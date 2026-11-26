/** Chamfer i18n: DE (translated from the canonical RU content). */
export const de = {
  app: { subtitle: 'Schreiben an deutsche Behörden: DIN 5008, Empfänger und Einreichungsweg.' },

  steps: {
    label: 'Schritte',
    place: 'Ort',
    triage: 'Situation',
    letter: 'Schreiben',
    faq: 'FAQ',
  },

  common: {
    downloadFailed: '{{format}}-Download fehlgeschlagen. Versuchen Sie es erneut oder kopieren Sie den Text.',
    back: 'Zurück',
    next: 'Weiter',
    change: 'Ändern',
    edit: 'Bearbeiten',
    optional: 'optional',
    copy: 'Text kopieren',
    copied: 'Kopiert',
    downloadPdf: 'PDF herunterladen (DIN 5008)',
    downloadDocx: 'DOCX herunterladen (Vorlage)',
    pdfFailed:
      'PDF-Dienst derzeit nicht erreichbar. Text kopieren oder per E-Mail senden.',
    openMail: 'Im Mailprogramm öffnen',
    mailtoTooLong:
      'Der Text ist lang und wurde in die Zwischenablage kopiert. Fügen Sie ihn manuell in die E-Mail ein.',
  },

  place: {
    plzMismatch: 'Diese Postleitzahl passt nicht zur ausgewählten Gemeinde. Prüfen Sie die PLZ oder ändern Sie die Gemeinde.',
    title: 'Wo wohnen Sie?',
    hint:
      'Geben Sie Ihre Stadt oder Gemeinde ein. Wir ermitteln die zuständigen Behörden und das Gericht aus amtlichen Daten (Taper). Bei Namensgleichheit hilft das Bundesland in Klammern.',
    inputPlaceholder: 'z. B. Erding',
    noResults: 'Nichts gefunden. Prüfen Sie die Schreibweise.',
    error: 'Datendienst nicht erreichbar. Bitte später erneut versuchen.',
    didYouMean: 'Meinten Sie vielleicht:',
    plzPrompt: 'Ihre Postleitzahl (PLZ)',
    plzWhy:
      'Die PLZ wird für die genaue Gerichtszuordnung und den Briefkopf benötigt.',
    skipLink: 'Ort nicht gefunden? Schritt überspringen',
    skipTitle: 'Warum überspringen?',
    skipNote:
      'Ohne Ort können wir die Behörde nicht automatisch ermitteln: Sie geben die Empfängeradresse manuell ein; den Rechtsbehelfsweg zeigen wir konservativ (beide Varianten).',
    skipReason: {
      not_found: 'Mein Ort wird nicht gefunden',
      abroad: 'Ich bin derzeit nicht in Deutschland',
      other: 'Anderer Grund / nur umschauen',
    },
  },

  tree: {
    title: 'Ihre Situation',
    hint:
      'Nach wenigen Fragen zeigen wir passende Schritte und Schreiben. Allgemeine Information, keine Rechtsberatung.',
    lettersTitle: 'Empfohlene Schreiben',
    yes: 'Ja',
    no: 'Nein',
    bescheidBelehrung: 'Welche Rechtsbehelfsbelehrung enthält der Bescheid?',
    'belehrung.yes': 'Vollständige, zutreffende Belehrung',
    'belehrung.missing': 'Belehrung fehlt oder ist fehlerhaft',
    'belehrung.unknown': 'Kann ich nicht beurteilen',
    benefitsRegime: 'Wer zahlt Ihre Leistungen?',
    'regime.sozialamt': 'Sozialamt (AsylbLG)',
    'regime.jobcenter': 'Jobcenter (Grundsicherungsgeld, früher Bürgergeld)',
    'regime.unknown': 'Weiß ich nicht',
    'scenario.unsure': 'Unsicher / andere Konstellation',
    'mahnung.unreachable': 'Behörde reagiert gar nicht / kein Zugang',
    rootArea: 'Welches Rechtsgebiet betrifft Sie?',
    'area.aufenthalt': 'Aufenthalt / vorübergehender Schutz / Asyl (AufenthG, AsylG)',
    'area.social': 'Leistungen und Sozialrecht (AsylbLG, SGB II)',
    'area.data': 'Daten- und Aktenzugang (DSGVO, Akteneinsicht)',
    'area.other': 'Anderes / alle Schreiben ansehen',
    dataKind: 'Um wessen Akte geht es?',
    'data.bamf': 'Meine Akte beim BAMF (Asyl)',
    'data.other': 'Akte bei einer anderen Behörde (ABH, Sozialamt usw.)',
    root: 'Worum geht es?',
    'root.waiting': 'Ich habe § 24 beantragt und warte auf die Entscheidung',
    'root.oralRefusal': 'Mündliche Ablehnung / Antrag wird nicht angenommen',
    'root.writtenBescheid': 'Ich habe einen schriftlichen Ablehnungsbescheid',
    'root.duldungVerzicht': 'Ich habe einen Verzicht unterschrieben / habe eine Duldung',
    'root.noEat': 'Entscheidung da, aber keine eAT-Karte',
    'root.complaint': 'Ich möchte mich über die Behörde beschweren (Aufsichtsbeschwerde)',
    'root.benefits': 'Leistungen / Übersetzungskosten',
    waitingFiktion: 'Haben Sie eine gültige Fiktionsbescheinigung?',
    waiting3Months: 'Sind seit der Antragstellung mehr als 3 Monate vergangen?',
    waitingMahnung:
      'Haben Sie bereits schriftlich mit Fristsetzung erinnert (Mahnung)?',
    'mahnung.notSent': 'Noch nicht',
    'mahnung.sentExpired': 'Ja, Frist abgelaufen, keine Antwort',
    'mahnung.sentWaiting': 'Ja, Frist läuft noch',
    out: {
      fiktion:
        'Erster Schritt: die Fiktionsbescheinigung. Darauf besteht ein gebundener Anspruch (§ 81 Abs. 5 AufenthG); sie löst die meisten praktischen Probleme (Arbeit, Leistungen, Wohnung). Parallel können Sie den Sachstand erfragen.',
      status:
        'Die Behörde braucht Zeit. Jetzt passt eine höfliche Sachstandsanfrage mit der Bitte, fehlende Unterlagen konkret zu benennen.',
      mahnung:
        'Nächste Stufe: die förmliche Erinnerung mit Fristsetzung. Sie ist die Pflichtstufe vor Beschwerde und Klage. Zugleich dokumentiert sie Ihre Sorgfalt.',
      waitMahnung:
        'Warten Sie das Fristende Ihrer Erinnerung ab. Bleibt die Antwort aus, kommen Sie zurück: dann Aufsichtsbeschwerde und/oder Klage. Bewahren Sie alle Versandnachweise auf.',
      escalate:
        'Ihre Frist ist ohne Antwort verstrichen. Jetzt passend: die kostenlose Fachaufsichtsbeschwerde und, bei Vorliegen der Voraussetzungen des § 75 VwGO, die Untätigkeitsklage zum Verwaltungsgericht.',
      oral:
        'Eine mündliche Ablehnung oder Annahmeverweigerung bindet Sie nicht; sie muss aber schriftlich werden. Verlangen Sie einen schriftlichen Bescheid mit Begründung und Rechtsbehelfsbelehrung.',
      bescheid:
        'Die Rechtsbehelfsfrist läuft. Was zu tun ist, hängt von Ihrem Bundesland ab, siehe unten. Bei schriftlicher Ablehnung empfehlen wir dringend eine Beratung.',
      reapply:
        'Eine erneute Antragstellung ist möglich; der Ausgang hängt stark von Ihrer konkreten Konstellation ab. Wählen Sie im Formular Ihr Szenario und lesen Sie unbedingt den Hinweis.',
      eat:
        'Die eAT-Karte ist die Standardform des Titels (§ 78 AufenthG). Wenn Sie nur ein Klebeetikett erhalten haben, fordern Sie den eAT schriftlich an.',
      translation:
        'Kosten notwendiger Übersetzungen können übernommen werden: nach AsylbLG als sonstige Leistung (§ 6 Abs. 1), nach SGB II als Mehrbedarf (§ 21 Abs. 6).',
      aufsicht:
        'Die Fachaufsichtsbeschwerde ist kostenlos und an keine Frist gebunden. Sie beschleunigt Verfahren oft. Schildern Sie die Fakten (Daten, Sendungen, Schweigen); die Aufsicht muss prüfen und antworten.',
      dsgvoBamf:
        'Eine Kopie Ihrer BAMF-Akte können Sie nach Art. 15 DSGVO anfordern: kostenlos, Antwort binnen eines Monats (Art. 12 Abs. 3 DSGVO). Sinnvoll vor der Anhörung und bei Wechsel der Außenstelle.',
      dsgvoOther:
        'Bei jeder Behörde können Sie kumulativ Akteneinsicht (VwVfG) und eine Kopie Ihrer Daten (Art. 15 DSGVO) beantragen, mit der Bitte um Teilgewährung statt Vollablehnung. Anwaltlich geprüfte Vorlage.',
      browse:
        'Der vollständige Katalog unten ist nach Situationen gruppiert. Passt nichts, beginnen Sie mit dem Datenzugang oder einer Beratung.',
      counselTitle:
        'Sie haben einen gültigen Schutzstatus in einem anderen EU-Staat. Nach den BMI-Hinweisen und Erwägungsgrund 4 des Beschlusses (EU) 2025/1460 wird die Behörde voraussichtlich ablehnen; ob dieser Ausschluss unionsrechtlich bindet, ist offen (C-753/23). Für diese Konstellation generieren wir bewusst keinen Antrag: zuerst Beratung/Rechtsanwalt.',
      counselRenounced:
        'Den förmlichen Verzicht auf einen Schutzstatus in einem anderen EU-Staat können Gerichte als Rechtsmissbrauch werten (BayVGH 19 ZB 25.898). Für diese Konstellation generieren wir bewusst keinen Antrag: nur mit Rechtsanwalt.',
    },
  },

  notes: {
    regimeHowTell:
      'So erkennen Sie es: Leistungsbriefe vom Jobcenter nennen Grundsicherungsgeld (früher Bürgergeld)/SGB II, vom Sozialamt das AsylbLG. Die Vorlage passt sich nach Ihrer Auswahl im Formular an.',
    channel:
      'Rechtssicher senden Sie per Fax (Sendebericht aufbewahren) oder Einschreiben. E-Mail nur zusätzlich.',
    document:
      'Dokumentieren Sie alles: Kopien, Daten, Versandnachweise. Das sind Ihre Beweise, falls es vor Gericht geht.',
    lawsuitLast:
      'Die Klage ist der letzte Schritt. Zuerst die Aufsichtsbeschwerde: kostenlos und oft wirksam.',
    witness:
      'Gehen Sie möglichst mit Begleitung zur Behörde und notieren Sie Datum, Uhrzeit und Namen.',
    deadlineOneMonth:
      'Regelfrist: 1 Monat ab Zugang des Bescheids (12 Monate bei fehlender oder falscher Rechtsbehelfsbelehrung). Nicht aufschieben.',
    scenarioMatters:
      'Die Szenarien sind rechtlich sehr verschieden: von „Rechtsprechung auf Ihrer Seite“ bis „hohes Ablehnungsrisiko“. Die Auswahl steuert Argumente und Warnhinweise.',
    rechtskreiswechsel:
      'Achtung: Im Bundestag liegt ein Gesetzentwurf, der Betroffene von der Grundsicherung (Jobcenter) ins AsylbLG (Sozialamt) überführt; Kriterium ist die erstmalige Erteilung des § 24-Titels bzw. der Fiktionsbescheinigung nach dem 31.03.2025. Aktuellen Stand prüfen.',
    counseling:
      'Wir empfehlen eine Beratung: Flüchtlingsrat Ihres Landes, Caritas, Diakonie oder Rechtsanwalt. Die Schreiben aus diesem Modul bereiten die Beratung vor. Sie ersetzen sie nicht.',
  },

  urgency: {
    deadline: 'Frist läuft',
    high: 'Handeln wichtig',
    normal: 'Regulärer Ablauf',
  },

  remedies: {
    title: 'Rechtsbehelfsweg: {{land}}',
    directKlage:
      'In Ihrem Bundesland gibt es im Ausländerrecht keinen Widerspruch: Gegen den Bescheid ist direkt Klage zum Verwaltungsgericht zu erheben, binnen {{klageMonths}} Monat ab Zugang ({{wrongMonths}} Monate bei fehlender oder falscher Rechtsbehelfsbelehrung).',
    widerspruch:
      'In Ihrem Bundesland ist zunächst Widerspruch einzulegen, binnen 1 Monats ab Zugang des Bescheids. Nach Zurückweisung: Klage binnen {{klageMonths}} Monat.',
    double:
      'Für Ihr Bundesland können wir den Widerspruchsweg im Ausländerrecht noch nicht verlässlich bestätigen. Sichere Strategie: binnen eines Monats Widerspruch einlegen UND den Weg in einer Beratung klären. Hauptsache, der Monat verstreicht nicht.',
    verifyFlag:
      'Eintrag für dieses Land noch nicht anwaltlich bestätigt. Rechtsbehelfsweg bitte prüfen.',
    by:
      'In Bayern geht es im Ausländerrecht direkt zum Verwaltungsgericht: Der fakultative Widerspruch (Art. 15 AGVwGO) erfasst das Ausländerrecht nicht.',
  },

  recipient: {
    title: 'Empfänger',
    loading: 'Zuständige Behörde wird ermittelt …',
    error:
      'Behörde konnte nicht ermittelt werden. Später erneut versuchen oder Ort und PLZ prüfen.',
    pickOrt: 'Ihre PLZ umfasst mehrere Orte. Wählen Sie Ihren:',
    pickOffice: 'Wählen Sie die zuständige Stelle:',
    pickKind: 'An welche Behörde richtet sich der Antrag?',
    'kind.abh': 'Ausländerbehörde',
    'kind.sozialamt': 'Sozialamt / AsylbLG-Behörde',
    supervisoryTitle: 'Aufsichtsbehörde (für Eskalation)',
    supervisoryNote:
      'Hierhin geht die Fachaufsichtsbeschwerde, wenn die Behörde nicht reagiert.',
    edit: 'Empfänger bearbeiten',
    incompletePostal: 'Für diese Stelle fehlt eine vollständige Postanschrift. Ergänzen Sie die Anschrift für den Brief.',
    completePostal: 'Postanschrift ergänzen',
    confirmRegime: 'Bestätigen Sie Name und Anschrift der für {{regime}} zuständigen Stelle.',
    enterManually: 'Empfänger manuell eingeben',
    manualTitle: 'Empfänger (manuell)',
    manualName: 'Name der Behörde / des Gerichts',
    manualAddress: 'Adresse (je Zeile eine Angabe)',
    manualFax: 'Fax',
    manualNote:
      'Prüfen Sie die Adresse auf der offiziellen Website. Ein falscher Adressat kann die Frist kosten.',
    manualEntered: 'Adresse manuell eingegeben. Vor dem Versand prüfen.',
    provenance: 'Quelle: {{source}} · Stand {{date}} · Taper',
  },

  channels: {
    notice:
      'Rechtssicher sind Fax (mit Sendebericht) oder Einschreiben. E-Mail zusätzlich senden, nicht stattdessen: Bei Fristen zählt der nachweisbare Zugang.',
    preferred: 'bevorzugt',
    supplementary: 'zusätzlich',
    fax: 'Fax',
    email: 'E-Mail',
    emailNote:
      'E-Mail ist der Zusatzkanal. Bei allem Fristrelevanten: Fax oder Einschreiben.',
  },

  gate: {
    regimeRequired: 'Wählen Sie die Leistung aus Ihrem Leistungsbescheid. Sie bestimmt die Rechtsgrundlage und den Empfänger.',
    confirmTitle: 'Bitte vor dem Fortfahren bestätigen',
    confirm: {
      application_provable:
        'Mein Antrag wurde schriftlich gestellt und ich kann das nachweisen (Kopie, Quittung, Faxbericht).',
      mahnung_sent_expired:
        'Ich habe schriftlich mit Fristsetzung erinnert; die Frist ist ohne Antwort abgelaufen.',
      has_basic_evidence:
        'Ich habe zumindest grundlegende Nachweise meines Aufenthalts in der Ukraine / der Schutzvoraussetzungen (Pass mit Stempeln, Bescheinigungen, Tickets, Dokumente).',
      counseling_sought:
        'Ich habe eine Beratung in Anspruch genommen oder geplant (Flüchtlingsrat, Caritas, Diakonie, Rechtsanwalt).',
      contested_law_understood:
        'Mir ist bewusst, dass die Gerichte solche Fälle unterschiedlich entscheiden und der Ausgang nicht garantiert ist.',
    },
    date: {
      required: 'Bitte zuerst das Datum angeben. Sonst sind die Voraussetzungen nicht prüfbar.',
      approx:
        'Nur der Monat ist angegeben. Fristen rechnen wir konservativ ab Monatsende. Tragen Sie das genaue Datum nach, sobald bekannt.',
    },
    minWait:
      'Erst {{elapsed}} von {{months}} Monaten vergangen (§ 75 VwGO). Eine Klage wäre jetzt verfrüht: Sie kann dem eigenen Fall schaden und Kosten auslösen.',
    remedy: {
      absent:
        'In {{land}} gibt es im Ausländerrecht keinen Widerspruch. Diese Vorlage passt nicht. Der Weg: direkt Klage zum Verwaltungsgericht binnen 1 Monats. Bitte umgehend beraten lassen.',
      verify:
        'Für {{land}} ist der Widerspruchsweg nicht bestätigt. Sicher: Widerspruch einlegen UND parallel den Weg in einer Beratung klären, alles binnen des Monats.',
    },
    deadline: {
      unknownInstruction: 'Die Art der Belehrung ist ungeklärt. Prüfen Sie den Abschnitt zum Rechtsbehelf, seiner Einlegungsstelle, deren Sitz und der Frist. Die reguläre Monatsfrist kann bereits laufen.',
      unknownNotification: 'Ohne gesichertes Datum der Bekanntgabe lässt sich das Fristende nicht bestimmen. Prüfen Sie den Zustellnachweis.',
      unknownCalendar: 'Bitte prüfen Sie das Fristende am Sitz der empfangenden Behörde. Für diesen Ort oder dieses Jahr steht kein eindeutiger Feiertagskalender zur Verfügung.',
      invalidNotification: 'Prüfen Sie das Datum der Bekanntgabe. Es darf weder vor dem Bescheiddatum noch in der Zukunft liegen.',
      passed: 'Die berechnete Frist endete am {{deadline}}. Prüfen Sie die Daten und lassen Sie mögliche Ausnahmen oder eine Wiedereinsetzung umgehend klären.',
      oneMonth: 'Bis {{deadline}} (ein Monat ab Bekanntgabe). Der Widerspruch muss rechtzeitig eingehen.',
      yearRule: 'Für die angegebene fehlende oder fehlerhafte Belehrung ist die reguläre Jahresfrist bis {{deadline}} berechnet (§ 58 Abs. 2 VwGO).',
    },
    mahnung: {
      notExpired:
        'Die gesetzte Frist Ihrer Erinnerung läuft noch. Warten Sie das Fristende ab. Eine verfrühte Klage schadet Ihrem Fall.',
    },
    scenario: {
      required:
        'Bitte wählen Sie oben Ihr Szenario. Davon hängen die Argumente und die Anwendbarkeit der Vorlage ab.',
      titleElsewhere:
        'Sie haben einen gültigen Schutzstatus in einem anderen EU-Staat. Bei Antragstellung nach dem 13.08.2025 wird die Behörde, gestützt auf die BMI-Hinweise und Erwägungsgrund 4 des Beschlusses (EU) 2025/1460, voraussichtlich ablehnen. Der Ausschluss steht in einem Erwägungsgrund, nicht in den Artikeln; ob er unionsrechtlich bindet, ist gerichtlich nicht abschließend geklärt (C-753/23). Die Vorlage passt nicht: zuerst Rechtsanwalt/Beratung.',
      renounced:
        'Den förmlichen Verzicht auf einen Schutzstatus in einem anderen EU-Staat können Gerichte als Rechtsmissbrauch werten (BayVGH 19 ZB 25.898). Nicht ohne Rechtsanwalt einreichen.',
    },
  },

  profile: {
    title: 'Ihre Daten',
    name: 'Vorname',
    surname: 'Nachname',
    dob: 'Geburtsdatum',
    street: 'Straße, Hausnummer',
    plzCity: 'PLZ, Ort',
    coTitle: 'Mitantragsteller (Familie)',
    coAdd: 'Person hinzufügen',
    coRemove: 'Entfernen',
    coName: 'Vor- und Nachname (lateinisch)',
    coRelation: 'Verhältnis zu Ihnen',
    relations: {
      partner: 'Partner(in)',
      husband: 'Ehemann',
      wife: 'Ehefrau',
      son: 'Sohn',
      daughter: 'Tochter',
      other: 'Familienangehörige(r)',
    },
    latinWarn:
      'Bitte lateinische Buchstaben verwenden (wie im Pass). Kyrillische Zeichen wurden entfernt.',
    openPicker: 'Kalender öffnen',
    invalidDate: 'Bitte ein gültiges Datum im Format TT.MM.JJJJ eingeben.',
    futureDate: 'Das Geburtsdatum liegt in der Zukunft.',
    handFill: 'Daten später von Hand eintragen (auf dem Ausdruck)',
    handFillNote:
      'Der Brief enthält Leerzeilen statt Name und Adresse. Bitte vor dem Versand handschriftlich ausfüllen und unterschreiben.',
  },

  letter: {
    allLetters: 'Alle Schreiben',
    fieldsTitle: 'Angaben zum Schreiben',
    previewButton: 'Schreiben anzeigen',
    fillAll: 'Bitte Pflichtfelder ausfüllen (*)',
  },

  fields: {
    applicationDate: 'Datum der Antragstellung',
    oralRefusalDate: 'Datum der mündlichen Ablehnung',
    mahnungDeadline: 'Frist aus der Erinnerung',
    notificationDate: 'Datum der Bekanntgabe',
    notificationDateHint: 'Wann wurde Ihnen der Bescheid wirksam bekannt gegeben? Wenn das Datum unklar ist, lassen Sie das Feld frei.',
    bescheidDate: 'Datum des Bescheids',
    aktenzeichen: 'Aktenzeichen (falls vorhanden)',
    authorityLetterDate: 'Datum des Behördenschreibens',
    inquiryDate: 'Datum der Sachstandsanfrage',
    fiktionExpiry: 'Ablaufdatum der Fiktionsbescheinigung',
    applicationDateHint: 'Tag, an dem Sie den Antrag gestellt haben (persönlich oder per Brief).',
    oralRefusalDateHint: 'Wann Ihnen mündlich abgesagt wurde. Falls unbekannt, leer lassen.',
    mahnungDeadlineHint: 'Die Frist, die Sie der Behörde in der Erinnerung gesetzt haben.',
    bescheidDateHint: 'Das Datum oben auf dem schriftlichen Bescheid.',
    aktenzeichenHint: 'Aktenzeichen aus den Behördenbriefen (Az./Gz.). Falls keines vorhanden, leer lassen.',
    authorityLetterDateHint: 'Datum des Behördenschreibens, auf das Sie antworten (im Briefkopf).',
    inquiryDateHint: 'Wann Sie die Sachstandsanfrage gesendet haben.',
    fiktionExpiryHint: 'Das „gültig bis“-Datum Ihrer Fiktionsbescheinigung.',
    anlagen: 'Anlagen',
    anlagenPlaceholder: 'Kopie des Ausweisdokuments',
    anlagenHint:
      'Eine Zeile pro Dokument. Allgemein halten: „Kopie des Ausweisdokuments“, „Nachweise laut Text“. Keine unnötigen Details.',
    approxToggle: 'Ich weiß nur den Monat',
  },

  letters: {
    fiktion_demand: {
      title: 'Fiktionsbescheinigung anfordern',
      description:
        'Ausstellung oder Verlängerung der Bescheinigung nach § 81 Abs. 5 AufenthG. Darauf besteht ein gebundener Anspruch.',
    },
    decision_request: {
      title: 'Sachstandsanfrage',
      description:
        'Höfliche Nachfrage: Wie ist der Stand, welche Unterlagen fehlen?',
    },
    oral_refusal: {
      title: 'Schriftlichen Bescheid verlangen',
      description:
        'Macht aus der mündlichen Ablehnung eine schriftliche, mit Begründung und Rechtsbehelfsbelehrung.',
    },
    eat_demand: {
      title: 'eAT-Karte anfordern',
      description:
        'Ausstellung des elektronischen Aufenthaltstitels (§ 78 AufenthG), wenn nur ein Klebeetikett erteilt wurde.',
    },
    mahnung_fristsetzung: {
      title: 'Erinnerung mit Fristsetzung',
      description:
        'Förmliche Erinnerung mit konkreter Frist, die Pflichtstufe vor jeder Eskalation.',
    },
    new_application: {
      title: 'Erneuter Antrag auf § 24',
      description:
        'Erneute Antragstellung nach Ablehnung oder Duldung, mit Argumenten für Ihr Szenario. Erfordert Vorbereitung.',
    },
    translation_costs: {
      title: 'Übersetzungskosten',
      description:
        'Antrag auf Übernahme der Kosten notwendiger Übersetzungen (AsylbLG / SGB II).',
    },
    aufsichtsbeschwerde: {
      title: 'Fachaufsichtsbeschwerde',
      description:
        'Beschwerde bei der Aufsichtsbehörde: kostenlos, fristlos, oft beschleunigend.',
    },
    widerspruch_aufenthg: {
      title: 'Widerspruch gegen den Bescheid',
      description:
        'Verwaltungsinterner Rechtsbehelf, wo das Landesrecht ihn vorsieht. Frist: 1 Monat.',
    },
    dsgvo_bamf: {
      title: 'Aktenkopie vom BAMF (Art. 15 DSGVO)',
      description:
        'Anforderung einer vollständigen Kopie Ihrer BAMF-Akte: kostenlos, PDF per E-Mail. Adresse ist vorausgefüllt.',
    },
    dsgvo_behoerde: {
      title: 'Akteneinsicht + DSGVO (jede Behörde)',
      description:
        'Kumulativer Antrag: Akteneinsicht (VwVfG) + Datenkopie (Art. 15 DSGVO), mit Bitte um Teilgewährung statt Ablehnung.',
    },
    untaetigkeitsklage: {
      title: 'Untätigkeitsklage',
      description:
        'Klage zum Verwaltungsgericht wegen Untätigkeit (§ 75 VwGO). Letzter Schritt, erst nach Ausschöpfung der übrigen.',
    },
  },

  groups: {
    waiting: 'Warten auf Entscheidung',
    refused: 'Ablehnung',
    documents: 'Dokumente',
    escalation: 'Eskalation',
    data: 'Daten und Akte',
  },

  q: {
    urgencyReason: 'Warum eilt es? (fügt dem Schreiben einen Absatz hinzu)',
    'urgencyReason.none': 'Nicht angeben',
    'urgencyReason.job': 'Arbeitsverhältnis in Gefahr',
    'urgencyReason.benefits': 'Probleme beim Leistungsbezug',
    'urgencyReason.housing': 'Wohnungsanmietung nicht möglich',
    fiktionSituation: 'Stand der Fiktionsbescheinigung?',
    'fiktionSituation.never': 'Nie ausgestellt',
    'fiktionSituation.expired': 'Vorhanden, aber abgelaufen',
    oralRefusalKind: 'Was genau ist passiert?',
    'oralRefusalKind.refusedToAccept': 'Annahme des Antrags wurde verweigert',
    'oralRefusalKind.announcedRejection':
      'Ablehnung wurde mündlich angekündigt / erklärt',
    reapplyScenario: 'Ihr Szenario',
    'reapplyScenario.germanVerzicht':
      'Ich habe auf den deutschen § 24 verzichtet (z. B. bei der ABH)',
    'reapplyScenario.thirdCountryStay':
      'Ich habe vor Deutschland in einem Drittstaat/anderen EU-Staat gelebt, dort aber keinen Schutzstatus erhalten',
    'reapplyScenario.appliedElsewhere':
      'Ich habe in einem anderen EU-Staat beantragt, aber keinen Titel erhalten',
    'reapplyScenario.titleElsewhere':
      'Ich habe einen gültigen Schutzstatus in einem anderen EU-Staat',
    'reapplyScenario.renouncedElsewhere':
      'Ich habe förmlich auf den Status in einem anderen EU-Staat verzichtet',
    benefitRegime: 'Welche Leistungen beziehen Sie?',
    'benefitRegime.asylblg': 'AsylbLG (Sozialamt)',
    'benefitRegime.sgb2': 'Grundsicherungsgeld, früher Bürgergeld (Jobcenter)',
    repeatRequest: 'Ich habe die Akte bereits früher angefordert (erneuter Antrag)',
    priorInquirySent: 'Ich habe bereits eine Sachstandsanfrage gesendet',
    fiktionAlsoMissing: 'Die Fiktionsbescheinigung fehlt mir ebenfalls',
    hadRechtsbehelfsbelehrung:
      'Der Bescheid enthielt eine Rechtsbehelfsbelehrung',
  },

  interstitials: {
    accept: 'Gelesen und verstanden',
    reapplication_scenarios: {
      title: 'Vor der Antragstellung lesen',
      body:
        'Die erneute Antragstellung ist rechtlich anspruchsvoll; die Gerichte entscheiden unterschiedlich.\n\n' +
        '• Aufenthalt im Drittstaat ohne Schutzstatus: Rechtsprechung auf Ihrer Seite. Die Behörde kann dennoch ablehnen; auf Rechtsbehelf einstellen.\n' +
        '• Antrag in anderem EU-Staat ohne Titel: schließt den Schutz in Deutschland nicht aus.\n' +
        '• Gültiger Titel in anderem EU-Staat: Bei Antrag nach dem 13.08.2025 lehnt die Behörde voraussichtlich ab (BMI-Hinweise; Erwägungsgrund 4 des Beschlusses (EU) 2025/1460). Ob das unionsrechtlich bindet, ist offen (C-753/23); Streit nur mit Rechtsanwalt.\n' +
        '• Förmlicher Verzicht auf fremden Status: Risiko der Wertung als Rechtsmissbrauch.\n' +
        '• Verzicht auf den deutschen § 24: Ausgang hängt von den Umständen ab (schriftlich? übersetzt? unter Druck?); der Verzicht selbst ist anfechtbar (§§ 119, 123 BGB analog), aber die Fristen sind eng und anwaltliche Hilfe nötig.\n\n' +
        'Sammeln Sie Unterlagen zu den Umständen und nehmen Sie VOR der Antragstellung eine Beratung in Anspruch. Dieses Schreiben bereitet vor. Es ersetzt nichts.',
    },
    widerspruch_deadline: {
      title: 'Achtung: Frist',
      body:
        'Der Widerspruch ist binnen 1 Monats ab Zugang des Bescheids einzulegen (12 Monate nur bei fehlender oder falscher Rechtsbehelfsbelehrung). Versenden Sie nachweisbar: Fax mit Sendebericht oder Einschreiben. Die Begründung kann nachgereicht werden. Entscheidend ist der fristgerechte Widerspruch selbst.',
    },
    lawsuit_last_resort: {
      title: 'Die Klage ist der letzte Schritt',
      body:
        'Die Untätigkeitsklage passt nur, wenn:\n' +
        '1. der Antrag nachweisbar schriftlich gestellt wurde;\n' +
        '2. Sie mit Fristsetzung erinnert haben und die Frist abgelaufen ist;\n' +
        '3. seit der Antragstellung mindestens 3 Monate vergangen sind (§ 75 VwGO);\n' +
        '4. zumindest grundlegende Nachweise in der Sache vorliegen.\n\n' +
        'Eine verfrühte oder unbelegte Klage schadet dem eigenen Fall und kann Kosten auslösen. Vor dem VG besteht kein Anwaltszwang; eine Beratung wird dennoch dringend empfohlen.',
    },
  },

  email: {
    title: 'E-Mail (zusätzlich zu Fax/Post)',
    edit: 'Text bearbeiten',
    body: 'Nachricht',
    reset: 'Erstellten Entwurf wiederherstellen',
    fullscreen: 'Vollbild',
    exitFullscreen: 'Vollbild schließen',
    fullscreenHint: 'Esc oder nach unten wischen zum Schließen',
    open: 'Anderes Mailprogramm',
    from: 'Von',
    fromAuto: 'wird automatisch von Ihrem Mailprogramm ausgefüllt',
    to: 'An',
    subject: 'Betreff',
    gmail: 'Gmail',
  },

  toast: {
    copied: 'In die Zwischenablage kopiert',
    copyFailed: 'Kopieren fehlgeschlagen. Bitte Text manuell markieren.',
  },

  send: {
    letter: {
      title: 'So versenden Sie',
      body:
        'Schritte: 1) PDF/DOCX herunterladen und ausdrucken; 2) mit Stift unterschreiben; 3) Kopie/Foto für sich behalten; 4) per Fax senden (Online-Dienste: simple-fax.de, fax.de) und den Sendebericht aufbewahren, oder als Einschreiben bei der Post senden und den Beleg aufbewahren; 5) E-Mail nur als Dublette.',
    },
    lawsuit: {
      title: 'So reichen Sie die Klage ein',
      body:
        'Die Klage wird beim Verwaltungsgericht schriftlich (Post/Fax) erhoben oder zur Niederschrift bei der Rechtsantragstelle erklärt. Kopien beifügen. Vor dem VG besteht kein Anwaltszwang (§ 67 VwGO).',
    },
  },

  preview: {

    title: 'Brief',
    faxToggle: 'Zeile „Per Fax vorab: {{fax}}“ im Briefkopf',
    disclaimer:
      'Erstellt mit Chamfer (SNTIQ). Allgemeine Information, keine Rechtsberatung, keine Vertretung (kein Rechtsbeistand). Bitte alle Angaben vor dem Versand prüfen.',
  },

  consent: {
    title: 'Bevor Sie beginnen',
    intro: 'Mit Chamfer können Sie Schreiben an Behörden und Gerichte kostenlos selbst erstellen.',
    p1:
      'Allgemeine Information, keine Rechtsberatung: Ihr Einzelfall wird nicht geprüft.',
    p2:
      'Dokumente reichen Sie im eigenen Namen und in eigener Verantwortung ein. Bitte vor dem Versand alles prüfen.',
    p3:
      'Ihre Daten bleiben im Browser; bei der PDF-Erstellung werden sie nur zum Rendern an unseren Server übertragen und sofort verworfen. Auch die Orts- und Behördensuche sendet den eingegebenen Ort bzw. die PLZ an unseren Server.',
    p4:
      'In komplexen Fällen: Beratung aufsuchen (Flüchtlingsrat, Caritas, Diakonie, Rechtsanwalt).',
    accept: 'Verstanden und akzeptiert',
  },

  draft: {
    toggle: 'Entwurf auf diesem Gerät speichern',
    note:
      'Der Entwurf wird unverschlüsselt nur auf diesem Gerät gespeichert und nirgendwohin gesendet. Nicht auf gemeinsam genutzten oder öffentlichen Computern aktivieren.',
    found: 'Entwurf vom {{date}}',
    restore: 'Wiederherstellen',
    delete: 'Löschen',
  },

  faq: {
    back: 'Zurück zum Assistenten',
    title: 'Häufige Fragen',
    fiktion: {
      q: 'Was ist die Fiktionsbescheinigung und warum verlangen sie alle?',
      a: 'Eine vorläufige Bescheinigung, dass Ihr Antrag auf einen Aufenthaltstitel in Bearbeitung ist (§ 81 Abs. 5 AufenthG). Darauf besteht ein gebundener Anspruch. Die Behörde hat kein Ermessen. Ohne sie wird es schwer mit Arbeit, Leistungen und Wohnung; deshalb ist sie meist der erste Brief.',
    },
    oral: {
      q: 'Mir wurde mündlich abgesagt. Ist das überhaupt zulässig?',
      a: 'Die Entscheidung über einen Antrag muss schriftlich ergehen, mit Begründung und Rechtsbehelfsbelehrung. Ein mündliches „Nein“ am Schalter bindet Sie nicht. Verlangen Sie einen schriftlichen Bescheid (Vorlage vorhanden); möglichst mit Begleitung erscheinen und Datum/Namen notieren.',
    },
    wait: {
      q: 'Wie lange darf die Behörde brauchen, und was dann?',
      a: 'Angemessen sind Wochen, nicht Monate. Eskalation: höfliche Sachstandsanfrage → förmliche Erinnerung mit Frist → kostenlose Fachaufsichtsbeschwerde → nach 3 Monaten seit Antragstellung (§ 75 VwGO) kommt die Untätigkeitsklage in Betracht. Jeden Schritt schriftlich dokumentieren.',
    },
    fax: {
      q: 'Warum empfehlen Sie Fax? Wir haben 2026.',
      a: 'Weil es bei Fristen auf den NACHWEISBAREN Zugang ankommt. Sendebericht und Einschreiben-Beleg sind Beweise, einfache E-Mail nicht. Manche Behörden schließen rechtsverbindliche Anträge per E-Mail ausdrücklich aus. E-Mail zusätzlich senden, der Geschwindigkeit wegen.',
    },
    duldung: {
      q: 'Ich habe auf § 24 verzichtet / habe eine Duldung. Ist alles verloren?',
      a: 'Nein, aber die Konstellationen unterscheiden sich stark. Drittstaat ohne Status: Rechtsprechung auf Ihrer Seite. Gültiger Status in anderem EU-Staat: Nach dem 13.08.2025 wird fast sicher abgelehnt. Ein Verzicht unter Druck/ohne Dolmetscher ist angreifbar (bis hin zur Anfechtung analog §§ 119, 123 BGB). Durchlaufen Sie unsere Triage und nehmen Sie vor der Antragstellung eine Beratung in Anspruch.',
    },
    dsgvo: {
      q: 'Wozu brauche ich eine Kopie meiner Akte (DSGVO-Antrag)?',
      a: 'Sie sehen, was die Behörde tatsächlich weiß und worauf sie sich stützt: Vermerke, Abfragen bei anderen Stellen, interne Notizen. Kostenlos, Antwort binnen eines Monats (Art. 12 Abs. 3 DSGVO). Sinnvoll vor der BAMF-Anhörung, vor Beschwerden und beim Anwaltswechsel.',
    },
    who: {
      q: 'Ist Chamfer eine Kanzlei? Reichen Sie für mich ein?',
      a: 'Nein. Chamfer ist Selbsthilfe: geprüfte Vorlagen und Informationen, aber keine Einzelfallprüfung, keine individuelle Beratung, keine Vertretung (RDG). Sie unterschreiben und reichen selbst ein, im eigenen Namen und in eigener Verantwortung.',
    },
  },

  footer: {
    disclaimer: 'Chamfer: allgemeine Information, keine Rechtsberatung.',
  },
} as const;
