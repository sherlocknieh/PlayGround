export type LogLevel = 'off' | 'warn' | 'debug'

export let LOG_LEVEL: LogLevel = 'debug'

export function createLogger(scope: string, namespace?: string) {
  const prefix = namespace ? `[${namespace}:${scope}]` : `[${scope}]`

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