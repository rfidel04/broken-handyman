# Broken Handyman

A standalone Electron app for turning spoken ideas into documents and scripts. Built for a quick hackathon prototype and accessible writing with less typing.

## Run

Requires Node.js 22.12+ (or 20.19+) and npm.

```sh
npm install
npm start
```

Open **Settings** and add your Gemini and ElevenLabs API keys. No keys are required for **Try a sample without keys**, which streams a predefined example locally; it does not generate AI output or transcribe speech.

## Workflow

- **Document / Code** controls the output format. The source stays editable. Documents have a formatted Markdown preview; code has an Open in an app panel.
- **Write my words** transcribes directly into the artifact when you pause.
- **Follow my instructions** sends each completed speech segment as an instruction to Gemini. Pause after a complete request. The microphone stops during generation; press Start speaking again for the next request.
- Typed instructions work too. Ask for a first draft, then request a revision.
- **Undo** restores the draft from before an AI request or dictation segment. **Stop** interrupts generation; Undo restores the previous artifact.
- **Save file** exports Markdown or source through the native save dialog. Change the suggested extension when exporting a language other than Python. Command/Ctrl+S also opens Save.
- The last artifact is automatically restored on the next launch. Document and Code have independent artifacts, instructions, transcripts, undo histories and voice settings. Switching restores that workspace. Both are saved locally between launches. Switching is paused while generating, recording or opening an external app. Existing single-draft data is migrated to its last selected mode; the other workspace starts empty.

## Keys and data

Gemini: https://aistudio.google.com/app/apikey
ElevenLabs: Developers → API Keys in https://elevenlabs.io

Keys are encrypted using Electron safeStorage and saved in the operating system's application-data folder, outside this repository. The renderer receives only a temporary ElevenLabs transcription token. Gemini requests run in Electron's main process. Keys are never stored in the source tree.

Drafts are stored locally as plain text in the application-data folder. While listening, audio goes to ElevenLabs. Generating or revising sends the instruction and current artifact to Gemini. This app does not run generated scripts. API service quotas and billing apply.

The Gemini model name is configurable in Settings. The default for new installations is `gemini-3.1-flash-lite`, based on the model catalog checked during setup; select a model available to your API account if necessary.

## Build a Mac app

```sh
npm run package
```

The unsigned `.app` is produced under `release/mac*`. Public distribution requires signing/notarization. The source can be pushed to a GitHub repository; `.gitignore` excludes dependencies, builds and environment files. The source repository is https://github.com/rfidel04/broken-handyman.

## Architecture

React + Vite editor, Electron main process with a narrow isolated preload bridge, ElevenLabs Scribe Realtime speech input, and Gemini streaming generation. Remote HTML is never executed. AI-generated Markdown is rendered without raw HTML; links in previews are inactive.

## Prototype limits

One code artifact and one document, Markdown rather than Word page layout, no PDF/DOCX export yet, no voice selection of a paragraph, no background/global microphone shortcut, no automatic execution of code. Microphone permissions and real provider calls require testing with your keys on your computer. Demo mode only verifies local preview behavior.

## Verification

`npm test` checks the editor and speech pipeline. Speech checks use a synthetic microphone and a local mock connection: they exercise the production audio processor, PCM packet delivery, dictation, reconnect, quota errors, and microphone cleanup without calling a provider. Live provider access still depends on valid keys and account access.

## Model picker

Switch models using the main-screen dropdown, or choose one in Settings and save. Choices include Gemini 3.1 Flash-Lite, 3.5 Flash-Lite, 3.6 Flash, and 3.8 Flash; Pro models are excluded. New installations default to 3.1 Flash-Lite; existing selections are preserved. Selection is saved locally and applied to the next request. Free-tier availability does not override the Google API project’s billing tier or quotas. Model and pricing information checked against https://ai.google.dev/gemini-api/docs/pricing during setup.

## Open generated code in another app

In Code mode, the right pane detects MATLAB and Cursor in /Applications or ~/Applications. Pick a file type (automatic detection can be overridden), then click the app. MATLAB requires .m. Choose another app opens the native Applications picker. Every handoff saves a unique copy of the latest source under the app-data Generated Code folder and opens that file with the selected application. Show saved code in Finder reveals a fresh export. Code edits made externally do not sync back into Broken Handyman. External apps open in their own windows; the panel does not embed or control them.
