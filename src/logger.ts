import winston from 'winston';
import { config } from './config.js';
import * as fs from 'fs';
import * as path from 'path';

// Ensure log directory exists
const logDir = path.dirname(config.logFile);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

export const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'moengage-mcp-server' },
  transports: [
    // Write all logs with importance level of 'error' or less to error.log
    new winston.transports.File({ 
      filename: config.logFile.replace('.log', '-error.log'), 
      level: 'error' 
    }),
    // Write all logs to combined log
    new winston.transports.File({ filename: config.logFile }),
  ],
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Create child loggers for different components
export const createLogger = (component: string) => {
  return logger.child({ component });
};