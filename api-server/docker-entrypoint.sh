#!/bin/bash
set -e

echo "Waiting for postgres..."
# Use a simple connection test with timeout
timeout=30
counter=0
until npx prisma db execute --stdin <<< 'SELECT 1;' --schema prisma/schema.prisma 2>/dev/null || [ $counter -eq $timeout ]; do
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
  if node prisma/seed.prod.js; then
    echo "Database seeding completed successfully"
  else
    echo "Warning: Seeding failed (exit code: $?)"
    echo "This may be OK if the database is already seeded"
    echo "Continuing to start the server..."
  fi
else
  echo "Warning: seed.prod.js not found, skipping seeding"
fi

# Start the application
echo "Starting application..."
exec "$@"
