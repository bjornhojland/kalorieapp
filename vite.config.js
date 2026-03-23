import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/kalorieapp/',
})
```

Gem, og kør:
```
git add vite.config.js
git commit -m "Fix vite config"
git push