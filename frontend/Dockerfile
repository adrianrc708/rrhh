# Usamos una imagen ligera de Node.js
FROM node:20-alpine

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiamos los archivos de dependencias primero para optimizar la caché
COPY package*.json ./

# Instalamos las dependencias de React/Vite
RUN npm install

# Copiamos el resto del código fuente
COPY . .

# Exponemos el puerto de Vite
EXPOSE 5173

# Arrancamos el servidor de desarrollo exponiendo el host a la red de Docker
CMD ["npm", "run", "dev", "--", "--host"]