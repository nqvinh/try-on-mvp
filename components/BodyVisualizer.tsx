import { useEffect, useRef } from 'react'

export default function BodyVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const captureCanvas = async () => {
    if (canvasRef.current) {
      const canvas = canvasRef.current
      const imageData = canvas.toDataURL('image/png')
      
      // Send the image data to our API
      try {
        const response = await fetch('/api/proxy-body-visualizer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ imageData }),
        })
        
        const data = await response.json()
        console.log('Canvas data saved:', data)
      } catch (error) {
        console.error('Error saving canvas data:', error)
      }
    }
  }

  useEffect(() => {
    // Add event listener to capture canvas when it's updated
    const canvas = canvasRef.current
    if (canvas) {
      const observer = new MutationObserver(() => {
        captureCanvas()
      })
      
      observer.observe(canvas, { attributes: true, childList: true, subtree: true })
      
      return () => observer.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      id="body-viewer"
      width={500}
      height={700}
      style={{ width: '500px', height: '700px' }}
    />
  )
} 