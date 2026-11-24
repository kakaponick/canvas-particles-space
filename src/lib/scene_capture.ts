// Frames the agent API asked for. The WebGL context does not preserve its drawing buffer, so a frame can
// only be read in the same task that drew it: the animation loop answers these right after it renders.
// While nothing is asked this costs the loop one length check.

interface CaptureRequest {
  resolve: (dataUrl: string) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export const captureRequests: CaptureRequest[] = []

// Resolves with the next drawn frame as a PNG data URL; rejects if no frame is drawn in time, which happens
// while the scene is paused, the tab is hidden or the WebGL context is lost
export function requestFrameCapture (timeoutMs = 3000): Promise<string> {
  return new Promise((resolve, reject) => {
    const request: CaptureRequest = {
      resolve,
      reject,
      timer: setTimeout(() => {
        const index = captureRequests.indexOf(request)
        if (index >= 0) captureRequests.splice(index, 1)
        reject(new Error('No frame was drawn: the scene is paused, the tab is hidden or the WebGL context is lost'))
      }, timeoutMs)
    }
    captureRequests.push(request)
  })
}

export function answerFrameCaptures (canvas: HTMLCanvasElement) {
  const dataUrl = canvas.toDataURL('image/png')
  for (const request of captureRequests) {
    clearTimeout(request.timer)
    request.resolve(dataUrl)
  }
  captureRequests.length = 0
}
