"use client"

import { useEffect, useRef, useCallback } from "react"

type BarcodeScannerProps = {
  active: boolean
  onScan: (value: string) => void
  onError?: (message: string) => void
  className?: string
}

const SCANNER_ID = "stock-barcode-reader"

export function BarcodeScanner({
  active,
  onScan,
  onError,
  className,
}: BarcodeScannerProps) {
  const scannerRef = useRef<InstanceType<
    Awaited<typeof import("html5-qrcode")>["Html5Qrcode"]
  > | null>(null)
  const mountedRef = useRef(true)
  const onScanRef = useRef(onScan)
  const onErrorRef = useRef(onError)
  onScanRef.current = onScan
  onErrorRef.current = onError

  const lastScanRef = useRef<{ value: string; at: number } | null>(null)
  const COOLDOWN_MS = 2000

  const handleScan = useCallback((decodedText: string) => {
    if (!mountedRef.current || !onScanRef.current || !decodedText?.trim())
      return
    const now = Date.now()
    const last = lastScanRef.current
    if (last && last.value === decodedText && now - last.at < COOLDOWN_MS)
      return
    lastScanRef.current = { value: decodedText, at: now }
    onScanRef.current(decodedText)
  }, [])

  const handleError = useCallback((message: string) => {
    if (mountedRef.current && onErrorRef.current) {
      onErrorRef.current(message)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!active) {
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => scannerRef.current?.clear())
          .catch(() => {})
          .finally(() => {
            scannerRef.current = null
          })
      }
      return
    }

    let cancelled = false

    async function startScanner() {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import(
        "html5-qrcode"
      )

      if (cancelled || !mountedRef.current) return

      const element = document.getElementById(SCANNER_ID)
      if (!element) return

      const scanner = new Html5Qrcode(SCANNER_ID, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
        verbose: false,
      })

      scannerRef.current = scanner

      const config = {
        fps: 10,
        qrbox: { width: 280, height: 120 },
        aspectRatio: 1.777778,
        disableFlip: false,
      }

      try {
        await scanner.start(
          { facingMode: "environment" },
          config,
          handleScan,
          handleError
        )
      } catch (err) {
        handleError(err instanceof Error ? err.message : "Camera access failed")
      }
    }

    startScanner()

    return () => {
      cancelled = true
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => scannerRef.current?.clear())
          .catch(() => {})
          .finally(() => {
            scannerRef.current = null
          })
      }
    }
  }, [active, handleScan, handleError])

  if (!active) return null

  return (
    <div className={className}>
      <div
        id={SCANNER_ID}
        className="min-h-[200px] w-full overflow-hidden rounded-lg bg-muted"
      />
    </div>
  )
}
