# 🎨 Aarti App UI/UX Design System

This document defines the visual identity and interface guidelines for the Searchable Aarti Website.

---

## 🏛️ Visual Identity
The goal is to blend modern "Glassmorphism" with traditional Indian spiritual aesthetics.

### 🎨 Color Palette
| Element | Hex Code | Purpose |
| :--- | :--- | :--- |
| **Primary Saffron** | `#da6d00` | Primary buttons, active states, icons. |
| **Deep Maroon** | `#800000` | Header text, borders, secondary accents. |
| **Cream/Amber** | `#FFF8E1` | Main background (soft on eyes for low light). |
| **Dark Grey** | `#2D2D2D` | Body text for high readability. |
| **Pure White** | `#FFFFFF` | Card backgrounds to create depth. |

### 🔡 Typography
* **Primary (Devanagari):** `Mukta` (Google Fonts)
    * *Weight 400:* Body text.
    * *Weight 700:* Titles and headings.
* **Secondary (Latin/English):** `Inter` or `System UI`.
* **Line Height:** `1.6` to ensure Marathi diacritics (kana/matra) don't overlap.

---

## 📱 Component Design

### 1. Sticky Header
* **Blur Effect:** `backdrop-filter: blur(8px)` with a semi-transparent cream background.
* **Elevation:** Subtle shadow (`shadow-sm`) to separate it from the scrolling content.

### 2. Search & Filters
* **Search Input:** Rounded corners (`rounded-full`), focused border color in **Saffron**.
* **Filter Chips:**
    * *Inactive:* Saffron border with transparent background.
    * *Active:* Solid Saffron background with white text.

### 3. Aarti Cards
* **Style:** Clean cards with a subtle border (`border-amber-100`).
* **Interactive State:** On hover/tap, a very light saffron glow.
* **Lyrics Display:** * Use a fixed-width container for the lyrics.
    * **Font Scaling:** Range from `14px` to `24px` based on user preference.

---

## 🛠️ Tailwind Configuration Snippet
Add these to your `tailwind.config.js` to use the theme easily:

```javascript
theme: {
  extend: {
    colors: {
      saffron: '#da6d00',
      maroon: '#800000',
      cream: '#FFF8E1',
    },
    fontFamily: {
      mukta: ['Mukta', 'sans-serif'],
    },
  },
}

🌓 Dark Mode Specs (Spiritual Night)
Background: #1A1A1A

Card Background: #262626

Text: #E5E7EB (Light Grey)

Accent: Gold (#cea00d) instead of Maroon.
