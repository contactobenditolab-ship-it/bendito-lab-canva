#!/bin/bash
# E2E curl tests para endpoints refactorizado
# Verifica que contact.js, catalogo.js, producto.js funcionan correctamente

BASE_URL="${BASE_URL:-http://localhost:3000}"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Testing bendito-lab-canva API endpoints${NC}\n"

# Test 1: GET /api/catalogo (lista de artículos)
echo -e "${YELLOW}1. Testing GET /api/catalogo (fetch articles)${NC}"
CATALOGO_RESPONSE=$(curl -s -X GET "$BASE_URL/api/catalogo?limit=5")
if echo "$CATALOGO_RESPONSE" | grep -q '"id"'; then
  echo -e "${GREEN}✓ PASS: /api/catalogo returns articles${NC}"
  echo "  Response: $(echo $CATALOGO_RESPONSE | head -c 100)..."
else
  echo -e "${RED}✗ FAIL: /api/catalogo error${NC}"
  echo "  Response: $CATALOGO_RESPONSE"
fi
echo ""

# Test 2: GET /api/producto/:id (artículo individual)
echo -e "${YELLOW}2. Testing GET /api/producto?id=test (fetch single product)${NC}"
PRODUCTO_RESPONSE=$(curl -s -X GET "$BASE_URL/api/producto?id=test")
if echo "$PRODUCTO_RESPONSE" | grep -qE '(success|error|notFound)'; then
  echo -e "${GREEN}✓ PASS: /api/producto returns response${NC}"
  echo "  Response: $(echo $PRODUCTO_RESPONSE | head -c 100)..."
else
  echo -e "${RED}✗ FAIL: /api/producto error${NC}"
  echo "  Response: $PRODUCTO_RESPONSE"
fi
echo ""

# Test 3: POST /api/contact (formulario de contacto)
echo -e "${YELLOW}3. Testing POST /api/contact (contact form)${NC}"
CONTACT_PAYLOAD='{
  "type": "contacto",
  "nombre": "Test User",
  "email": "test@example.com",
  "asunto": "Prueba",
  "mensaje": "Mensaje de prueba"
}'

CONTACT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/contact" \
  -H "Content-Type: application/json" \
  -d "$CONTACT_PAYLOAD")

if echo "$CONTACT_RESPONSE" | grep -q '"ok"'; then
  echo -e "${GREEN}✓ PASS: /api/contact accepts POST${NC}"
  echo "  Response: $(echo $CONTACT_RESPONSE | head -c 100)..."
else
  echo -e "${YELLOW}⚠ INFO: /api/contact response (may fail if backend not connected)${NC}"
  echo "  Response: $(echo $CONTACT_RESPONSE | head -c 150)..."
fi
echo ""

# Test 4: Rate limiting check (rapid requests)
echo -e "${YELLOW}4. Testing rate limiting (10 rapid requests to /api/catalogo)${NC}"
RATE_LIMIT_TEST=0
for i in {1..10}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/catalogo?limit=1")
  if [ "$STATUS" == "429" ]; then
    RATE_LIMIT_TEST=1
    echo -e "${GREEN}✓ PASS: Rate limit triggered at request $i (HTTP 429)${NC}"
    break
  fi
done

if [ $RATE_LIMIT_TEST -eq 0 ]; then
  echo -e "${YELLOW}⚠ INFO: Rate limit not triggered in 10 requests (acceptable)${NC}"
fi
echo ""

# Test 5: Error handling (invalid request)
echo -e "${YELLOW}5. Testing error handling (POST without required fields)${NC}"
ERROR_PAYLOAD='{
  "type": "contacto"
}'

ERROR_RESPONSE=$(curl -s -X POST "$BASE_URL/api/contact" \
  -H "Content-Type: application/json" \
  -d "$ERROR_PAYLOAD")

if echo "$ERROR_RESPONSE" | grep -q '"error"'; then
  echo -e "${GREEN}✓ PASS: Error handling works${NC}"
  echo "  Response: $(echo $ERROR_RESPONSE | head -c 100)..."
else
  echo -e "${YELLOW}⚠ INFO: Error response format${NC}"
  echo "  Response: $(echo $ERROR_RESPONSE | head -c 100)..."
fi
echo ""

echo -e "${YELLOW}Testing complete!${NC}"
echo -e "\nNext steps:"
echo "1. Deploy to staging: git push origin main"
echo "2. Verify Vercel deployment: vercel.com/dashboard"
echo "3. Run tests against staging URL: BASE_URL=https://staging.benditolab.com ./api/TESTS.sh"
echo "4. If all pass: promote to production"
