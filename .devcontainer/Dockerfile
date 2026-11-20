FROM mcr.microsoft.com/devcontainers/rust:1-bookworm

# Tauri 2 system dependencies : https://tauri.app/start/prerequisites/#linux
RUN apt-get update && apt-get install -y --no-install-recommends \
      libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev \
      libayatana-appindicator3-dev librsvg2-dev libdbus-1-dev pkg-config \
    && rm -rf /var/lib/apt/lists/*

USER vscode
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/home/vscode/.bun/bin:${PATH}"
