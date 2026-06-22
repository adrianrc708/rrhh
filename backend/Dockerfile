# Imagen ligera oficial de Python
FROM python:3.10-slim

WORKDIR /app

# Instalar dependencias del sistema necesarias para PostgreSQL (psycopg2) y encriptación
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copiar e instalar librerías de Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar todo el código del backend al contenedor
COPY . .

# Exponer el puerto donde corre FastAPI
EXPOSE 8000

# Comando para encender el servidor con auto-recarga
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]