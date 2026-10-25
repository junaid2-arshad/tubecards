# TubeCards

GRE vocabulary and Italian flashcards for your commute. A static web app: it runs entirely in the browser, is hosted on GitHub Pages, and uses Firebase (free tier) for sign-in and for syncing your cards and answers.

It works in **demo mode** straight away (no sign-in, data stays in that browser). Follow the setup below to turn on sign-in and sync.

## What it does

| You asked for | Where it is |
|---|---|
| Create and edit cards, front and back | **Cards** tab: Add, tap any card to edit. Fields change with the card type |
| Weekly uploads | **Cards > Import** (paste or choose a CSV, TSV or JSON file). Each batch gets a week label, so you can study just this week's cards |
| Quizzing that helps you remember | **Study** tab: spaced repetition (cards return just before you would forget them), mixed decks, multiple choice and flip cards, GRE exam-date mode |
| GRE card: word + sentence on front, meaning on back | GRE card type. The word is underlined inside its sentence. A speaker button next to the word (and its sentence) reads it aloud in English, on the front, on the back, and when you study in reverse (meaning first, then reveal the word) |
| Listen to Italian | **Speak > Listen** plays your sentences hands-free; Italian cards can also speak automatically in Study |
| Read or speak Italian and get feedback | **Speak > Read aloud** (word-by-word feedback) and **Type it** (hear it, type it; silent) |
| Performance analytics | **Stats** tab |
| Every quiz answer tracked | Each answer is stored with time, result, card, and (in multiple choice) the wrong option you picked |
| Login | Firebase email and password, locked to your account |

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
3. Open it once while online so it can save itself for the Tube. After that, cards, quizzes, listening and typing all work offline, and your answers sync when you are back above ground.

## Your weekly routine

1. Ask any AI assistant for next week's words in this format (or edit the templates in **Cards > Import**):

   ```
   deck,type,front,hint,back,notes,tags
   GRE Vocab,gre,ephemeral,"Fame can be ephemeral.",lasting a very short time,"fleeting, transient",
   Italiano,italian,Vorrei un caffè,"Al bar: Vorrei un caffè, per favore.",I would like a coffee,"vorrei = polite 'I want'",bar
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
- **Study** has extra practice (weak cards, this week's cards, study ahead) that never changes the schedule.

## Things to know on iPhone

- **Speech recognition** (Read aloud) sends audio to Apple, so it needs a connection, and Dictation must be on (Settings > General > Keyboard). iOS often blocks it for apps added to the Home Screen; if the microphone button reports an error, open the same link in a normal Safari tab. **Type it** works everywhere.
- **Voices**: for the best voices, download them in Settings > Accessibility > Spoken Content > Voices (Italian, and an English one such as Samantha or Daniel). The app uses whichever you pick in **More > Voices**. GRE words are read with a US English voice by default, since the GRE is an American exam.
- iOS pauses speech when the screen locks, so keep the screen on during a Listen playlist.
- The speaking score shows how well the phone's recogniser understood you. It is a guide for practice, not an examiner, and it cannot judge accent quality.

## Updating the app

Change the files, push to GitHub, and increase `VERSION` in `sw.js` (for example `tubecards-v2`) so phones pick up the new version.

## Backups

**More > Full backup (JSON)** saves everything (cards, progress, answers, settings). **Restore from a backup** puts it back. **Export cards (CSV)** gives you the card text only.

## Files

```
index.html, css/app.css, manifest.webmanifest, sw.js, icons/
js/firebase-config.js    your Firebase details
js/srs.js                scheduling and queue building
js/csv.js                import and export
js/pronounce.js          speaking and typing feedback
js/stats.js              analytics
js/store.js              app data and saving
js/views/                the screens
firestore.rules          database security rules
tests/                   automated tests (run: npm test, needs Node 20+)
```
