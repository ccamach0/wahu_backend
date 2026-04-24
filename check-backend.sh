# Intenta hacer una llamada al backend
echo "Probando endpoints del backend..."

# Prueba 1: Health check
echo "1. Testing /api/health:"
curl -s https://wahu-backend.onrender.com/api/health 2>&1 | head -5

echo ""
echo "2. Testing /api/clans:"
curl -s https://wahu-backend.onrender.com/api/clans 2>&1 | head -5
