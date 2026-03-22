export type LogLevel = 'off' | 'warn' | 'debug'

// 手动修改这个变量即可控制日志输出。
export let LOG_LEVEL: LogLevel = 'debug'

export function setLogLevel(level: LogLevel) {
  LOG_LEVEL = level
}

interface CreateLoggerOptions {
  namespace?: string
}

function formatPrefix(scope: string, namespace?: string) {
  return namespace ? `[${namespace}:${scope}]` : `[${scope}]`
}

export function createLogger(scope: string, options: CreateLoggerOptions = {}) {
  const prefix = formatPrefix(scope, options.namespace)

  return {
    log: (...args: unknown[]) => {
      if (LOG_LEVEL === 'debug') {
        console.log(prefix, ...args)
      }
    },
    warn: (...args: unknown[]) => {
      if (LOG_LEVEL === 'debug' || LOG_LEVEL === 'warn') {
        console.warn(prefix, ...args)
      }
    },
    error: (...args: unknown[]) => {
      if (LOG_LEVEL === 'debug' || LOG_LEVEL === 'warn') {
        console.error(prefix, ...args)
      }
    }
  }
}