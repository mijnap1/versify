# Versify

A minimal listening room built with Next.js App Router, React, TypeScript, and Tailwind CSS. Floating glass search, an album sleeve and rotating record, synchronized lyrics, and standalone playback controls sit on a gradient sampled from the current artwork.

Each fresh page load searches a changing international Apple music catalog pool and randomly checks candidates against LRCLIB. A starter must have at least five distinct timed vocal lines spanning at least 30 seconds. Verified lyric data is returned with the track and reused immediately, not fetched twice. This is broad catalog discovery, not uniform sampling of every song worldwide. If candidates fail, Space Song and Let It Happen are checked as fallbacks. If no timed lyrics can be verified, an honest service error is shown instead. Playback remains paused until requested.

## Run

Create a local `.env.local` using the variable names in `.env.example` and add your own key. Real `.env` files, build output, and dependencies are excluded from Git. Never commit API keys. Deployment environment variables must be configured separately in the hosting dashboard.

```sh
npm install
npm run dev
```

Open http://localhost:3000. Use Node.js 22.18 or newer, including for the dependency-free TypeScript tests.

The four featured songs have built-in YouTube video IDs and need no API key. For automatic YouTube matching of other search results, set `YOUTUBE_API_KEY` in `.env.local` (see `.env.example`) to a server-side key with YouTube Data API v3 enabled. Restart the server after changing it. Without a key, any song can be paired with a YouTube URL using **Connect audio**. The key never reaches the browser. Apply quota limits and appropriate restrictions in Google Cloud before public deployment.

## Structure

```text
app/
  page.tsx                 Listening room and shared React state
  layout.tsx               Metadata and application shell
  globals.css              Tailwind, responsive layout, motion
  api/search/route.ts      Apple catalog search proxy
  api/lyrics/route.ts      LRCLIB lookup and recording matching
  api/video/route.ts       Optional YouTube search (server-side key)
  api/artwork/route.ts     Allowlisted artwork proxy for canvas color sampling
components/
  SearchBar.tsx            Debounced search and keyboard selection
  LyricViewer.tsx          Highlighting, auto-scroll, click-to-seek
  PlayerControls.tsx       Transport, progress, repeat, volume
  Glass.tsx                Liquid-glass surfaces and reduced-motion handling
hooks/
  useYouTubePlayer.ts      SDK lifecycle and authoritative playback clock
lib/
  lyrics.ts               LRC parser, active-line lookup, URL validation
  lyrics.test.ts          Timing and URL validation checks
  artwork.ts              Small canvas-sample palette extraction
  tracks.ts               Track types and featured catalog
  video-match.ts          Lyric/audio candidate ranking by title and duration
public/covers/            Featured album artwork from Apple catalog
public/vinyl.png          User-supplied record image
```

## Dependencies

Runtime: `next`, `react`, `react-dom`, `lucide-react`, `liquid-glass-react`. Typography: locally hosted `@fontsource-variable/manrope`. Styling: `tailwindcss`, `@tailwindcss/postcss`. Development: `typescript`, Node/React/YouTube type definitions. The YouTube SDK loads from YouTube on demand. The glass library provides full displacement in Chromium and partial effects in Safari/Firefox.

## Synchronization

`useYouTubePlayer` reads the real player's current time every 200 ms. Play/pause and buffering state come from SDK events, so the lyric clock stops naturally when playback stalls. `LyricViewer` uses a binary search for the last LRC timestamp less than or equal to `currentTime + offset`. It moves the active line into position with an interruptible 560 ms eased scroll; nearby lines fade and soften according to their distance. Clicking a line seeks to `line.time - offset`; seeking before playback begins is queued until the SDK is ready. Manual scrolling suspends following, which resumes smoothly when the next timestamped lyric line becomes active. Source connection and timing remain available through the dialog shown for missing or failed audio sources.

The heart saves the current song in browser localStorage. The folder beside search opens favorites for selection or removal. These are local saves, not account-synced; storage failures are reported in the favorites dialog.

LRC parsing supports multiple timestamps, fractional seconds, empty instrumental cues, and offset tags. Unsynchronized lyrics are displayed without false timing; unavailable lyrics and instrumentals have separate states. Lyrics are fetched live, never hardcoded or bundled.

## Playback details

- Playback starts only after a user action. If a browser blocks automatic playback after SDK initialization, press Play again.
- The album sleeve stays visible during playback. The existing YouTube iframe is rendered offscreen and driven by the standalone controls.
- YouTube availability depends on geography, embed permissions, and the viewer's browser. Another source can be connected when a video is unavailable.
- A music video may have a different intro from the album recording. Prefer official audio and use the timing adjustment when needed. Automatic matching cannot guarantee an identical master.
- Automatic matching searches lyric/audio uploads and ranks candidates by recording length, penalizing music videos and altered versions.
- The supplied vinyl image rotates only during actual playback.
- A 32-pixel canvas sample extracts the album's primary and secondary colors. A same-origin, Apple-CDN-only proxy keeps searched artwork readable by canvas. Cached artwork is also sampled on mount. Monochrome or missing artwork uses a neutral palette.
- Reduced motion disables the vinyl rotation and glass elasticity, and makes lyric seeking immediate. Reduced transparency and increased contrast preferences have their own styles.
- Live search, lyrics, and YouTube require an internet connection. Service failures display retry or source-selection actions.

## Verify

```sh
npm test
npm run typecheck
npm run build
```

The production build uses Next.js's supported Webpack option because Turbopack's CSS worker cannot bind its internal port in this workspace's build sandbox.

Use Chrome for playback testing. The Codex in-app browser did not initialize YouTube embeds; that failure path exposes a timeout and reset/source controls. Unit checks cover lyric timing, video URL validation, and artwork palette extraction.

Provider references: [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference), [LRCLIB](https://lrclib.net/docs), [Apple Search API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/Searching.html).
