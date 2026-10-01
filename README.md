# Shree Saibaba Platform 🪔

A modern, spiritually revered multi-temple digital platform for **Shree Sai Baba devotees** and temple management.

Built with **React 19**, **TypeScript**, **Vite**, **Tailwind CSS v4**, **React Router 7**, and **Zustand**.

---

## ✨ Features

- **Devotee Web Portal (`apps/devotee`)**:
  - 🕉️ **Live Darshan & Daily Aartis**: Timezone-aware Kakad, Madhyan, Dhoop, and Shej Aarti schedules with live streams and recordings.
  - 🌺 **Sponsor a Puja**: Comprehensive puja and archana catalogue with sankalpam and family deity offerings.
  - 📜 **Thursday Vrat Tracker**: Digital 9-Thursday Vrat tracker, katha readings, prayers, and stotras.
  - 🍲 **Annadanam Seva**: Meal sponsorship, prasad distribution counter, and community feast tracking.
  - 🏛️ **Places of Worship / Shrines**: Samadhi Mandir, Dwarakamai (*Dhuni*), Chavadi, Lendi Baug (*Nandadeep*), Ganapati Shrine, Dattatreya Shrine, Maruti Shrine, and Shani Shrine with authentic photorealistic iconography.
  - 🪙 **Transparency & Giving**: Open budgets for upcoming festivals, automated tax receipts (501(c)(3), 80G, Gift Aid, CRA), and multi-currency giving.
  - 🌍 **Multi-Temple Support & Global Localization**: Support for English, Hindi, Marathi, Telugu, Tamil, and Gujarati.

- **Temple Operations Console (`apps/admin`)**:
  - 📊 Real-time donation ledgers, receipt generation, and donor relationship management.
  - 🎥 Live aarti stream controls and broadcast management.
  - 📅 Festival and community event budget planner.
  - 📦 Seva inventory, prasad shipping, and fulfilment pipeline.

- **Shared Domain Core (`packages/core`)**:
  - In-memory mock repositories and seed fixtures with zero external backend dependencies.
  - Full TypeScript types, currency formatters, and internationalization dictionaries.

---

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation

```bash
# Clone the repository
git clone https://github.com/balajikarthik2004/saibaba-devotee.git
cd saibaba-devotee

# Install dependencies
npm install
```

### Running Locally

```bash
# Start the Devotee web portal (http://localhost:5173)
npm run dev

# Or run specific workspaces:
npm run dev:devotee    # Devotee portal (port 5173)
npm run dev:admin      # Admin console (port 5174)
```

### Typecheck & Build

```bash
# Typecheck all workspaces
npm run typecheck

# Build for production
npm run build
```

---

## 📁 Repository Structure

```
├── apps/
│   ├── devotee/          # Devotee-facing public web application
│   └── admin/            # Operations & temple administration console
├── packages/
│   └── core/             # Shared domain types, mock data, i18n & business logic
└── docs/                 # Architecture, design system & API documentation
```

---

## 🎨 Design System

- **Color Palette Synergy**:
  - **Sacred Saffron & Ochre**: `#E65100`, `#FF6F00`, `#FFA000` (Kafni robe & perpetual Dhuni flame)
  - **Temple Gold & Amber**: `#FFB300`, `#D4AF37` (Divine illumination & sanctum adornment)
  - **Deep Velvet Crimson**: `#880E4F`, `#B71C1C` (High-contrast temple accents)
  - **Soft Ivory & Cream**: `#FDFBF7`, `#FFF9E6` (Shirdi marble murti reverence)
  - **Midnight Navy**: `#1A2530`, `#0F172A` (Meditative dusk backdrop)

---

## 📄 License

MIT © [Shree Saibaba Platform](https://github.com/balajikarthik2004/saibaba-devotee)
