#!/bin/bash

# GENX Backup Script
set -e

BACKUP_DIR="/backups/genx"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

echo "Starting backup at $(date)"

# Backup PostgreSQL
echo "Backing up PostgreSQL..."
pg_dump -h db -U genx genx_cloud | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Backup SQLite databases (from desktop clients)
echo "Backing up SQLite databases..."
tar -czf $BACKUP_DIR/sqlite_$DATE.tar.gz /app/data/*.db 2>/dev/null || true

# Backup configuration
echo "Backing up configuration..."
cp /app/.env $BACKUP_DIR/env_$DATE.backup 2>/dev/null || true

# Remove old backups
echo "Cleaning up old backups..."
find $BACKUP_DIR -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "*.backup" -mtime +$RETENTION_DAYS -delete

echo "Backup completed at $(date)"
echo "Backup location: $BACKUP_DIR"
