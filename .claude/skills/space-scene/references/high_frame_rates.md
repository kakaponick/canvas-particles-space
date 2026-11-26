# High frame rates

`fps` goes up to 240. Web players stop at 60, so a faster film is for a display that fast or for slow
motion: a 120 fps film played at 30 is the whole scene four times slower.

- The scene is stepped once a frame there. It is the same motion as the 60 fps film, with other frames:
  stars and particles are born at other moments.
- 4K and frame rates above 60 are encoded on the graphics card too. Through the browser's own encoder the
  quality is a quantizer, so the file takes what the picture needs: at the default quality 4K at 60 fps is
  about 105 Mbit/s, 4K at 120 fps about 140, 1080p at 240 fps about 95. Through ffmpeg it is the bitrate the
  quality names, counted for 60 fps at most and spread over the faster frames.
- A render through the tools goes to the disk as it is encoded, so its size is bound by the disk, not by
  the browser's memory. Only a film saved by hand with `download` is put together in the page.
- The stream names the H.264 level its size and rate need (6.0 for 4K at 120 fps, 6.1 at 180). Chrome
  plays it, though it drops frames of 4K at 180 fps (36 of 363 in two seconds of the minute-long film);
  a television or a phone may stop at level 5.2, so check the device the film is for.
