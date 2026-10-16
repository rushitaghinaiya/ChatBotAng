# ChatBot

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.2.0.

## Running locally

### Prerequisites

- Node.js 18+ installed
- Angular CLI is **not** required globally — use the local copy bundled with the project

### Step 1 — Install dependencies

```bash
npm install --legacy-peer-deps
```

> `--legacy-peer-deps` is required because `ngx-device-detector` declares a peer dependency on Angular 20 but this project uses Angular 19.

### Step 2 — Set environment variables

The file `src/app/constants/environment.ts` is gitignored (it contains API keys). Create it manually:

```typescript
export const environment = {
  production: false,
  openAiKey: '<your-openai-key>',
  API_BASE_URL: 'https://chat.icare.life/api/v1/'
};
```

### Step 3 — Start the dev server

**Windows (PowerShell / cmd):**
```cmd
node_modules\.bin\ng serve
```

**Mac / Linux:**
```bash
npx ng serve
```

Open **http://localhost:4200/chatbot** in your browser. The app reloads automatically when you save a source file.

> **Note:** An `SSR window is not defined` error appears in the terminal on startup — this is a pre-existing issue with server-side rendering and does not affect the browser-side app.

---

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

---

## Deploying to IIS

This is a static Angular SPA. IIS serves the built files and must be configured to redirect all routes back to `index.html` (so Angular's client-side router works correctly).

### Prerequisites

- Windows Server or Windows 10/11 with IIS enabled
- [URL Rewrite module](https://www.iis.net/downloads/microsoft/url-rewrite) installed in IIS
- Node.js installed (only needed to build; not required on the server itself)

### Step 1 — Build for production

```bash
ng build --configuration production
```

The output is placed in `dist/chat-bot/browser/`. That folder is what you deploy — **not** the `dist/chat-bot/server/` folder (that is for SSR and is not used in a plain IIS deployment).

### Step 2 — Enable IIS and the URL Rewrite module

1. Open **Turn Windows features on or off** (or Server Manager on Windows Server).
2. Enable **Internet Information Services** → **World Wide Web Services** → **Application Development Features** → **Static Content**.
3. Download and install the **URL Rewrite** module from https://www.iis.net/downloads/microsoft/url-rewrite (requires a restart of IIS Manager).

### Step 3 — Create a site in IIS Manager

1. Open **IIS Manager** (`inetmgr`).
2. Right-click **Sites** → **Add Website**.
3. Fill in:
   - **Site name:** `ChatBot` (or any name you prefer)
   - **Physical path:** full path to `dist/chat-bot/browser/`  
     e.g. `C:\inetpub\wwwroot\chatbot`  
     Copy the contents of `dist/chat-bot/browser/` into that folder.
   - **Port:** `80` (or another port if 80 is taken)
4. Click **OK**.

### Step 4 — Add a `web.config` for URL rewriting

Angular uses client-side routing. Without this, navigating directly to a URL like `/chat` returns a 404 from IIS. Create a `web.config` file inside `dist/chat-bot/browser/` (or your deployment folder):

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="Angular Routes" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="/index.html" />
        </rule>
      </rules>
    </rewrite>
    <staticContent>
      <mimeMap fileExtension=".mjs" mimeType="application/javascript" />
    </staticContent>
  </system.webServer>
</configuration>
```

> The `.mjs` MIME type entry is required because Angular 19 outputs ES module chunks with that extension, and IIS does not include it by default.

To include this file automatically on every build, place it in `public/web.config` — Angular copies everything in `public/` into the output folder during `ng build`.

### Step 5 — Set application pool to No Managed Code

1. In IIS Manager, click **Application Pools**.
2. Find the pool assigned to your site (same name as the site by default).
3. Click **Basic Settings** and set **.NET CLR Version** to **No Managed Code**.
4. Click **OK**.

### Step 6 — Grant read permissions

Make sure the IIS application pool identity (`IIS AppPool\<pool-name>`) has **Read** permission on your deployment folder:

1. Right-click the deployment folder → **Properties** → **Security** → **Edit** → **Add**.
2. In the object name box type `IIS AppPool\ChatBot` (replace `ChatBot` with your pool name).
3. Grant **Read & Execute** permission → **OK**.

### Step 7 — Browse the site

Open a browser and navigate to `http://localhost` (or the port you configured). The Angular app should load.

### Deploying updates

Each time you push a new build:

```bash
ng build --configuration production
```

Copy the contents of `dist/chat-bot/browser/` to your deployment folder, overwriting the old files. No IIS restart is needed for static file changes.

### Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| 404 on page refresh or deep link | URL Rewrite rule missing or module not installed | Re-check Step 4; confirm URL Rewrite is installed |
| 500.19 error on startup | Malformed `web.config` | Validate XML syntax; check Event Viewer |
| `.mjs` files return 404 or wrong MIME type | Missing MIME type for `.mjs` | Add the `<mimeMap>` entry from Step 4 |
| Blank page, console shows CORS errors | API base URL wrong for prod | Set `API_BASE_URL` correctly in `environment.ts` before building |
