import React, { useState } from 'react'
import { useAlerts } from '../hooks/useAlerts'
import { formatAmount, formatDate } from '../utils/format'
import { PLATFORM_INFO, PLATFORM_ORDER } from '../utils/normalize'

interface AlertsPageProps {
  currentPin: string
  initialQuery?: string
  initialPrice?: number
}

export const AlertsPage: React.FC<AlertsPageProps> = ({
  currentPin,
  initialQuery = '',
  initialPrice,
}) => {
  const { alerts, notifications, loading, error, addAlert, removeAlert } = useAlerts()
  const [query, setQuery] = useState(initialQuery)
  const [targetPrice, setTargetPrice] = useState(
    initialPrice ? Math.floor(initialPrice * 0.9).toString() : ''
  )
  const [pinDraft, setPinDraft] = useState<string | null>(null)
  const pin = pinDraft ?? currentPin
  const [platform, setPlatform] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const price = parseFloat(targetPrice)
    if (!query.trim() || !Number.isFinite(price) || price <= 0) return
    setSubmitting(true)
    try {
      const ok = await addAlert(
        query.trim(),
        price,
        pin.trim() || currentPin,
        platform || undefined
      )
      if (ok) {
        setQuery('')
        setTargetPrice('')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="flex flex-col gap-12">
      <form onSubmit={submit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2>Watch a price</h2>
          <p className="text-muted">
            The backend rechecks these automatically. Price drops appear below while this page is open.
          </p>
        </div>

        <div className="grid gap-x-6 gap-y-4 border-t-2 border-rule-ink pt-6 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
          <label className="flex flex-col gap-1.5">
            <span className="label">Item</span>
            <input
              required
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="amul taaza 500ml"
              className="field"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="label">Under (₹)</span>
            <input
              required
              type="number"
              min={1}
              step="any"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              placeholder="25"
              className="field tabular-nums"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="label">Pincode</span>
            <input
              required
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, ''))}
              className="field tabular-nums"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="label">Store</span>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="field"
            >
              <option value="">Any store</option>
              {PLATFORM_ORDER.map((key) => (
                <option key={key} value={key}>
                  {PLATFORM_INFO[key].name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={submitting} aria-busy={submitting} className="btn">
            {submitting ? 'Saving…' : 'Start watching'}
          </button>
          {error && <p className="text-sm text-error">{error}</p>}
        </div>
      </form>

      {notifications.length > 0 && (
        <div className="flex flex-col">
          <h3 className="max-w-none border-b-2 border-accent pb-2">
            Price drops ({notifications.length})
          </h3>
          <ul className="m-0 flex list-none flex-col p-0">
            {notifications.map((notification) => (
              <li key={notification.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-rule py-3">
                <span className="font-medium">{notification.product_name}</span>
                <span className="figure text-lg text-accent">{formatAmount(notification.price)}</span>
                <span className="text-sm text-muted">
                  {PLATFORM_INFO[notification.platform]?.name ?? notification.platform}, under {formatAmount(notification.target_price)}, {notification.pin} · {formatDate(notification.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col">
        <h3 className="max-w-none border-b-2 border-rule-ink pb-2">
          Watching{alerts.length > 0 && ` (${alerts.length})`}
        </h3>

        {loading ? (
          <p className="label pt-4">Reading…</p>
        ) : alerts.length === 0 ? (
          <p className="pt-4 text-muted">You are not watching anything yet.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {alerts.map((alert) => (
              <li key={alert.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-rule py-4">
                <span className="min-w-0 basis-full sm:basis-0 sm:flex-1">
                  <span className="line-clamp-2 font-medium">{alert.product_query}</span>
                  <span className="mt-0.5 block text-sm text-muted">
                    {[
                      alert.platform ? PLATFORM_INFO[alert.platform]?.name : 'any store',
                      alert.pin,
                      alert.last_checked ? `checked ${formatDate(alert.last_checked)}` : 'not yet checked',
                    ].join(', ')}
                  </span>
                </span>

                <span className="flex shrink-0 items-baseline gap-2">
                  <span className="label">Under</span>
                  <span className="figure text-lg text-ink">{formatAmount(alert.target_price)}</span>
                </span>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => removeAlert(alert.id)}
                  className="link ml-auto sm:ml-0"
                >
                  Stop
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
