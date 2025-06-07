# Usa una imagen oficial de Node.js con versión mínima 18
FROM node:18

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia los archivos package.json y package-lock.json primero para aprovechar la cache
COPY package*.json ./

# Instala las dependencias
RUN npm install

# Copia el resto de los archivos del proyecto
COPY . .

# Expón el puerto (ajústalo si usas otro en tu index.js)
EXPOSE 3000

# Comando por defecto para iniciar el server
CMD ["npm", "start"]
