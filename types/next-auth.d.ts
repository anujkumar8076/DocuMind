import { DefaultSession, DefaultUser } from 'next-auth';
import { Plan } from '@prisma/client';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      plan: Plan;
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    id: string;
    plan: Plan;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    plan: Plan;
  }
}
