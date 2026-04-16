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
        'dyut-board': '#b41010',
        'dyut-safe': '#8f0c0c',
        'piece-yellow': '#fde047', // Brightened for > 3:1 contrast
        'piece-black': '#171717',
        'piece-green': '#4ade80',  // Brightened for > 3:1 contrast
        'piece-blue': '#60a5fa',   // Brightened for > 3:1 contrast
        'piece-outline': '#ffffff', // Required for dark pieces like black
      }
    },
  },
  plugins: [],
}