# SNTIQ Tools

Use Kerf, Taper, Chamfer, and Lathe in one web application for legal research, authority lookup, and paperwork.

| Tool | Purpose | Source |
| --- | --- | --- |
| [Kerf](https://sntiq.com/dt/kerf) | Read German and EU law, compare available versions, and trace amendments and court citations to official sources. | [kerf](https://github.com/SNTIQ-Team/kerf) |
| [Taper](https://sntiq.com/dt/taper) | Find German authorities and courts for a place and matter, with sources and appeal routes where available. | [taper](https://github.com/SNTIQ-Team/taper) |
| [Chamfer](https://sntiq.com/dt/chamfer) | Draft letters to German authorities and courts, find the recipient, and export to PDF or DOCX. | [chamfer](https://github.com/SNTIQ-Team/chamfer) |
| [Lathe](https://sntiq.com/dt/lathe) | Complete the German legal aid declaration (form ZP 1a) in your browser and download the filled PDF. | [lathe](https://github.com/SNTIQ-Team/lathe) |

## Run locally

The build below was tested with Node.js 26.13.1 and npm. Run these commands from the repository root.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). Choose a tool or open `/dt/kerf`, `/dt/taper`, `/dt/chamfer` or `/dt/lathe` directly. The PDF.js worker is copied from the locked package before the development server and production build start.

## Services

Kerf and Taper query the public APIs. Downloading a PDF or DOCX from Chamfer sends the composed letter to `https://api.sntiq.com/chamfer/letter`. Lathe fills the blank form in the browser using the font bundled in this repository.

| Client | Default API base | Build-time override |
| --- | --- | --- |
| Kerf | `https://api.sntiq.com/kerf` | `NEXT_PUBLIC_KERF_API_BASE_URL` |
| Taper | `https://api.sntiq.com/taper` | `NEXT_PUBLIC_TAPER_API_BASE_URL` |
| Chamfer | `https://api.sntiq.com/chamfer` | `NEXT_PUBLIC_CHAMFER_API_BASE_URL` |

Set these variables before building to use your own endpoints. Browser requests to another origin require CORS support on that service. [Kerf backend](https://github.com/SNTIQ-Team/kerf) · [Taper and Chamfer backend](https://github.com/SNTIQ-Team/taper)

## Checks and production build

```sh
npm test
npm run lint
npm run typecheck
npm run build
npm start
```

The route components live in `apps/web/app/dt`. The four modules under `apps/web/modules` contain the browser clients, domain logic and translations. The `apps/web/core` directory provides the shared shell and controls.

SNTIQ's software is available under Apache 2.0. The licensing guide identifies terms for original editorial material, fonts, legal texts and the official form. [Licensing](LICENSING.md)
