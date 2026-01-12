#!/bin/bash

# ================================================================================
# TEST DE ENDPOINTS - ELI GOMEZ API
# ================================================================================

API_BASE_URL="https://us-central1-eli-gomez-web.cloudfunctions.net/apiv2"

echo "🧪 INICIANDO TESTS DE ENDPOINTS"
echo "================================"
echo ""

# ================================================================================
# TEST 1: GET /pedidos (Todos los pedidos)
# ================================================================================
echo "📋 TEST 1: Obtener TODOS los pedidos"
echo "------------------------------------"
echo "Endpoint: GET $API_BASE_URL/pedidos?limite=10"
echo ""

curl -X GET "$API_BASE_URL/pedidos?limite=10" \
  -H "Content-Type: application/json" \
  -w "\n\nStatus: %{http_code}\n" \
  -s | jq '.' 2>/dev/null || curl -X GET "$API_BASE_URL/pedidos?limite=10"

echo ""
echo ""

# ================================================================================
# TEST 2: GET /pedidos?estado=pendiente
# ================================================================================
echo "📋 TEST 2: Obtener pedidos con estado 'pendiente'"
echo "------------------------------------------------"
echo "Endpoint: GET $API_BASE_URL/pedidos?estado=pendiente&limite=5"
echo ""

curl -X GET "$API_BASE_URL/pedidos?estado=pendiente&limite=5" \
  -H "Content-Type: application/json" \
  -w "\n\nStatus: %{http_code}\n" \
  -s | jq '.' 2>/dev/null || curl -X GET "$API_BASE_URL/pedidos?estado=pendiente&limite=5"

echo ""
echo ""

# ================================================================================
# TEST 3: GET /pedido/:id (Un pedido específico)
# ================================================================================
echo "📋 TEST 3: Obtener UN pedido específico"
echo "--------------------------------------"
echo "Nota: Requiere un ID válido de pedido"
echo "Endpoint: GET $API_BASE_URL/pedido/test"
echo ""

curl -X GET "$API_BASE_URL/pedido/test" \
  -H "Content-Type: application/json" \
  -w "\n\nStatus: %{http_code}\n" \
  -s | jq '.' 2>/dev/null || curl -X GET "$API_BASE_URL/pedido/test"

echo ""
echo "================================"
echo "✅ Tests completados"
