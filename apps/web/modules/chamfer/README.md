# SNTIQ Chamfer

Chamfer prepares DIN 5008 letters and court filings for people seeking or holding temporary protection under § 24 AufenthG. The tool runs at [/dt/chamfer](https://sntiq.com/dt/chamfer) in German, English, Russian and Ukrainian.

## From situation to letter

The decision tree in `data/decision-tree.ts` maps the user's situation to questions and suggested templates. `data/letters.ts` defines the fields for each template. `engine/gating.ts` checks the dates, confirmations and remedies required by that template. In cases with different remedies across Germany, `data/remedies.ts` supplies the rule for the selected Land.

`engine/compose.ts` builds the letter from conditional paragraphs. For example, a request for a Fiktionsbescheinigung includes the expiry date when the applicant provides one.

## Addresses and delivery

The place picker searches by municipality or postcode. `data/recipients.ts` resolves the competent authority or court through Taper at `https://api.sntiq.com/taper`. The result retains the source and any limits on the match. Users can also supply an address.

The preview supports copy, email composition and document downloads. To download a PDF or DOCX, the client posts the composed letter to `https://api.sntiq.com/chamfer/letter`. If rendering fails, the text stays available in the preview.

## Development

From the repository root:

```sh
npm ci
npm run dev
```

Open `http://localhost:3000/dt/chamfer`. Run `npm test` for the module and shared test suites. The API bases are defined in [core/config.ts](../../core/config.ts).

[Public source code](https://github.com/SNTIQ-Team/tools) · [License scope](../../../../LICENSING.md)
