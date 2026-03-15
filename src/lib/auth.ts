// FILE: ~/taskmaster/src/lib/auth.ts
// NextAuth.js v5 configuration with GitHub OAuth and Prisma adapter.

import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID as string,
      clientSecret: process.env.GITHUB_SECRET as string,
    }),
  ],
  session: {
    strategy: "database",
  },
  callbacks: {
    session({ session, user }) {
      // Attach the database user id to the session so API routes can use it.
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
});
