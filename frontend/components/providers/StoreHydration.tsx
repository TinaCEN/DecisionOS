'use client'

import { useEffect } from 'react'

import { useDecisionStore } from '../../lib/store'

export function StoreHydration(): null {
  useEffect(() => {
    void useDecisionStore.persist.rehydrate()
  }, [])

  return null
}
