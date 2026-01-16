#!/bin/bash

# Script para cerrar Metro/Node processes
echo "🔴 Cerrando Metro y procesos Node..."

pkill -f "metro" || true
pkill -f "node.*8081" || true
pkill -f "npm run start" || true
pkill -f "react-native start" || true

lsof -i :8081 | grep -v COMMAND | awk '{print $2}' | xargs kill -9 2>/dev/null || true
lsof -i :8081 | grep -v COMMAND | awk '{print $2}' | xargs kill -9 2>/dev/null || true

echo "✅ Metro y procesos cerrados"
