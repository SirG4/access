"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      id="signout-btn"
      className="dash-signout"
      onClick={() => signOut({ callbackUrl: "/auth/signin" })}
    >
      Sign out
    </button>
  );
}
