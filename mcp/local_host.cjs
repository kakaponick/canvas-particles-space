// The film server's browser on a machine that encodes outside the browser: Electron with one hidden window,
// whose page is given an encoder (local_encoder.cjs). A page in Chrome cannot write into another program;
// here it writes each frame straight into ffmpeg's input. The film server starts this in place of Chrome
// (findLocalEncoder in space_mcp.mjs) and drives it the same way, over the DevTools socket that its
// command line asks for.
const { app, BrowserWindow } = require('electron')
const path = require('node:path')

app.whenReady().then(() => {
  const window = new BrowserWindow({
    show: false,
    width: 1280,
    height: 720,
    // The encoder is put on the page's own window, so the page hands it frames without a copy
    webPreferences: {
      preload: path.join(__dirname, 'local_encoder.cjs'),
      contextIsolation: false,
      sandbox: false,
      backgroundThrottling: false
    }
  })
  void window.loadURL('about:blank')
})
app.on('window-all-closed', () => app.quit())
