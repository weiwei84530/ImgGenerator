`sample.mp4` is a synthetic solid-color H.264 clip for local browser playback tests. It contains no user or API-generated media.

Generated with FFmpeg:

```sh
ffmpeg -f lavfi -i color=c=0x426b5a:s=128x224:r=10:d=0.6 -c:v libx264 -pix_fmt yuv420p -movflags +faststart sample.mp4
```
