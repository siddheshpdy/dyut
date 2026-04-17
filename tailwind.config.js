/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dyut-board': '#880808', // Deep crimson velvet
        'dyut-safe': '#b45309',  // Deeper golden-orange for better contrast
        'charcoal': '#121212',
        'gold': '#fbbf24',
        'ruby': '#e11d48',
        'sapphire': '#3b82f6',
        'emerald': '#10b981',
        'amber': '#fbbf24',
        // Map existing piece colors to new jewel tones temporarily to avoid breaking current UI
        'piece-yellow': '#fbbf24', // Amber/Gold
        'piece-black': '#121212',  // Charcoal Obsidian
        'piece-green': '#10b981',  // Emerald
        'piece-blue': '#3b82f6',   // Sapphire
        'piece-outline': '#ffffff', 
      },
      fontFamily: {
        'display': ['"Cinzel"', 'serif'],
        'sans': ['"Inter"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}