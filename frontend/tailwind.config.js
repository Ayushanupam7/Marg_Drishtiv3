/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gov: {
          navy: '#0c2340',      // Official Indian Gov / NIC Navy Blue
          header: '#0f2942',    // Header deep navy
          nav: '#0a192f',       // Dark blue sidebar
          navHover: '#132847',  // Sidebar hover
          navActive: '#1b3a61', // Sidebar active
          bg: '#f4f6f9',        // Clean light grey background
          card: '#ffffff',      // Pure white card
          border: '#e2e8f0',    // Subtle border
          textPrimary: '#1e293b', // Slate 800
          textSecondary: '#64748b', // Slate 500
          accent: '#1e40af',    // Deep blue accent
          green: '#15803d',     // Subtle green for normal / success
          greenLight: '#dcfce7',// Light green badge
          yellow: '#b45309',    // Amber for moderate
          yellowLight: '#fef3c7',
          orange: '#c2410c',    // High congestion
          orangeLight: '#ffedd5',
          red: '#b91c1c',       // Severe / emergency red
          redLight: '#fee2e2'
        }
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
