// The encoder the film server's browser gives its page (local_host.cjs loads this before the page;
// src/lib/frame_pack.ts says what the page is given): ffmpeg, encoding with the graphics card's own H.264
// encoder as the frames are written to it. A frame arrives as NV12, from the top row down. The sound, if
// there is one, ffmpeg reads from its address and lays under the picture.
// The frames reach ffmpeg over a socket of this machine and not through its standard input: a pipe passes
// about 600 MB a second here, 48 frames of 4K, and a render written into one took an eighth longer.
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const net = require('node:net')

// How hard the card's encoder tries, p1 the fastest to p7. Measured on an RTX 3070 at a film's bitrate: the
// picture is the same to the third decimal of SSIM from p1 to p7, and a render with p1 takes as long as
// one with p4, since the encoder is not what holds it
const PRESET = 'p4'
// What ffmpeg asks the system to hold of the frames on their way, in bytes
const SOCKET_BYTES = 4 << 20

window.spaceEncoder = {
  open (job) {
    const ffmpeg = process.env.SPACE_FFMPEG
    if (!ffmpeg) throw new Error('The film server named no ffmpeg (SPACE_FFMPEG)')

    let said = ''
    let left = null
    let child = null
    let socket = null
    let done
    const exited = new Promise(resolve => { done = resolve })
    const leave = state => {
      left ??= state
      done()
    }
    const failure = () => new Error(`ffmpeg stopped${left?.error ? `: ${left.error.message}` : left ? ` with code ${left.code}` : ''}${said.trim() ? `: ${said.trim().slice(0, 600)}` : ''}`)
    const start = from => {
      child = spawn(ffmpeg, [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-f', 'rawvideo', '-pix_fmt', 'nv12', '-s', `${job.width}x${job.height}`, '-r', String(job.fps), '-i', from,
        ...(job.audio ? ['-i', job.audio] : []),
        '-map', '0:v', ...(job.audio ? ['-map', '1:a', '-c:a', 'aac', '-b:a', String(job.audioBitrate)] : []),
        '-c:v', 'h264_nvenc', '-preset', PRESET, '-profile:v', 'high', '-rc', 'vbr', '-b:v', String(job.bitrate),
        '-g', String(Math.max(1, Math.round(job.keyFrameSeconds * job.fps))),
        // What the page's shader made of the colours, written into the stream: BT.709 in the video range,
        // from sRGB (primaries 1, transfer 13, matrix 1)
        '-bsf:v', 'h264_metadata=colour_primaries=1:transfer_characteristics=13:matrix_coefficients=1:video_full_range_flag=0',
        // No longer than the film, whatever the sound's length, and with its index at the start
        '-t', String(job.duration), '-movflags', '+faststart', '-f', 'mp4', job.path
      ], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true })
      child.stderr.on('data', chunk => { said += chunk })
      child.once('error', error => leave({ code: -1, error }))
      child.once('exit', code => leave({ code }))
    }

    // ffmpeg is started once the socket it will read is open, and the first frame waits for it to call
    const joined = new Promise(resolve => {
      const server = net.createServer(connection => {
        server.close()
        socket = connection
        // A write to an encoder that has gone is told by its callback below
        socket.on('error', () => {})
        resolve()
      })
      server.once('error', error => leave({ code: -1, error }))
      server.listen(0, '127.0.0.1', () => start(`tcp://127.0.0.1:${server.address().port}?recv_buffer_size=${SOCKET_BYTES}`))
      void exited.then(() => server.close())
    })
    const ready = Promise.race([joined, exited])

    return {
      write: bytes => ready.then(() => new Promise((resolve, reject) => {
        if (left || !socket) return reject(failure())
        socket.write(bytes, error => error ? exited.then(() => reject(failure())) : resolve())
      })),
      async close () {
        await ready
        socket?.end()
        await exited
        if (left.code !== 0) throw failure()
        return fs.statSync(job.path).size
      },
      cancel () {
        socket?.destroy()
        child?.kill()
        void exited.then(() => fs.rmSync(job.path, { force: true }))
      }
    }
  }
}
