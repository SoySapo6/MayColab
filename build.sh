#!/bin/bash

# Script de construcción para Render
echo "🔧 Instalando dependencias del sistema para Puppeteer..."

# Actualizar lista de paquetes
apt-get update

# Instalar dependencias necesarias para Chrome/Chromium
apt-get install -y \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    libxss1 \
    libgconf-2-4 \
    libxtst6 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libatk1.0-0 \
    libcairo-gobject2 \
    libgtk-3-0 \
    libgdk-pixbuf2.0-0

# Instalar Chromium
apt-get install -y chromium-browser

# Instalar dependencias de Node.js
echo "📦 Instalando dependencias de Node.js..."
npm install

echo "✅ Build completado"
