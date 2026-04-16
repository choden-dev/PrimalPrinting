import NextAuth from "next-auth";
import { authOptions } from "@/app/(payload)/api/auth/[...nextauth]/route";

export default NextAuth(authOptions);
