# SNTIQ Tools

Four browser tools share a Next.js application shell, language settings and form controls. Each module opens directly at its own route.

| Tool | Purpose | Route |
| --- | --- | --- |
| Kerf | Read legislation, compare dated versions and follow links to decisions. | [Open Kerf](https://sntiq.com/dt/kerf) |
| Taper | Find the authority or court responsible for a place and matter. | [Open Taper](https://sntiq.com/dt/taper) |
| Chamfer | Prepare a formal letter, find the recipient and export the result as PDF or DOCX. | [Open Chamfer](https://sntiq.com/dt/chamfer) |
| Lathe | Complete the German legal aid declaration and generate the filled form in the browser. | [Open Lathe](https://sntiq.com/dt/lathe) |

## Run locally

The build below was tested with Node.js 26.13.1 and npm. Run these commands from the repository root.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). Choose a tool or open `/dt/kerf`, `/dt/taper`, `/dt/chamfer` or `/dt/lathe` directly. The PDF.js worker is copied from the locked package before the development server and production build start.

## Services

Kerf and Taper query the public APIs. Chamfer posts the composed letter when the user requests a PDF or DOCX. Lathe works with the blank form and font shipped in this repository.

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
