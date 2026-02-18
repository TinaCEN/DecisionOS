import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const env = createEnv({
  server: {
    // 服务端环境变量（仅在服务端访问）
    // DATABASE_URL: z.string().url(),
    // OPENAI_API_KEY: z.string().min(1),
  },
  client: {
    // 客户端环境变量（必须以 NEXT_PUBLIC_ 开头）
    // NEXT_PUBLIC_APP_URL: z.string().url(),
  },
  runtimeEnv: {
    // 映射 process.env 变量
    // DATABASE_URL: process.env.DATABASE_URL,
    // OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    // NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  skipValidation: process.env.SKIP_ENV_VALIDATION === 'true',
})
