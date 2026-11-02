import { createContext, useContext } from 'react'

const RouteContext = createContext(null)

export function RouteProvider({ value, children }) {
  return <RouteContext.Provider value={value}>{children}</RouteContext.Provider>
}

export function useRoute() {
  const value = useContext(RouteContext)
  if (!value) throw new Error('Route missing')
  return value
}
