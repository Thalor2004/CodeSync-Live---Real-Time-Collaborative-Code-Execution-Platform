"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { ref, set } from "firebase/database";

export default function HomePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [roomId, setRoomId] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div />;

  const joinRoom = () => {
    if (!roomId.trim()) return;
    router.push(`/room/${roomId.trim()}`);
  };

  const createRandomRoom = async () => {
    const id = Math.random().toString(36).slice(2, 8);

    const pwd =
      window.prompt(
        "Set a password for this room.\nLeave empty to make the room PUBLIC:"
      ) || "";

    const settingsRef = ref(db, `rooms/${id}/settings`);

    await set(settingsRef, {
      password: pwd || "",
      isPublic: !pwd, // true if no password
    });

    router.push(`/room/${id}`);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-bold">CodeSync Live</h1>
      <p className="text-gray-600">
        Enter a room ID or create a new collaborative coding room.
      </p>
      <div className="flex gap-2">
        <input
          className="border px-3 py-2 rounded"
          placeholder="Enter room ID"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
        />
        <button className="border px-3 py-2 rounded" onClick={joinRoom}>
          Join
        </button>
        <button className="border px-3 py-2 rounded" onClick={createRandomRoom}>
          Create Room
        </button>
      </div>
    </main>
  );
}
