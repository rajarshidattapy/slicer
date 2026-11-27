import { useState, useEffect, useCallback } from 'react'

export interface Alert {
  id: number
  product_query: string
  platform?: string | null
  target_price: number
  pin: string
  active: boolean
  created_at: string
  last_checked?: string | null
}

export interface AlertNotification {
  id: number
  alert_id: number
  product_name: string
  platform: string
  price: number
  target_price: number
  pin: string
  created_at: string
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [notifications, setNotifications] = useState<AlertNotification[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAlerts = useCallback(
    (signal?: AbortSignal) =>
      fetch('/alerts', { signal })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`Could not load your alerts (${response.status})`)
          }
          const data: Alert[] = await response.json()
          setAlerts(data)
          setError(null)
        })
        .catch((err: unknown) => {
          if (err instanceof Error && err.name === 'AbortError') {
            return
          }
          const message = err instanceof Error ? err.message : 'Could not load your alerts'
          setError(message)
        })
        .finally(() => {
          if (!signal?.aborted) {
            setLoading(false)
          }
        }),
    []
  )

  const fetchNotifications = useCallback(
    (signal?: AbortSignal) =>
      fetch('/alerts/notifications', { signal })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`Could not load price alerts (${response.status})`)
          }
          const data: AlertNotification[] = await response.json()
          setNotifications(data)
        })
        .catch((err: unknown) => {
          if (!(err instanceof Error && err.name === 'AbortError')) {
            setError(err instanceof Error ? err.message : 'Could not load price alerts')
          }
        }),
    []
  )

  const addAlert = async (
    product_query: string,
    target_price: number,
    pin: string,
    platform?: string
  ): Promise<boolean> => {
    const trimmedQuery = product_query.trim()
    const trimmedPin = pin.trim()
    if (!trimmedQuery || !Number.isFinite(target_price) || target_price <= 0 || trimmedPin.length !== 6) {
      setError('Please provide a valid item name, positive price, and 6-digit pincode')
      return false
    }

    try {
      const response = await fetch('/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_query: trimmedQuery,
          target_price,
          pin: trimmedPin,
          platform: platform || undefined,
        }),
      })
      if (!response.ok) {
        throw new Error('Could not save the alert')
      }
      await fetchAlerts()
      return true
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not save the alert'
      setError(message)
      return false
    }
  }

  const removeAlert = async (alertId: number): Promise<boolean> => {
    const previous = alerts
    setAlerts((prev) => prev.filter((a) => a.id !== alertId))
    try {
      const response = await fetch(`/alerts/${alertId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('Could not delete the alert')
      }
      return true
    } catch (err: unknown) {
      setAlerts(previous)
      const message = err instanceof Error ? err.message : 'Could not delete the alert'
      setError(message)
      return false
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    fetchAlerts(controller.signal)
    fetchNotifications(controller.signal)
    const pollId = window.setInterval(() => {
      fetchAlerts()
      fetchNotifications()
    }, 30_000)
    return () => {
      controller.abort()
      window.clearInterval(pollId)
    }
  }, [fetchAlerts, fetchNotifications])

  return {
    alerts,
    notifications,
    loading,
    error,
    fetchAlerts,
    addAlert,
    removeAlert,
  }
}
