#!/bin/sh
set -e

echo "Waiting for postgres..."
# Use a simple connection test with timeout
timeout=30
counter=0
until npx prisma db execute --stdin --schema prisma/schema.prisma <<SQL 2>/dev/null || [ $counter -eq $timeout ]; do
SELECT 1;
SQL
  counter=$((counter + 1))
  sleep 1
done

if [ $counter -eq $timeout ]; then
  echo "Postgres connection timeout after ${timeout}s"
  exit 1
fi

echo "Postgres is ready"

# Run database migrations
echo "Running database migrations..."
npx prisma migrate deploy --schema prisma/schema.prisma

# Run database seeding (use production seed file)
echo "Running database seed..."
if [ -f "prisma/seed.prod.js" ]; then
  node prisma/seed.prod.js || {
    echo "Seeding failed or skipped (this is OK if database is already seeded)"
  }
else
  echo "Warning: seed.prod.js not found, skipping seeding"
fi

# Start the application
echo "Starting application..."
exec "$@"
