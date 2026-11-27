// A fall into the Mandelbrot set told in words: the set whole, the rule that draws it, then a dive that
// speeds up past the depth where ordinary numbers give out, hovers there, and falls on to 10^40 and more.
film({ target: 'spiral', palette: 'classic', fps: 30 })
set({ fade: 1, rate: 0 })

shot('the set', () => {
  to({ fade: 0 }, 2)
  caption('The Mandelbrot set', 4, { at: 'top', size: 0.05 })
  wait(2)
  caption('z → z^{2} + c', 3, { at: 'bottom', font: 'noto', size: 0.05 })
  wait(3)
})

shot('the dive', () => {
  caption('×10^{#{depth:0}}', { at: 'bottom', font: 'noto', size: 0.045 })
  to({ rate: 1.2 }, 4, 'in')
  wait(9)
  caption('Past here an ordinary number has no more digits', 4, { at: 'top', reveal: 'words', width: 0.7 })
  to({ rate: 0 }, 2, 'out')
  wait(2)
})

shot('deeper', () => {
  caption('×10^{#{depth:0}}', { at: 'bottom', font: 'noto', size: 0.045 })
  caption('The same spiral, at every depth', 4, { at: 'top' })
  meanwhile(() => { to({ spin: 8 }, 6) })
  to({ rate: 2 }, 3, 'in')
  wait(9)
})

to({ fade: 1 }, 1.5)
