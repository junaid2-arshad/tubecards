# TubeCards

GRE vocabulary for your commute: learn new words, recall them from memory, and use them in sentences. A static web app: it runs entirely in the browser, is hosted on GitHub Pages, and uses Firebase (free tier) for sign-in and for syncing your cards and answers.

It works in **demo mode** straight away (no sign-in, data stays in that browser). Follow the setup below to turn on sign-in and sync.

## What it does

| You asked for | Where it is |
|---|---|
| Create and edit cards, front and back | **Cards** tab: Add, tap any card to edit. Each word can have an example sentence, a memory hook and notes |
| Weekly uploads | **Cards > Import** (paste or choose a CSV, TSV or JSON file). Each batch gets a week label |
| Learning words quickly | **Study > Learn new words**: a small round of 5 words (change in More). You meet them, match them, fill a blank, type each from its meaning, then write your own sentence |
| Using words in context | **Practice** tab: fill the blank from your own example sentences, write sentences, and 38 original GRE-style text completion and sentence equivalence questions |
| Remembering over time | **Study > Review**: spaced repetition, flip or multiple choice, reverse mode, GRE exam-date mode |
| Hearing the word | Speaker button on every word and sentence (English voice on the phone) |
| Performance analytics | **Stats** tab, including accuracy by activity |
| Every answer tracked | Each answer is stored with time, result, word and activity |
| Login | Firebase email and password, locked to your account |

**Official GRE questions** are copyrighted by ETS and are not included. The questions in this app were written for it. ETS offers free POWERPREP Online practice tests; use them for full-length practice.

## One-time setup (about 15 minutes)

### 1. Create the Firebase project

1. Go to <https://console.firebase.google.com>, choose **Add project**, and name it (for example `tubecards`). You can skip Google Analytics.
2. **Build > Authentication > Get started > Email/Password**, turn it on.
3. Still in Authentication, open **Users > Add user** and create your own email and password. This is the only account that will ever exist.
4. Copy the **User UID** shown for that user.
5. In Authentication **Settings > User actions**, if you see *Enable create (sign-up)*, turn it **off**, so nobody can register themselves.
6. **Build > Firestore Database > Create database**. Choose a location near you (for example `europe-west2`, London) and **production mode**.
7. Open the **Rules** tab, paste in the contents of `firestore.rules`, and replace `PASTE_YOUR_USER_UID_HERE` with your UID. Publish.
8. **Project settings (gear icon) > Your apps > Web (`</>`)**. Register an app and copy the `firebaseConfig` values into `js/firebase-config.js`.

### 2. Put it on GitHub Pages

1. Create a GitHub repository and upload everything in this folder (keep the `.nojekyll` file).
   - Free GitHub accounts need a **public** repository for Pages. That is fine here: the code is public, but your cards and answers are not, because the Firestore rules only allow your account in.
2. **Settings > Pages**, set the source to *Deploy from a branch*, branch `main`, folder `/ (root)`. Your site appears at `https://<your-username>.github.io/<repo-name>/`.
3. Back in Firebase, **Authentication > Settings > Authorized domains > Add domain**, and add `<your-username>.github.io`.

### 3. Put it on your iPhone

1. Open the link in **Safari** and sign in.
2. Tap **Share > Add to Home Screen** for an app icon.
3. Open it once while online so it can save itself for the Tube. After that, words, Learn, Practice and review all work offline, and your answers sync when you are back above ground.

## Your weekly routine

1. Ask any AI assistant for next week's words in this format (or edit the templates in **Cards > Import**):

   ```
   deck,type,front,hint,back,notes,tags,hook
   GRE Vocab,gre,ephemeral,"Fame can be ephemeral.",lasting a very short time,"fleeting, transient",
   ```

   `hint` is the example sentence. For quick lists with no header, use one card per line: `front | back | sentence | notes`.
2. Open **Cards > Import**, paste it, check the "ready" count, and tap **Import**.
3. Importing the same word again updates its text but keeps your study progress.

## How the quizzing helps you remember

- New cards go through short steps (1 min, 10 min), then return after a day, then at growing gaps.
- Forget a card and it returns soon, at about 40% of its previous gap.
- Each answer button shows when the card will return, so you can see the effect of your choice.
- Decks are interleaved and new cards are woven among reviews.
- Multiple choice never counts as "Easy", because recognising an answer is easier than recalling it.
- Set your GRE exam date in **More** and GRE gaps are capped so each word is seen several more times before the test.
- Cards you keep forgetting trigger a prompt to reword them.
- **Practice** has drills, weak words, this week's words and study ahead. They never change the schedule, but every answer is tracked.
- **Learn** gives new words a first schedule after you try to recall them: right first time starts the gap at a day, otherwise they return within minutes.

## Things to know on iPhone

- **Voices**: for the best voices, download one in Settings > Accessibility > Spoken Content > Voices (for example Samantha). Pick it in **More > Voices**. Words are read with a US English voice by default, since the GRE is an American exam.
- iOS pauses speech when the screen locks.
- The first tap on a speaker button may be silent while iOS unlocks audio; tap again.

## Updating the app

Change the files, push to GitHub, and increase `VERSION` in `sw.js` (for example `tubecards-v4`) so phones pick up the new version.

## Backups

**More > Full backup (JSON)** saves everything (cards, progress, answers, settings). **Restore from a backup** puts it back. **Export cards (CSV)** gives you the card text only.

## Files

```
index.html, css/app.css, manifest.webmanifest, sw.js, icons/
js/firebase-config.js    your Firebase details
js/srs.js                scheduling and queue building
js/csv.js                import and export
js/practice.js           fill-the-blank and sentence checking
js/questions.js          GRE-style question bank
js/stats.js              analytics
js/store.js              app data and saving
js/views/                the screens
firestore.rules          database security rules
tests/                   automated tests (run: npm test, needs Node 20+)
```
