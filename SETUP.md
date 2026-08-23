# Setup

The app runs with zero configuration — it just stores books in whichever browser
you're using. These steps add Google sign-in and sync your library across devices.

## 1. Create a Firebase project (~5 minutes)

1. Go to <https://console.firebase.google.com> and **Add project**. Name it
   `bookmappy`. Google Analytics is not needed — turn it off.
2. **Build → Firestore Database → Create database.** Pick a location near you and
   start in **production mode** (the rules below replace the defaults).
3. **Build → Authentication → Get started → Google → Enable.** Set a support email
   and save.
4. **Authentication → Settings → Authorised domains → Add domain**, and add
   `ihrynkiv.github.io`. Without this, sign-in fails on the deployed site.
   `localhost` is already allowed.
5. **Project settings (gear) → General → Your apps → Web (`</>`).** Register the
   app; copy the `firebaseConfig` values.

## 2. Apply the security rules

Firestore starts locked down. Paste the contents of
[`firestore.rules`](firestore.rules) into **Firestore Database → Rules** and
publish. They scope every book to its owner's account.

> The Firebase web config is **public by design** — it ships inside the built
> JavaScript of every Firebase web app. It identifies the project; it does not
> grant access. The rules are what protect your data.

## 3. Configure locally

```bash
cp .env.example .env.local
# paste the values from step 1.5, then:
npm run dev
```

## 4. Configure the deployed site

The build reads the same values from GitHub repository variables. Push them with:

```bash
./scripts/set-firebase-config.sh
```

That reads your `.env.local` and sets the matching repository variables via `gh`.
Or set them by hand under **Settings → Secrets and variables → Actions →
Variables**.

## 5. Turn on GitHub Pages

**Settings → Pages → Build and deployment → Source: GitHub Actions.**

Then push to `main`, or run the **Deploy to GitHub Pages** workflow manually.
The site lands at <https://ihrynkiv.github.io/bookmappy/>.

## Importing your Goodreads library

1. Open <https://www.goodreads.com/review/import> and press **Export Library**.
2. Wait for the download link to appear (it can take a minute), then download it.
3. In bookmappy, press **Import Goodreads** and drop the CSV in.

You choose which shelves to include — by default just `read`. Author lookups run
straight after the import; a few hundred books takes well under a minute, and
authors you've already read are reused without another query.
