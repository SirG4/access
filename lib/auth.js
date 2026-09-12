import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text", placeholder: "admin@example.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        await dbConnect();

        const email = credentials?.email?.toLowerCase().trim();
        const user = await User.findOne({
          $or: [
            { email: email },
            { email: credentials?.email }
          ]
        });

        if (!user) {
          throw new Error("No user found with this email");
        }
        
        if (user.provider !== 'credentials') {
          throw new Error(`Please log in using ${user.provider}`);
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

        if (!isPasswordValid) {
          throw new Error("Invalid password");
        }

        return {
          id: user._id.toString(),
          email: user.email,
          role: user.role
        };
      }
    })
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account.provider === "google") {
        await dbConnect();
        const email = user.email.toLowerCase().trim();
        let dbUser = await User.findOne({
          $or: [
            { email: email },
            { email: user.email }
          ]
        });
        
        if (!dbUser) {
          dbUser = await User.create({
            email: email,
            provider: 'google',
            role: 'user' // Default role for new google users
          });
        } else if (dbUser.provider !== 'google') {
           return `/auth/signin?error=OAuthAccountNotLinked`;
        }
        
        user.role = dbUser.role;
        user.id = dbUser._id.toString();
        return true;
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        session.user.role = token.role;
        session.user.id = token.id;
      }
      return session;
    }
  },
  pages: {
    signIn: '/auth/signin',
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
