import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Escucha en la red local, no solo localhost — asi se puede probar desde el telefono.
    host: true,
  },
});
