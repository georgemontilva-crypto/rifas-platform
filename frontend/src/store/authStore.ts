import { create } from 'zustand'

interface User {
  id: string
  email: string
  fullName: string
  role: 'user' | 'admin' | 'superadmin'
}

interface AuthState {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  setSession: (user: User, accessToken: string) => void
  setAccessToken: (token: string) => void
  logout: () => void
}

// Importante: el accessToken vive SOLO en memoria (no localStorage), para
// reducir la superficie de ataque ante XSS. La sesión persiste vía el
// refresh token en cookie httpOnly que el navegador maneja por su cuenta.
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  setSession: (user, accessToken) => set({ user, accessToken, isAuthenticated: true }),
  setAccessToken: (accessToken) => set({ accessToken }),
  logout: () => set({ user: null, accessToken: null, isAuthenticated: false }),
}))
