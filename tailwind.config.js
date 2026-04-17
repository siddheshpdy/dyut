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
        // --- CORE GAME BOARD ---
        // A rich, deep velvet red. It maintains the dark, easy-on-the-eyes depth 
        // you wanted from #5A3300, but is undeniably red.
        'dyut-board': '#6b241c',

        // A warm, muted copper-orange. It provides clear contrast for safe zones 
        // without glaring.
        'dyut-safe': '#c26214',

        // A very dark burgundy for the center square. This creates depth and makes 
        // your "GOAL" text highly readable.
        'dyut-goal': '#421410',

        // --- BACKGROUNDS & PANELS ---
        'charcoal': '#161616',   // Deep charcoal. Far softer on the eyes than pure black.
        'panel-bg': '#242424',   // Use this for the right-side box to cleanly separate it from the background.

        // --- TYPOGRAPHY & ICONS ---
        'gold': '#eab308',       // A softer, more natural gold. Highly readable, less eye-piercing.

        // --- THEMATIC & UI COLORS ---
        'ruby': '#f43f5e',       // A brighter, rose-red to pop against the velvet board.
        'sapphire': '#38bdf8',   // A lighter, sky-blue for better contrast on all surfaces.
        'emerald': '#4ade80',    // A more vibrant green to stand out from red/orange.
        'amber': '#facc15',      // A bright, rich yellow to strongly contrast the orange safe zone.

        // --- GAME PIECES ---
        'piece-yellow': '#facc15', // Unified with new 'amber'
        'piece-black': '#9ca3af',  // A much lighter "silver" gray that is clearly visible.
        'piece-green': '#4ade80',  // Unified with new 'emerald'
        'piece-blue': '#38bdf8',   // Unified with new 'sapphire'
        'piece-outline': '#e5e5e5', // A soft, off-white for highlights. Pure white (#ffffff) causes haloing.
      },
      fontFamily: {
        'display': ['"Cinzel"', 'serif'],
        'sans': ['"Inter"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}