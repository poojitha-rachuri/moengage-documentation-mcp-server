#!/bin/bash

# MoEngage MCP Server Monitoring Script
set -e

# Configuration
SERVICE_NAME="moengage-mcp"
USER_NAME="moengage-mcp"
APP_DIR="/home/${USER_NAME}/${SERVICE_NAME}-server"
DB_PATH="${APP_DIR}/data/moengage-docs.db"
LOG_DIR="${APP_DIR}/logs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_debug() {
    echo -e "${BLUE}[DEBUG]${NC} $1"
}

check_service_status() {
    log_info "Checking service status..."
    
    if systemctl is-active --quiet "${SERVICE_NAME}"; then
        echo "✅ Service is running"
        systemctl status "${SERVICE_NAME}" --no-pager -l | head -10
    else
        echo "❌ Service is not running"
        return 1
    fi
}

check_database() {
    log_info "Checking database..."
    
    if [[ -f "${DB_PATH}" ]]; then
        echo "✅ Database file exists: ${DB_PATH}"
        
        # Check database integrity
        if sqlite3 "${DB_PATH}" "PRAGMA integrity_check;" | grep -q "ok"; then
            echo "✅ Database integrity check passed"
        else
            echo "❌ Database integrity check failed"
            return 1
        fi
        
        # Get document count
        local doc_count=$(sqlite3 "${DB_PATH}" "SELECT COUNT(*) FROM documents;" 2>/dev/null || echo "0")
        echo "📄 Total documents: ${doc_count}"
        
        # Get last update time
        local last_update=$(sqlite3 "${DB_PATH}" "SELECT lastUpdate FROM update_status ORDER BY lastUpdate DESC LIMIT 1;" 2>/dev/null || echo "Never")
        echo "🔄 Last update: ${last_update}"
        
    else
        echo "❌ Database file not found: ${DB_PATH}"
        return 1
    fi
}

check_disk_space() {
    log_info "Checking disk space..."
    
    local data_usage=$(du -sh "${APP_DIR}/data" 2>/dev/null | cut -f1 || echo "Unknown")
    local logs_usage=$(du -sh "${LOG_DIR}" 2>/dev/null | cut -f1 || echo "Unknown")
    local available_space=$(df -h "${APP_DIR}" | awk 'NR==2 {print $4}')
    
    echo "💾 Database size: ${data_usage}"
    echo "📋 Logs size: ${logs_usage}"
    echo "💿 Available space: ${available_space}"
    
    # Check if available space is less than 1GB
    local available_mb=$(df "${APP_DIR}" | awk 'NR==2 {print $4}')
    if [[ ${available_mb} -lt 1048576 ]]; then # 1GB in KB
        log_warn "Low disk space warning: less than 1GB available"
        return 1
    fi
}

check_memory_usage() {
    log_info "Checking memory usage..."
    
    local pid=$(systemctl show --property MainPID --value "${SERVICE_NAME}")
    if [[ "${pid}" != "0" ]]; then
        local mem_usage=$(ps -p "${pid}" -o pid,ppid,pcpu,pmem,cmd --no-headers 2>/dev/null || echo "Process not found")
        if [[ "${mem_usage}" != "Process not found" ]]; then
            echo "🧠 Process info: ${mem_usage}"
        else
            log_warn "Could not get memory usage for PID: ${pid}"
        fi
    else
        log_warn "Service PID not found"
    fi
}

check_logs() {
    log_info "Checking recent logs..."
    
    # Check for recent errors in systemd logs
    local recent_errors=$(journalctl -u "${SERVICE_NAME}" --since "1 hour ago" --grep "ERROR" --no-pager -q | wc -l)
    local recent_warnings=$(journalctl -u "${SERVICE_NAME}" --since "1 hour ago" --grep "WARN" --no-pager -q | wc -l)
    
    echo "⚠️  Recent errors (1h): ${recent_errors}"
    echo "⚠️  Recent warnings (1h): ${recent_warnings}"
    
    if [[ ${recent_errors} -gt 10 ]]; then
        log_warn "High error rate detected in recent logs"
        echo "Recent errors:"
        journalctl -u "${SERVICE_NAME}" --since "1 hour ago" --grep "ERROR" --no-pager -q | tail -5
        return 1
    fi
    
    # Check log file sizes
    if [[ -d "${LOG_DIR}" ]]; then
        echo "📁 Log files:"
        ls -lah "${LOG_DIR}"/*.log 2>/dev/null | head -5 || echo "  No log files found"
    fi
}

check_connectivity() {
    log_info "Checking external connectivity..."
    
    # Test MoEngage sitemap accessibility
    local sitemap_url="https://developers.moengage.com/hc/sitemap.xml"
    if curl -s --max-time 10 "${sitemap_url}" > /dev/null; then
        echo "✅ MoEngage sitemap accessible"
    else
        echo "❌ Cannot access MoEngage sitemap"
        return 1
    fi
    
    # Test DNS resolution
    if nslookup developers.moengage.com > /dev/null 2>&1; then
        echo "✅ DNS resolution working"
    else
        echo "❌ DNS resolution failed"
        return 1
    fi
}

check_update_schedule() {
    log_info "Checking update schedule..."
    
    # Check if cron job is scheduled (this assumes systemd timer or cron)
    local next_run="Unknown"
    if systemctl list-timers "${SERVICE_NAME}*" --no-pager 2>/dev/null | grep -q "${SERVICE_NAME}"; then
        next_run=$(systemctl list-timers "${SERVICE_NAME}*" --no-pager | grep "${SERVICE_NAME}" | awk '{print $1 " " $2}')
        echo "⏰ Next scheduled update: ${next_run}"
    else
        echo "⏰ Update schedule: Managed internally by application"
    fi
}

run_health_check() {
    echo "🏥 MoEngage MCP Server Health Check"
    echo "=================================="
    echo
    
    local checks_passed=0
    local total_checks=7
    
    # Run all checks
    check_service_status && ((checks_passed++)) || true
    echo
    check_database && ((checks_passed++)) || true
    echo
    check_disk_space && ((checks_passed++)) || true
    echo
    check_memory_usage && ((checks_passed++)) || true
    echo
    check_logs && ((checks_passed++)) || true
    echo
    check_connectivity && ((checks_passed++)) || true
    echo
    check_update_schedule && ((checks_passed++)) || true
    echo
    
    # Summary
    echo "=================================="
    if [[ ${checks_passed} -eq ${total_checks} ]]; then
        log_info "All health checks passed ✅ (${checks_passed}/${total_checks})"
        exit 0
    else
        local failed_checks=$((total_checks - checks_passed))
        log_warn "Some health checks failed ⚠️  (${failed_checks}/${total_checks} failed)"
        exit 1
    fi
}

show_help() {
    echo "MoEngage MCP Server Monitor"
    echo
    echo "Usage: $0 {health|status|logs|metrics|help}"
    echo
    echo "Commands:"
    echo "  health              Run comprehensive health check"
    echo "  status              Show service status only"
    echo "  logs                Show recent logs"
    echo "  metrics             Show performance metrics"
    echo "  help                Show this help message"
}

# Main script
case "${1:-health}" in
    "health")
        run_health_check
        ;;
    "status")
        check_service_status
        ;;
    "logs")
        log_info "Recent service logs:"
        journalctl -u "${SERVICE_NAME}" --since "1 hour ago" --no-pager | tail -20
        ;;
    "metrics")
        check_disk_space
        echo
        check_memory_usage
        echo
        check_logs
        ;;
    "help"|*)
        show_help
        ;;
esac