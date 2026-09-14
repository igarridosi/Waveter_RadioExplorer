# 📻 Waveter - Global Radio Explorer

## 🌟 Description
Waveter is a modern web application that allows you to explore and listen to radio stations from around the world. Using the open [Radio Browser](https://www.radio-browser.info) catalogue, you can discover new cultures and music through a clean and user-friendly interface.

## ✨ Features
- 🌍 Search any country, filter by region, search stations by name or genre, spin the random dial
- 🎵 Persistent player bar with live status, volume and saved radios
- 🚀 Built with React; a static site on Netlify plus one edge function that relays http:// streams
- ⚡ Intuitive and responsive interface

## 🔧 Technologies Used
- React
- Vite
- Tailwind CSS
- Radio Browser API
- Vitest

## 🛠️ Development
```bash
npm install
npm run dev          # Vite dev server
npm test             # unit + contract tests against recorded fixtures
npm run test:live    # also runs the catalogue contract against the real API
```
Append `?fixture` to the dev URL (or set `VITE_CATALOGUE=fixture`) to run the UI on recorded data, without network.

See `CONTEXT.md` for the domain vocabulary and `docs/adr/` for architecture decisions.

## 🚀 Demo
Try the live application here: [Waveter](https://waveter.netlify.app)

## 🎧 Special Recommendation
Don't miss out on **A.D.M. Hardstyle Radio** from Assen, The Netherlands! An excellent station offering the best hardstyle beats. Give it a try and let yourself be carried away by its energy!

---
*Made with ❤️ for radio lovers worldwide*
