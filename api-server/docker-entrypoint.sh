#!/bin/sh
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
  node prisma/seed.prod.js 2>&1 | tee /tmp/seed.log
  SEED_EXIT_CODE=${PIPESTATUS[0]}
  if [ $SEED_EXIT_CODE -ne 0 ]; then
    # Check if the error is about unique constraint (already seeded)
    if grep -q "Unique constraint\|unique_violation\|duplicate key" /tmp/seed.log; then
      echo "Database already seeded (this is OK)"
    else
      echo "Warning: Seeding failed with unexpected error (exit code: $SEED_EXIT_CODE)"
      echo "This may indicate a problem, but continuing to start the server..."
    fi
  else
    echo "Database seeding completed successfully"
  fi
  rm -f /tmp/seed.log
else
  echo "Warning: seed.prod.js not found, skipping seeding"
fi

# Start the application
echo "Starting application..."
exec "$@"
