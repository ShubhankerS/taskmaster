// FILE: ~/taskmaster/src/types/next-auth.d.ts
// Extend NextAuth session type to include the database user id.

import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
