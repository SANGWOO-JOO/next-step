import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 개발 중에는 /api와 로그인 주소를 Spring Boot(8080)로 넘깁니다.
// 로그인 쿠키가 5173에 붙도록 구글 콜백(/login/oauth2/code/google)도 여기를 거친다.
// Host를 바꾸지 않아야 스프링이 redirect_uri를 localhost:5173으로 만든다
const auth = { target: 'http://localhost:8080', changeOrigin: false }

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080',
      '/oauth2': auth,
      '/login/oauth2': auth,
      '/logout': auth,
    },
  },
})
