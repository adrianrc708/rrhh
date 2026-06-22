import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({

    plugins: [react()],
    server: {
        host: true, // Vital para la exposición de puertos en Docker
        port: 5173
    }
})
