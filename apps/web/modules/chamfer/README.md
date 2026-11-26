# SNTIQ Chamfer

Draft letters to German authorities and courts, find the recipient, and export to PDF or DOCX.

Chamfer prepares DIN 5008 letters and court filings for people seeking or holding temporary protection under § 24 AufenthG. The tool runs at [/dt/chamfer](https://sntiq.com/dt/chamfer) in German, English, Russian and Ukrainian.

## From situation to letter

The decision tree in `data/decision-tree.ts` maps the user's situation to questions and suggested templates. `data/letters.ts` defines the fields for each template. `engine/gating.ts` checks the dates, confirmations and remedies required by that template. When legal remedies vary by federal state, `data/remedies.ts` supplies the rule for the selected Land and the source for that rule.

`engine/compose.ts` builds the letter from conditional paragraphs. For example, a request for a Fiktionsbescheinigung includes the expiry date when the applicant provides one.

## Addresses and delivery

The place picker searches by municipality or postcode. `data/recipients.ts` resolves the competent authority or court through Taper at `https://api.sntiq.com/taper`. The result retains the source and any limits on the match. Users can also supply an address.

From the preview, users can copy the letter text or open an email draft. Downloading a PDF or DOCX sends the composed letter to `https://api.sntiq.com/chamfer/letter`. If the export fails, the text stays available in the preview.

## Development

From the repository root:

```sh
npm ci
npm run dev
```

Open `http://localhost:3000/dt/chamfer`. Run `npm test` for the module and shared test suites. The API bases are defined in [core/config.ts](../../core/config.ts).

[Standalone Chamfer repository](https://github.com/SNTIQ-Team/chamfer) · [License scope](../../../../LICENSING.md)
