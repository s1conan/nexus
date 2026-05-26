"use client"

import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase"
import { useDictionary } from "./dictionary-provider"
import { notify } from "@/lib/notifications"

interface UserProfile {
  id: string
  username: string
  email: string
  full_name: string | null
  phone: string | null
  role: string
  permissions: any | null
  is_active: boolean
  last_login: string | null
  preferred_language: string | null
}

interface AuthContextType {
  user: any | null
  profile: UserProfile | null
  loading: boolean
  signOut: () => Promise<void>
  changeLanguage: (newLang: any) => Promise<void>
  hasPermission: (module: string, action: 'view' | 'insert' | 'edit' | 'delete' | 'print') => boolean
  passwordResetRequired: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ 
  children,
  initialUser = null,
  initialProfile = null
}: { 
  children: ReactNode,
  initialUser?: any | null,
  initialProfile?: UserProfile | null
}) {
  const supabase = useMemo(() => createClient(), [])
  
  const [user, setUser] = useState<any | null>(initialUser)
  const [profile, setProfile] = useState<UserProfile | null>(initialProfile)
  const [loading, setLoading] = useState(!initialUser)
  const [resolvedPermissions, setResolvedPermissions] = useState<any>(null)
  const { dict, lang, setLanguage } = useDictionary()
  
  // Refs for stable state tracking across renders
  const isUpdatingLang = useRef(false)
  const isManualSignOut = useRef(false)
  const isSyncing = useRef(false)
  const lastSyncedUserId = useRef<string | null>(initialUser?.id || null)
  const userRef = useRef<any>(initialUser)
  const dictRef = useRef<any>(dict)

  // Keep refs in sync with latest state
  useEffect(() => { dictRef.current = dict }, [dict])

  const passwordResetRequired = useMemo(() => {
    return !!(user && profile && profile.last_login === null)
  }, [user, profile])

  const getProfile = useCallback(async (userId: string) => {
    try {
      console.log("Auth: [DEBUG] getProfile starting for:", userId)
      
      const fetchPromise = supabase
        .from('profiles')
        .select(`*, role_permissions ( permissions )`)
        .eq('auth_id', userId)
        .maybeSingle()

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Profile fetch timeout")), 5000)
      )

      const response = await Promise.race([fetchPromise, timeoutPromise]) as any
      const { data, error } = response

      if (error) {
        console.error("Auth: [DEBUG] Profile fetch error:", error)
        return null
      }

      if (data) {
        console.log("Auth: [DEBUG] Profile fetch success")
        const rawProfile = data as any
        const permissions = rawProfile.permissions || rawProfile.role_permissions?.permissions || {}
        setResolvedPermissions(permissions)
        return rawProfile as UserProfile
      }
      return null
    } catch (e) {
      console.error("Auth: [DEBUG] Error in getProfile:", e)
      return null
    }
  }, [supabase])

  const syncProfile = useCallback(async (userData: any, force = false) => {
    if (isSyncing.current && !force) {
      console.log("Auth: [DEBUG] syncProfile already in progress, skipping")
      return
    }
    
    // Skip if user is same and not a forced update
    if (!force && userData?.id === lastSyncedUserId.current && profile) {
      console.log("Auth: [DEBUG] User already synced, skipping")
      setLoading(false)
      return
    }

    console.log("Auth: [DEBUG] syncProfile starting for:", userData?.id || "null")
    isSyncing.current = true
    
    try {
      if (userData) {
        userRef.current = userData
        setUser(userData)
        lastSyncedUserId.current = userData.id
        
        const p = await getProfile(userData.id)
        setProfile(p)
        
        if (p?.preferred_language && !isUpdatingLang.current) {
          console.log("Auth: [DEBUG] Syncing UI to DB preference:", p.preferred_language)
          setLanguage(p.preferred_language as any)
        }
      } else {
        console.log("Auth: [DEBUG] syncProfile clearing state")
        userRef.current = null
        lastSyncedUserId.current = null
        setUser(null)
        setProfile(null)
        setResolvedPermissions(null)

        if (typeof window !== 'undefined') {
          const path = window.location.pathname
          const isPublic = path === "/" || path === "/signup" || path === "/reset-password" || path.startsWith("/auth/")
          if (!isPublic) window.location.href = "/"
        }
      }
    } catch (e) {
      console.error("Auth: [DEBUG] syncProfile error:", e)
    } finally {
      isSyncing.current = false
      setLoading(false)
      console.log("Auth: [DEBUG] syncProfile finished")
    }
  }, [getProfile, setLanguage, profile])

  const changeLanguage = useCallback(async (newLang: any) => {
    if (newLang === lang || isUpdatingLang.current) return
    if (profile && profile.preferred_language === newLang) {
      setLanguage(newLang)
      return
    }

    console.log(`Auth: [DEBUG] changeLanguage to: "${newLang}"`)
    isUpdatingLang.current = true
    setLanguage(newLang)

    if (userRef.current && profile) {
      try {
        const { error } = await supabase.from('profiles').update({ preferred_language: newLang }).eq('auth_id', userRef.current.id)
        if (!error) setProfile(prev => prev ? { ...prev, preferred_language: newLang } : null)
      } finally {
        isUpdatingLang.current = false
      }
    } else {
      isUpdatingLang.current = false
    }
  }, [lang, profile, setLanguage, supabase])

  // Initial Sync and Listener Setup
  useEffect(() => {
    let mounted = true

    if (initialUser && !userRef.current) {
      console.log("Auth: [DEBUG] Applying initial SSR state")
      const perms = initialProfile?.permissions || (initialProfile as any)?.role_permissions?.permissions || {}
      setResolvedPermissions(perms)
      userRef.current = initialUser
      lastSyncedUserId.current = initialUser.id
    } else if (!initialUser) {
      console.log("Auth: [DEBUG] Checking manual session...")
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (mounted) syncProfile(user)
      }).catch(() => {
        if (mounted) setLoading(false)
      })
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      console.log(`Auth: [DEBUG] Event: ${event}`)

      if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
        await syncProfile(session?.user || null, event === 'USER_UPDATED')
      } else if (event === 'SIGNED_OUT') {
        if (!isManualSignOut.current && userRef.current) {
          notify.warning(dictRef.current.MSG_SESSION_EXPIRED, dictRef.current.MSG_RELOGIN)
        }
        await syncProfile(null)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, initialUser, initialProfile, syncProfile])

  const signOut = useCallback(async () => {
    try {
      isManualSignOut.current = true
      setUser(null)
      setProfile(null)
      setResolvedPermissions(null)
      if (typeof window !== 'undefined') {
        Object.keys(localStorage).forEach(key => { if (key.startsWith('nids_')) localStorage.removeItem(key) })
      }
      await supabase.auth.signOut()
    } finally {
      window.location.href = "/"
    }
  }, [supabase])

  const hasPermission = useCallback((module: string, action: 'view' | 'insert' | 'edit' | 'delete' | 'print'): boolean => {
    if (!resolvedPermissions) return false
    const modulePerms = resolvedPermissions[module]
    return modulePerms ? modulePerms[action] === true : false
  }, [resolvedPermissions])

  const value = useMemo(() => ({
    user, profile, loading, signOut, changeLanguage, hasPermission, passwordResetRequired
  }), [user, profile, loading, signOut, changeLanguage, hasPermission, passwordResetRequired])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider")
  return context
}
