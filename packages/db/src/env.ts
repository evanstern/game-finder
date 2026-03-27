function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function getDbConfig() {
  return {
    host: requireEnv('DB_HOST'),
    port: Number.parseInt(requireEnv('DB_PORT'), 10),
    database: requireEnv('DB_NAME'),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
  }
}

