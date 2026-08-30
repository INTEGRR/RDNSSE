import { useCallback, useEffect, useRef, useState } from 'react'

interface OrientationEventWithCompass extends DeviceOrientationEvent {
  webkitCompassHeading?: number
}

export interface HeadingState {
  /** Compass heading in degrees (0 = North), null if unavailable */
  heading: number | null
  /** iOS needs an explicit permission tap before events fire */
  needsPermission: boolean
  requestPermission: () => void
}

/**
 * Device compass heading. iOS delivers `webkitCompassHeading` (true heading)
 * after DeviceOrientationEvent.requestPermission(); Android/Chrome delivers
 * absolute alpha via `deviceorientationabsolute`.
 */
export function useHeading(gpsCourse: number | null): HeadingState {
  const [heading, setHeading] = useState<number | null>(null)
  const [needsPermission, setNeedsPermission] = useState(false)
  const gotEvent = useRef(false)

  const attach = useCallback(() => {
    const handler = (e: DeviceOrientationEvent) => {
      const webkit = (e as OrientationEventWithCompass).webkitCompassHeading
      if (typeof webkit === 'number' && !Number.isNaN(webkit)) {
        gotEvent.current = true
        setHeading(webkit)
      } else if (e.alpha != null && (e.absolute || 'ondeviceorientationabsolute' in window)) {
        gotEvent.current = true
        setHeading((360 - e.alpha) % 360)
      }
    }
    const evt = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation'
    window.addEventListener(evt as 'deviceorientation', handler)
    return handler
  }, [])

  useEffect(() => {
    const D = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
    if (typeof D?.requestPermission === 'function') {
      setNeedsPermission(true)
      return
    }
    attach()
  }, [attach])

  const requestPermission = useCallback(() => {
    const D = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
    D.requestPermission?.()
      .then(state => {
        if (state === 'granted') {
          setNeedsPermission(false)
          attach()
        }
      })
      .catch(() => {})
  }, [attach])

  // fallback: GPS movement course when no compass events arrive
  const effective = heading ?? (gotEvent.current ? heading : gpsCourse)

  return { heading: effective, needsPermission, requestPermission }
}
