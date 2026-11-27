#!/bin/bash
# The start of a rented machine that speaks a film's lines in Fish Audio Drama 3 (docs/films.md, "A narration"):
# fetches the audio.cpp server and the model, and starts two speech servers on 8080 and 8081, which a voice's
# `servers` in scripts/voice.mjs then names. It was run on Runpod as a pod of one A100-SXM4-80GB, image
# nvidia/cuda:12.8.1-runtime-ubuntu22.04, a 60 GB disk, ports 8080/http and 8081/http, this text given base64
# in the environment (SETUP_B64) and the command bash -c 'echo "$SETUP_B64" | base64 -d > /setup.sh && bash
# /setup.sh'; the servers are then https://<pod>-8080.proxy.runpod.net and -8081. They have no password: the
# pod is deleted once the lines are spoken. A server holds its own copy of Q4_K_S, about 25 GB of the card by
# estimate (the key used could not read the pod's log, so it was never measured).
# What it says goes to the container's log. A Windows checkout holds this file with CRLF line ends, which bash
# on the machine reads as part of each command: turn them into LF before encoding it.
set -u
say () { echo "[setup $(date -u +%H:%M:%S)] $*"; }
say "start"
nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader
apt-get update -qq >/dev/null && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq curl ca-certificates libssl3 libgomp1 >/dev/null
say "packages in"
mkdir -p /w/bin /w/models
cd /w
curl -sSL --retry 5 -o bin.tgz https://github.com/0xShug0/audio.cpp/releases/download/v0.9.6/audio-v0.9.6-bin-ubuntu-x64-cuda12.8-colab.tar.gz
tar -xzf bin.tgz -C bin
SERVER=$(find /w/bin -name audiocpp_server -type f | head -1)
chmod +x "$SERVER"
say "server at $SERVER"
ldd "$SERVER" | grep -i "not found" && say "MISSING LIBRARIES above"
# The model, with its size reported every 30 s while it comes
MODEL=/w/models/drama-3-backbone-8bit-experts-Q4_K_S.gguf
( while [ ! -f /w/models/.done ]; do sleep 30; say "model $(du -BM "$MODEL" 2>/dev/null | cut -f1)"; done ) &
curl -sSL --retry 5 -C - -o "$MODEL" https://huggingface.co/Jmica/Drama-3-GGUF/resolve/main/drama-3-backbone-8bit-experts-Q4_K_S.gguf
touch /w/models/.done
say "model in: $(du -BM "$MODEL" | cut -f1)"
for PORT in 8080 8081; do
  cat > /w/server$PORT.json <<JSON
{
  "host": "0.0.0.0",
  "port": $PORT,
  "backend": "cuda",
  "device": 0,
  "threads": 4,
  "lazy_load": true,
  "max_loaded_models": 1,
  "log_request_body": false,
  "models": [
    {
      "id": "drama3",
      "family": "fish_drama3",
      "path": "$MODEL",
      "task": "tts",
      "mode": "offline",
      "session_options": {
        "moe_cpu_expert_layers": 0,
        "fish_drama3.context_length": 4096,
        "fish_drama3.perf_mode": "cuda_perf"
      }
    }
  ]
}
JSON
  nohup "$SERVER" --config /w/server$PORT.json --log --log-file /w/server$PORT.log > /w/server$PORT.out 2>&1 &
  say "server $PORT started, pid $!"
done
sleep 5
for PORT in 8080 8081; do say "health $PORT: $(curl -s -m 5 http://127.0.0.1:$PORT/health | head -c 300)"; done
say "READY"
# Keep the container alive and pass the servers' logs on
tail -n +1 -F /w/server8080.log /w/server8081.log /w/server8080.out /w/server8081.out
