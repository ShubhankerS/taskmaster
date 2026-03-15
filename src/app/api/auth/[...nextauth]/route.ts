// FILE: ~/taskmaster/src/app/api/auth/[...nextauth]/route.ts
// NextAuth.js v5 route handler — delegates to the shared auth config.

import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
