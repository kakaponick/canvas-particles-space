#!/bin/bash
# The start of a rented machine that speaks a film's lines in Fish Audio Drama 3 (docs/films.md, "A narration"):
# fetches the audio.cpp server and the models, and starts speech servers on 8080, 8081 and on, which a voice's
# `servers` in scripts/voice.mjs then names (scripts/drama3_bench.mjs compares the model's settings on them). It
# runs on Runpod as a pod of image nvidia/cuda:12.8.1-runtime-ubuntu22.04 with a 60 GB disk, ports 8080/http and
# on, and 8082/http... see DRAMA3_SET; this text is given base64 in the environment (SETUP_B64) with the command
# bash -c 'echo "$SETUP_B64" | base64 -d > /setup.sh && bash /setup.sh'; the servers are then
# https://<pod>-<port>.proxy.runpod.net. They have no password: the pod is deleted once the lines are spoken.
#   DRAMA3_SET  the servers, comma-separated, each <package>:<perf mode>, the package one of Jmica/Drama-3-GGUF's
#               (Q4_K_S 22.9 GiB, Q3_K_S 18.9 GiB, Q2_K 15.9 GiB, with 8-bit backbone) and the mode cuda_perf
#               or off; each server holds its own copy. Default: Q4_K_S:cuda_perf,Q4_K_S:cuda_perf
# The servers take the ports from 8080 up, skipping 8082, which serves /w/pub: the stages with their seconds
# (stages.txt), the card (gpu.txt), its memory every 3 s (smi.txt) and the servers' logs, since an API key may not
# read the pod's log. The prebuilt Linux CUDA server is built for compute capability 7.5 to 9.0, so it does not
# run on Blackwell cards. A Windows checkout holds this file with CRLF line ends, which bash on the machine reads
# as part of each command: turn them into LF before encoding it.
set -u
SET=${DRAMA3_SET:-Q4_K_S:cuda_perf,Q4_K_S:cuda_perf}
mkdir -p /w/bin /w/models /w/pub
stage () { echo "$(date -u +%s) $*" >> /w/pub/stages.txt; echo "[setup $(date -u +%H:%M:%S)] $*"; }
stage "start"
nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader > /w/pub/gpu.txt
apt-get update -qq >/dev/null && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq curl ca-certificates libssl3 libgomp1 python3-minimal >/dev/null
stage "packages"
( cd /w/pub && nohup python3 -m http.server 8082 >/dev/null 2>&1 & )
( while true; do nvidia-smi --query-gpu=memory.used,memory.total,utilization.gpu --format=csv,noheader,nounits > /w/pub/smi.tmp && mv /w/pub/smi.tmp /w/pub/smi.txt; sleep 3; done ) &
cd /w
curl -sSL --retry 5 -o bin.tgz https://github.com/0xShug0/audio.cpp/releases/download/v0.9.6/audio-v0.9.6-bin-ubuntu-x64-cuda12.8-colab.tar.gz
tar -xzf bin.tgz -C bin
SERVER=$(find /w/bin -name audiocpp_server -type f | head -1)
chmod +x "$SERVER"
ldd "$SERVER" | grep -i "not found" && stage "MISSING LIBRARIES"
stage "server fetched"
IFS=',' read -ra ENTRIES <<< "$SET"
for PACKAGE in $(printf '%s\n' "${ENTRIES[@]}" | cut -d: -f1 | sort -u); do
  FILE=drama-3-backbone-8bit-experts-$PACKAGE.gguf
  curl -sSL --retry 5 -C - -o "/w/models/$FILE" "https://huggingface.co/Jmica/Drama-3-GGUF/resolve/main/$FILE"
  stage "model $PACKAGE fetched $(du -BM "/w/models/$FILE" | cut -f1)"
done
PORT=8080
for ENTRY in "${ENTRIES[@]}"; do
  PACKAGE=${ENTRY%%:*}
  MODE=${ENTRY#*:}
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
      "path": "/w/models/drama-3-backbone-8bit-experts-$PACKAGE.gguf",
      "task": "tts",
      "mode": "offline",
      "session_options": {
        "moe_cpu_expert_layers": 0,
        "fish_drama3.context_length": 4096,
        "fish_drama3.perf_mode": "$MODE"
      }
    }
  ]
}
JSON
  nohup "$SERVER" --config /w/server$PORT.json --log --log-file /w/pub/server$PORT.log > /w/pub/server$PORT.out 2>&1 &
  stage "server $PORT: $PACKAGE $MODE"
  PORT=$((PORT + 1))
  [ $PORT -eq 8082 ] && PORT=8083
done
stage "servers started"
tail -n +1 -F /w/pub/server8080.log /w/pub/server8080.out
