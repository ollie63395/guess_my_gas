# GuessMyGas

**GuessMyGas** is an AI-powered app that helps users make smarter decisions about when and where to refuel. By predicting future fuel prices, analyzing price trends, and tracking nearby stations across multiple vendors, GuessMyGas saves users time and money every time they fill up.

### ✨ Features

⛽ Predicts whether you should refuel now or wait (fuel price forecasting)

⛽ Supports multiple fuel types (E10, U91, PULP, Diesel, etc.)

⛽ Tracks fuel prices at 7-Eleven and other major fuel vendors in Melbourne

⛽ Uses GPS location to show the cheapest nearby station

⛽ Historical data logging for model training and user insight

⛽ Future plans: smart price lock alerts, multi-brand comparison, savings tracker

### 🌐 Tech Stack (Planned)

Python (data collection, API integration, ML models)

Flask (backend API)

SQLite or PostgreSQL (data storage)

React or Streamlit (frontend dashboard)

Scheduled tasks / Cron for data scraping

### 🚀 Project Roadmap

Phase 1: Fuel price collection + GPS-based station lookup (in progress)

Phase 2: AI model for fuel price prediction (PULP first, then others)

Phase 3: Smart alerts, price lock suggestions, and user customization

Phase 4: Multi-vendor expansion and route planning

### 📅 Status

Currently in early development stage. Using 7-Eleven APIs to collect data for price prediction.

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
