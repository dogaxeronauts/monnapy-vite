import { useEffect, useState } from 'react'
import { useIsTogether } from 'react-together'

type CroquetConnectionType = 'connecting' | 'online' | 'fatal' | 'offline'

export const useSessionStatus = (): CroquetConnectionType => {
  const [connectionStatus, setConnectionStatus] = useState<CroquetConnectionType>('offline')
  const isTogether = useIsTogether()

  useEffect(() => {
    const checkConnectionStatus = () => {
      const spinnerOverlay = document.getElementById('croquet_spinnerOverlay')
      const fatalElement = document.querySelector('.croquet_fatal')

      if      (fatalElement)   setConnectionStatus('fatal') //prettier-ignore
      else if (spinnerOverlay) setConnectionStatus('connecting') //prettier-ignore
      else if (isTogether)     setConnectionStatus('online') //prettier-ignore
      else                     setConnectionStatus('offline') //prettier-ignore
    }

    // Initial check
    checkConnectionStatus()

    // Set up observer to watch for changes in the body
    const observer = new MutationObserver(checkConnectionStatus)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    })

    return () => observer.disconnect()
  }, [isTogether])

  return connectionStatus
}

// Hook to hide multisynq loading screen
export const useHideMultisynqLoading = () => {
  const sessionStatus = useSessionStatus()

  useEffect(() => {
    const hideLoadingScreen = () => {
      // Hide the main Croquet spinner overlay
      const spinnerOverlay = document.getElementById('croquet_spinnerOverlay')
      if (spinnerOverlay) {
        spinnerOverlay.style.display = 'none'
      }

      // Also hide any multisynq loading elements
      const multisynqLoadingElements = document.querySelectorAll(
        '[id*="multisynq"], [class*="multisynq"], [id*="croquet"], [class*="croquet"]'
      )
      
      multisynqLoadingElements.forEach((element) => {
        if (element instanceof HTMLElement) {
          element.style.display = 'none'
        }
      })
    }

    // Hide loading screen immediately and set up continuous monitoring
    hideLoadingScreen()

    // Set up observer to continuously hide loading screens as they appear
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
              // Check if the added node is a loading screen
              if (
                node.id?.includes('croquet') ||
                node.id?.includes('multisynq') ||
                node.className?.includes('croquet') ||
                node.className?.includes('multisynq')
              ) {
                node.style.display = 'none'
              }
              
              // Also check children of the added node
              const loadingChildren = node.querySelectorAll(
                '[id*="multisynq"], [class*="multisynq"], [id*="croquet"], [class*="croquet"]'
              )
              loadingChildren.forEach((child) => {
                if (child instanceof HTMLElement) {
                  child.style.display = 'none'
                }
              })
            }
          })
        }
        
        // Re-hide any loading screens that might have appeared
        hideLoadingScreen()
      })
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    })

    return () => observer.disconnect()
  }, [sessionStatus])

  return sessionStatus
}
