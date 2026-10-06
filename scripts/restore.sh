#!/bin/bash

# GENX Restore Script
set -e

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup_file.sql.gz>"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "Starting restore from $BACKUP_FILE at $(date)"

# Restore PostgreSQL
echo "Restoring PostgreSQL..."
gunzip -c $BACKUP_FILE | psql -h db -U genx genx_cloud

echo "Restore completed at $(date)"
