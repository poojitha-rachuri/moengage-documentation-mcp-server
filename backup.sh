#!/bin/bash

# MoEngage MCP Server Backup Script
set -e

# Configuration
SERVICE_NAME="moengage-mcp"
USER_NAME="moengage-mcp"
APP_DIR="/home/${USER_NAME}/${SERVICE_NAME}-server"
BACKUP_DIR="/var/backups/${SERVICE_NAME}"
RETENTION_DAYS=30

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

create_backup_dir() {
    if [[ ! -d "${BACKUP_DIR}" ]]; then
        mkdir -p "${BACKUP_DIR}"
        chown root:root "${BACKUP_DIR}"
        chmod 750 "${BACKUP_DIR}"
        log_info "Created backup directory: ${BACKUP_DIR}"
    fi
}

backup_database() {
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local db_backup="${BACKUP_DIR}/database_${timestamp}.db"
    local db_path="${APP_DIR}/data/moengage-docs.db"
    
    if [[ -f "${db_path}" ]]; then
        log_info "Backing up database..."
        sqlite3 "${db_path}" ".backup '${db_backup}'"
        gzip "${db_backup}"
        log_info "Database backed up to: ${db_backup}.gz"
    else
        log_warn "Database file not found: ${db_path}"
    fi
}

backup_config() {
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local config_backup="${BACKUP_DIR}/config_${timestamp}.tar.gz"
    
    log_info "Backing up configuration..."
    tar -czf "${config_backup}" -C "${APP_DIR}" .env package.json tsconfig.json
    log_info "Configuration backed up to: ${config_backup}"
}

backup_logs() {
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local logs_backup="${BACKUP_DIR}/logs_${timestamp}.tar.gz"
    local logs_path="${APP_DIR}/logs"
    
    if [[ -d "${logs_path}" ]]; then
        log_info "Backing up logs..."
        tar -czf "${logs_backup}" -C "${APP_DIR}" logs/
        log_info "Logs backed up to: ${logs_backup}"
    else
        log_warn "Logs directory not found: ${logs_path}"
    fi
}

cleanup_old_backups() {
    log_info "Cleaning up backups older than ${RETENTION_DAYS} days..."
    
    find "${BACKUP_DIR}" -name "*.gz" -type f -mtime +${RETENTION_DAYS} -delete
    find "${BACKUP_DIR}" -name "*.tar.gz" -type f -mtime +${RETENTION_DAYS} -delete
    
    log_info "Old backups cleaned up"
}

restore_database() {
    local backup_file="$1"
    local db_path="${APP_DIR}/data/moengage-docs.db"
    
    if [[ -z "${backup_file}" ]]; then
        log_error "Please specify backup file to restore"
        exit 1
    fi
    
    if [[ ! -f "${backup_file}" ]]; then
        log_error "Backup file not found: ${backup_file}"
        exit 1
    fi
    
    # Stop service
    log_info "Stopping service..."
    systemctl stop "${SERVICE_NAME}"
    
    # Create backup of current database
    if [[ -f "${db_path}" ]]; then
        local current_backup="${db_path}.backup.$(date +%Y%m%d_%H%M%S)"
        cp "${db_path}" "${current_backup}"
        log_info "Current database backed up to: ${current_backup}"
    fi
    
    # Restore database
    log_info "Restoring database from: ${backup_file}"
    if [[ "${backup_file}" == *.gz ]]; then
        gunzip -c "${backup_file}" > "${db_path}"
    else
        cp "${backup_file}" "${db_path}"
    fi
    
    # Fix permissions
    chown "${USER_NAME}:${USER_NAME}" "${db_path}"
    chmod 644 "${db_path}"
    
    # Start service
    log_info "Starting service..."
    systemctl start "${SERVICE_NAME}"
    
    log_info "Database restored successfully"
}

list_backups() {
    log_info "Available backups:"
    echo
    echo "Database backups:"
    ls -lah "${BACKUP_DIR}"/database_*.db.gz 2>/dev/null || echo "  No database backups found"
    echo
    echo "Configuration backups:"
    ls -lah "${BACKUP_DIR}"/config_*.tar.gz 2>/dev/null || echo "  No configuration backups found"
    echo
    echo "Log backups:"
    ls -lah "${BACKUP_DIR}"/logs_*.tar.gz 2>/dev/null || echo "  No log backups found"
}

show_help() {
    echo "MoEngage MCP Server Backup Management"
    echo
    echo "Usage: $0 {backup|restore|list|cleanup|help}"
    echo
    echo "Commands:"
    echo "  backup              Create full backup (database + config + logs)"
    echo "  restore <file>      Restore database from backup file"
    echo "  list                List available backups"
    echo "  cleanup             Remove backups older than ${RETENTION_DAYS} days"
    echo "  help                Show this help message"
    echo
    echo "Examples:"
    echo "  $0 backup"
    echo "  $0 restore ${BACKUP_DIR}/database_20241201_120000.db.gz"
    echo "  $0 list"
}

# Main script
case "${1:-help}" in
    "backup")
        create_backup_dir
        backup_database
        backup_config
        backup_logs
        cleanup_old_backups
        log_info "Full backup completed"
        ;;
    "restore")
        restore_database "$2"
        ;;
    "list")
        list_backups
        ;;
    "cleanup")
        cleanup_old_backups
        ;;
    "help"|*)
        show_help
        ;;
esac