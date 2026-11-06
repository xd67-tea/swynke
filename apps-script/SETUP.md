# Setting up the Swynke site editor

The editor is a Google Apps Script web app attached to a Google Sheet. It shows the real site with every piece of text editable in place. **Save** stores a version in the Sheet (the last 10 are kept). **History** loads an earlier version. **Publish** sends the saved version to GitHub, and Vercel puts it live about a minute later.

Anyone with **edit access to the Sheet** can use the editor. Nobody else can.

## 1. Make the Sheet (2 minutes)

1. In Google Drive, create a new Google Sheet called **Swynke site editor**.
2. Share it (Editor access) with the people who should be able to change the site.

## 2. Add the code (3 minutes)

1. In the Sheet, open **Extensions > Apps Script**.
2. Delete everything in `Code.gs`, then paste in the whole of [`Code.gs`](https://github.com/xd67-tea/swynke/blob/main/apps-script/Code.gs).
3. Click **+** next to Files, choose **HTML**, name it `Editor` (no extension), and paste in the whole of [`Editor.html`](https://github.com/xd67-tea/swynke/blob/main/apps-script/Editor.html).
4. Save (the disk icon).

## 3. Give it permission to publish (3 minutes)

1. Go to https://github.com/settings/personal-access-tokens/new
2. Name: `Swynke site editor`. Expiration: 1 year (set a reminder to renew it).
3. Repository access: **Only select repositories**, then pick **xd67-tea/swynke**.
4. Permissions > Repository permissions > **Contents: Read and write**. Leave everything else as is.
5. Click **Generate token** and copy it. Don't paste it anywhere else.
6. Back in Apps Script, open **Project Settings** (the gear), scroll to **Script properties**, and add:
   - `GITHUB_TOKEN` = the token you copied
   - `GITHUB_REPO` = `xd67-tea/swynke`
7. Save script properties.

People who can edit the Sheet can open the script and see this token. It can only change the swynke repo.

## 4. Run setup once (1 minute)

1. In the Apps Script editor, pick **setup** in the function menu at the top and click **Run**.
2. Google asks for permission (Sheets, and connecting to an external service). Allow it.
3. The Sheet now has three tabs: **Versions**, **Published** and **Current text**. Version 1 is the text that's live today.

## 5. Deploy the editor (2 minutes)

1. Click **Deploy > New deployment**. Choose type **Web app**.
2. Execute as: **User accessing the web app**.
3. Who has access: **Anyone with a Google account** (only Sheet editors will get past the first screen).
4. Click **Deploy**, approve permissions, and copy the **Web app URL**. That's the editor. Bookmark it and share it with your editors.

Each editor approves Google's permission screen the first time they open it.

## Using it

- Click any dashed box to edit. **Shift+Enter** starts a new line. Pasting brings in plain text only.
- **Problem mixes** edits the specialities and percentages behind the 'Who it takes' panel. Edit the problem names on the page itself.
- **Save** keeps a version. Add a note in 'What changed?' so History is easy to read.
- If someone else saves while you're editing, the editor asks whether to keep yours or load theirs. Nothing is lost either way: both stay in History.
- **Publish…** saves first if needed, then puts that version live. The live site updates in about a minute.
- **Preview** turns editing off so you can click links and try the page.

## When the code changes

Design and layout changes are made in `src/template.html` in the repo. The editor picks them up within five minutes, with no change needed in Apps Script. If `Code.gs` or `Editor.html` ever change, paste the new versions in and use **Deploy > Manage deployments > Edit > New version**.
