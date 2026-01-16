#!/bin/bash

# Script para liberar puerto 8081 si está ocupado
echo "🔓 Liberando puerto 8081..."

# Buscar y matar proceso en puerto 8081
PIDS=$(lsof -i :8081 | grep -v COMMAND | awk '{print $2}')

if [ -z "$PIDS" ]; then
    echo "✅ Puerto 8081 ya está libre"
else
    echo "Matando procesos en puerto 8081: $PIDS"
    echo "$PIDS" | xargs kill -9 2>/dev/null || true
    echo "✅ Puerto 8081 liberado"
fi

# Alternativa para matar por nombre
echo "🔴 Cerrando procesos Metro/Node en puerto 8081..."
pkill -f "metro" || true
pkill -f "node.*8081" || true
pkill -f "npm run start" || true

echo "✅ Puerto 8081 completamente libre"
