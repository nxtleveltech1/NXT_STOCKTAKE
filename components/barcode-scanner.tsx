"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { ZoomIn, ZoomOut, Focus } from "lucide-react"

type BarcodeScannerProps = {
  active: boolean
  onScan: (value: string) => void
  onError?: (message: string) => void
  className?: string
}

type CameraCapabilities = {
  zoom: { min: number; max: number; step: number } | null
  focusModes: string[]
  torch: boolean
}

const SCANNER_ID = "stock-barcode-reader"

/** Apply advanced camera constraints (zoom, autofocus) to the active video track */
async function applyTrackConstraints(
  videoEl: HTMLVideoElement,
  zoomLevel?: number
): Promise<CameraCapabilities> {
  const caps: CameraCapabilities = { zoom: null, focusModes: [], torch: false }

  const stream = videoEl.srcObject as MediaStream | null
  if (!stream) return caps

  const track = stream.getVideoTracks()[0]
  if (!track) return caps

  const rawCaps = track.getCapabilities?.() as Record<string, unknown> | undefined
  if (!rawCaps) return caps

  // Read capabilities
  if (rawCaps.zoom && typeof rawCaps.zoom === "object") {
    const z = rawCaps.zoom as { min?: number; max?: number; step?: number }
    caps.zoom = {
      min: z.min ?? 1,
      max: z.max ?? 1,
      step: z.step ?? 0.1,
    }
  }

  if (Array.isArray(rawCaps.focusMode)) {
    caps.focusModes = rawCaps.focusMode as string[]
  }

  if (typeof rawCaps.torch === "boolean") {
    caps.torch = rawCaps.torch
  }

  // Build constraint object
  const advanced: Record<string, unknown> = {}

  // Continuous autofocus — critical for barcode scanning
  if (caps.focusModes.includes("continuous")) {
    advanced.focusMode = "continuous"
  }

  // Zoom
  if (caps.zoom && caps.zoom.max > 1) {
    const target = zoomLevel ?? Math.min(2, caps.zoom.max)
    advanced.zoom = Math.max(caps.zoom.min, Math.min(target, caps.zoom.max))
  }

  if (Object.keys(advanced).length > 0) {
    await track.applyConstraints({ advanced: [advanced] } as MediaTrackConstraints)
  }

  return caps
}

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

  const [caps, setCaps] = useState<CameraCapabilities>({
    zoom: null,
    focusModes: [],
    torch: false,
  })
  const [currentZoom, setCurrentZoom] = useState(1)

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

  /** Change zoom on the live track */
  const changeZoom = useCallback(
    async (delta: number) => {
      if (!caps.zoom) return
      const videoEl = document.querySelector(
        `#${SCANNER_ID} video`
      ) as HTMLVideoElement | null
      if (!videoEl) return

      const next = Math.max(
        caps.zoom.min,
        Math.min(currentZoom + delta, caps.zoom.max)
      )
      setCurrentZoom(next)

      try {
        await applyTrackConstraints(videoEl, next)
      } catch {
        // non-critical
      }
    },
    [caps, currentZoom]
  )

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
      setCaps({ zoom: null, focusModes: [], torch: false })
      setCurrentZoom(1)
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
        fps: 15,
        qrbox: { width: 300, height: 140 },
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

        // Apply zoom + continuous autofocus after stream is live
        if (!cancelled && mountedRef.current) {
          const videoEl = document.querySelector(
            `#${SCANNER_ID} video`
          ) as HTMLVideoElement | null

          if (videoEl) {
            try {
              const detected = await applyTrackConstraints(videoEl)
              if (mountedRef.current) {
                setCaps(detected)
                if (detected.zoom) {
                  setCurrentZoom(
                    Math.min(2, detected.zoom.max)
                  )
                }
              }
            } catch {
              // Camera works fine without advanced constraints
            }
          }
        }
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

  const hasAutofocus = caps.focusModes.includes("continuous")
  const hasZoom = caps.zoom !== null && caps.zoom.max > 1

  return (
    <div className={className}>
      <div className="relative">
        <div
          id={SCANNER_ID}
          className="min-h-[200px] w-full overflow-hidden rounded-lg bg-muted"
        />

        {/* Camera capability indicators + zoom controls */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
          {/* Status badges */}
          <div className="flex items-center gap-1.5">
            {hasAutofocus && (
              <span className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-green-400 backdrop-blur-sm">
                <Focus className="h-3 w-3" />
                AF
              </span>
            )}
            {hasZoom && (
              <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-blue-400 backdrop-blur-sm">
                {currentZoom.toFixed(1)}x
              </span>
            )}
          </div>

          {/* Zoom controls */}
          {hasZoom && caps.zoom && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => changeZoom(-caps.zoom!.step * 3)}
                disabled={currentZoom <= caps.zoom.min}
                className="rounded-full bg-black/60 p-1.5 text-white backdrop-blur-sm disabled:opacity-30"
                aria-label="Zoom out"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => changeZoom(caps.zoom!.step * 3)}
                disabled={currentZoom >= caps.zoom.max}
                className="rounded-full bg-black/60 p-1.5 text-white backdrop-blur-sm disabled:opacity-30"
                aria-label="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
