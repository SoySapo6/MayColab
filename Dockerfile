FROM ghcr.io/puppeteer/puppeteer:21.5.2

# Cambiar al directorio de trabajo
WORKDIR /usr/src/app

# Cambiar a usuario root temporalmente para instalar dependencias
USER root

# Copiar archivos de package
COPY package*.json ./

# Instalar dependencias
RUN npm install --production

# Copiar código fuente
COPY . .

# Cambiar permisos
RUN chown -R pptruser:pptruser /usr/src/app

# Volver al usuario pptruser
USER pptruser

# Exponer puerto
EXPOSE 3000

# Variables de entorno para Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Comando para iniciar
CMD ["node", "index.js"]
