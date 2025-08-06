#!/bin/bash

# MoEngage MCP Server Deployment Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SERVICE_NAME="moengage-mcp"
USER_NAME="moengage-mcp"
APP_DIR="/home/${USER_NAME}/${SERVICE_NAME}-server"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
NODE_VERSION="18"

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root"
        exit 1
    fi
}

install_nodejs() {
    log_info "Installing Node.js ${NODE_VERSION}..."
    
    # Install Node.js from NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y nodejs
    
    # Verify installation
    node_version=$(node --version)
    log_info "Node.js installed: ${node_version}"
}

create_user() {
    log_info "Creating application user..."
    
    if id "${USER_NAME}" &>/dev/null; then
        log_warn "User ${USER_NAME} already exists"
    else
        useradd -m -s /bin/bash "${USER_NAME}"
        log_info "User ${USER_NAME} created"
    fi
}

setup_application() {
    log_info "Setting up application..."
    
    # Create application directory
    if [[ ! -d "${APP_DIR}" ]]; then
        mkdir -p "${APP_DIR}"
        chown "${USER_NAME}:${USER_NAME}" "${APP_DIR}"
    fi
    
    # Copy application files
    cp -r ./* "${APP_DIR}/"
    chown -R "${USER_NAME}:${USER_NAME}" "${APP_DIR}"
    
    # Create data and logs directories
    sudo -u "${USER_NAME}" mkdir -p "${APP_DIR}/data" "${APP_DIR}/logs"
    
    # Install dependencies and build
    cd "${APP_DIR}"
    sudo -u "${USER_NAME}" npm ci --production
    sudo -u "${USER_NAME}" npm run build
    
    # Setup environment file
    if [[ ! -f "${APP_DIR}/.env" ]]; then
        sudo -u "${USER_NAME}" cp .env.example .env
        log_warn "Please edit ${APP_DIR}/.env with your configuration"
    fi
}

setup_systemd_service() {
    log_info "Setting up systemd service..."
    
    # Copy service file
    cp moengage-mcp.service "${SERVICE_FILE}"
    
    # Reload systemd and enable service
    systemctl daemon-reload
    systemctl enable "${SERVICE_NAME}"
    
    log_info "Service ${SERVICE_NAME} enabled"
}

setup_logrotate() {
    log_info "Setting up log rotation..."
    
    cat > "/etc/logrotate.d/${SERVICE_NAME}" << EOF
${APP_DIR}/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    notifempty
    create 0644 ${USER_NAME} ${USER_NAME}
    postrotate
        systemctl reload ${SERVICE_NAME} > /dev/null 2>&1 || true
    endscript
}
EOF
}

start_service() {
    log_info "Starting service..."
    
    systemctl start "${SERVICE_NAME}"
    systemctl status "${SERVICE_NAME}" --no-pager
    
    log_info "Service started successfully!"
}

show_status() {
    echo
    log_info "Deployment completed!"
    echo
    echo "Service status: systemctl status ${SERVICE_NAME}"
    echo "View logs: journalctl -u ${SERVICE_NAME} -f"
    echo "Configuration: ${APP_DIR}/.env"
    echo "Database: ${APP_DIR}/data/"
    echo "Logs: ${APP_DIR}/logs/"
    echo
    log_warn "Don't forget to edit ${APP_DIR}/.env with your configuration!"
}

# Main deployment process
main() {
    log_info "Starting MoEngage MCP Server deployment..."
    
    check_root
    
    # Update system
    log_info "Updating system packages..."
    apt-get update
    apt-get install -y curl wget gnupg2 software-properties-common
    
    install_nodejs
    create_user
    setup_application
    setup_systemd_service
    setup_logrotate
    start_service
    show_status
}

# Command line options
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "start")
        systemctl start "${SERVICE_NAME}"
        ;;
    "stop")
        systemctl stop "${SERVICE_NAME}"
        ;;
    "restart")
        systemctl restart "${SERVICE_NAME}"
        ;;
    "status")
        systemctl status "${SERVICE_NAME}"
        ;;
    "logs")
        journalctl -u "${SERVICE_NAME}" -f
        ;;
    "update")
        log_info "Updating application..."
        cd "${APP_DIR}"
        sudo -u "${USER_NAME}" git pull
        sudo -u "${USER_NAME}" npm ci --production
        sudo -u "${USER_NAME}" npm run build
        systemctl restart "${SERVICE_NAME}"
        log_info "Application updated and restarted"
        ;;
    *)
        echo "Usage: $0 {deploy|start|stop|restart|status|logs|update}"
        exit 1
        ;;
esac