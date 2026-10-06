#!/bin/bash

# GENX Production Setup Script
set -e

echo "🚀 Setting up GENX for production..."

# Generate secrets
echo "🔐 Generating secure secrets..."
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 16)
DB_PASSWORD=$(openssl rand -hex 16)

# Create .env file
cat > .env << EOF
NODE_ENV=production
DATABASE_URL=postgresql://genx:${DB_PASSWORD}@db:5432/genx_cloud
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
DB_PASSWORD=${DB_PASSWORD}
EOF

echo "✅ Secrets generated and saved to .env"

# Start services
echo "🐳 Starting Docker containers..."
docker-compose -f docker-compose.yml -f docker-compose.backup.yml up -d

# Wait for services
echo "⏳ Waiting for services to be ready..."
sleep 10

# Run health check
echo "🏥 Running health check..."
curl -f http://localhost:4000/health || echo "⚠️  API not ready yet"

echo ""
echo "✅ GENX production setup complete!"
echo ""
echo "📝 Important:"
echo "  - Backup your .env file"
echo "  - Configure your domain in nginx.conf"
echo "  - Set up SSL certificates"
echo "  - Review backup schedule in docker-compose.backup.yml"
echo ""
echo "🔗 Access points:"
echo "  - Desktop App: http://localhost"
echo "  - API: http://localhost:4000"
echo "  - API Health: http://localhost:4000/health"
echo ""
