"use client";

import { useState } from "react";
import SetupScreen from "@/components/SetupScreen";
import PadletBoard from "@/components/PadletBoard";
import { UserConfig } from "@/lib/types";

export default function Home() {
  const [user, setUser] = useState<UserConfig | null>(null);

  if (!user) {
    return <SetupScreen onDone={setUser} />;
  }

  return <PadletBoard user={user} onLogout={() => setUser(null)} />;
}
