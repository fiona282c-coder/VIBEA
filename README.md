# VIBEA

VIBEA is a GitHub-Pages-friendly bilingual beauty web app prototype with real camera capture and client-side face landmark analysis.

## Features

- Camera capture + upload
- On-device face landmark analysis with MediaPipe Face Landmarker
- Approximate symmetry, proportions, bone/jaw, visible skin-tone evenness and feature-harmony scores
- Makeup Top 1 recommendation
- 8 makeup styles with the requested finish tips
- Makeup tutorials with external links
- Simple virtual lipstick/blush try-on
- After-makeup image check
- Personal makeup bag + compatible-look matching
- Semi-automatic makeup bag photo intake (user confirms categories to avoid false brand recognition)
- Product filters by budget, style, skin type and category
- Outfit recommendations with official brand links
- Product reviews with obvious sponsored-content heuristics
- Learning/progress tracking
- Beauty ingredient/safety news links
- Chinese / English switch
- Local-only storage for progress, bag and reviews

## Privacy / important limitation

This GitHub Pages version does **not** upload photos to a VIBEA server. Photos are processed in-browser. Analysis reports, progress, reviews and bag contents use `localStorage`; the original face photo is not persisted after refresh.

Face scores are image-based 2D estimates and are **not** biometric identification, medical diagnosis, or an objective measure of attractiveness. Golden-ratio references are approximate only.

## Run locally

Because the face analysis module loads an ES module and model assets, use a local web server rather than opening `index.html` with `file://`.

```bash
cd vibea-web
python3 -m http.server 8000
```

Then open:

`http://localhost:8000`

Camera access works on `localhost` and HTTPS. GitHub Pages uses HTTPS, so camera access is supported there.

## Publish on GitHub Pages

1. Copy all files in this folder into your `glowly-web` repository (you can keep that repository name even though the brand is now VIBEA).
2. Commit and push to `main`.
3. Repository → Settings → Pages.
4. Source: `Deploy from a branch`.
5. Branch: `main`, folder: `/ (root)`.
6. Save.

Your current repo URL would normally publish to:

`https://fiona282c-coder.github.io/glowly-web/`

## Files

- `index.html` — app structure
- `style.css` — responsive editorial UI
- `data.js` — looks, products, outfits, news, translations
- `face-analysis.js` — MediaPipe face analysis logic
- `script.js` — navigation, camera, try-on, filters, reviews, progress, localStorage

## External services

Face landmarks load the MediaPipe model from Google/CDN at runtime. If the user is offline or the CDN is blocked, face analysis will not run.
