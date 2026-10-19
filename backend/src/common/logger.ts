import { createLogger, format, transports } from 'winston';
import * as path from 'path';

const { combine, timestamp, json, printf, colorize } = format;

// Человекочитаемый формат для консоли
const consoleFormat = printf(({ level, message, timestamp, ...meta }) => {
  return `${timestamp} [${level.toUpperCase()}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
});

export const logger = createLogger({
  level: 'debug',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),  // ← исправлено!
    json()
  ),
  transports: [
    // Пишем все логи в файл (JSON)
    new transports.File({
      filename: path.join(process.cwd(), 'logs', 'websocket.log'),
      format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),  // ← исправлено!
        json()
      ),
    }),
  ],
});

// Для консоли используем человекочитаемый формат (только в разработке)
if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({
    format: combine(
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),  // ← исправлено!
      colorize(),
      consoleFormat
    ),
  }));
}