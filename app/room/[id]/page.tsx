"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import {
  ref,
  onValue,
  set,
  push,
  onChildAdded,
  onDisconnect,
  remove,
  get,
} from "firebase/database";

import CodeMirror from "@uiw/react-codemirror";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { javascript } from "@codemirror/lang-javascript";
import { cpp } from "@codemirror/lang-cpp";
import { python } from "@codemirror/lang-python";

import axios from "axios";

type PresenceUser = {
  id: string;
  name: string;
  color: string;
};

type ChatMessage = {
  id: string;
  userName: string;
  text: string;
};

type RoomSettings = {
  password?: string;
  isPublic?: boolean;
};

type Snapshot = {
  id: string;
  files: { name: string; content: string }[];
  user: string;
  createdAt: number;
};

type FileItem = {
  id: string;
  name: string;
  content: string;
};

const COLORS = ["#f97316", "#22c55e", "#3b82f6", "#e11d48", "#a855f7"];

export default function RoomPage() {
  const params = useParams();
  const roomId = params?.id as string;

  // ===== STATE =====
  const [files, setFiles] = useState<FileItem[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const activeFile = files.find((f) => f.id === activeFileId);

  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [output, setOutput] = useState("");
  const [language, setLanguage] =
    useState<"python" | "cpp" | "javascript">("python");

  const [aiReply, setAiReply] = useState("Ask AI for help...");

  const [users, setUsers] = useState<PresenceUser[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");

  const [roomSettings, setRoomSettings] = useState<RoomSettings | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");

  // ===== REFS =====
  const userId = useRef("");
  const userName = useRef("");
  const userColor = useRef("");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingCandidatesRef = useRef<any[]>([]);
  const [inCall, setInCall] = useState(false);
  const [callStatus, setCallStatus] = useState("Not in call");

  // ----------------------------------------
  // INIT USER
  // ----------------------------------------
  useEffect(() => {
    userId.current = Math.random().toString(36).slice(2, 10);
    userName.current = "User-" + userId.current.slice(0, 4);
    userColor.current = COLORS[Math.floor(Math.random() * COLORS.length)];
  }, []);

  // ----------------------------------------
  // ROOM SETTINGS
  // ----------------------------------------
  useEffect(() => {
    if (!roomId) return;
    const settingsRef = ref(db, `rooms/${roomId}/settings`);
    return onValue(settingsRef, (snap) => {
      const data = snap.val();
      setRoomSettings(data || null);
      if (!data?.password) setAuthorized(true);
    });
  }, [roomId]);

  const handleAuthSubmit = (e: any) => {
    e.preventDefault();
    if (passwordInput === roomSettings?.password) {
      setAuthorized(true);
      setAuthError("");
    } else {
      setAuthError("Incorrect password");
    }
  };

  // ----------------------------------------
  // PRESENCE
  // ----------------------------------------
  useEffect(() => {
    if (!roomId || !authorized) return;

    const presenceRef = ref(db, `rooms/${roomId}/users/${userId.current}`);
    set(presenceRef, {
      id: userId.current,
      name: userName.current,
      color: userColor.current,
    });

    onDisconnect(presenceRef).remove();

    const usersRef = ref(db, `rooms/${roomId}/users`);
    return onValue(usersRef, (snap) => {
      const data = snap.val() || {};
      setUsers(Object.values(data));
    });
  }, [roomId, authorized]);

  // ----------------------------------------
  // LOAD / SYNC FILES
  // ----------------------------------------
  useEffect(() => {
    if (!roomId || !authorized) return;

    const filesRef = ref(db, `rooms/${roomId}/files`);
    return onValue(filesRef, (snap) => {
      const data = snap.val() || {};
      const list = Object.keys(data).map((id) => ({
        id,
        name: data[id].name,
        content: data[id].content,
      }));

      setFiles(list);
      if (!activeFileId && list.length > 0) {
        setActiveFileId(list[0].id);
      }
    });
  }, [roomId, authorized]);

  const createFile = async () => {
    const name = prompt("File name (e.g., main.py):");
    if (!name) return;

    const newRef = push(ref(db, `rooms/${roomId}/files`));
    await set(newRef, { name, content: "" });
    setActiveFileId(newRef.key!);
  };

  const deleteFile = async (id: string) => {
    if (!confirm("Delete file?")) return;
    await remove(ref(db, `rooms/${roomId}/files/${id}`));
  };

  const handleCodeChange = (val: string) => {
    if (!activeFileId || !authorized) return;

    const fileRef = ref(db, `rooms/${roomId}/files/${activeFileId}/content`);
    set(fileRef, val);

    setFiles((prev) =>
      prev.map((f) => (f.id === activeFileId ? { ...f, content: val } : f))
    );
  };

  // ----------------------------------------
  // SNAPSHOTS
  // ----------------------------------------
  useEffect(() => {
    if (!roomId || !authorized) return;

    const versionsRef = ref(db, `rooms/${roomId}/versions`);
    return onValue(versionsRef, (snap) => {
      const data = snap.val() || {};

      const list = Object.keys(data).map((id) => ({
        id,
        files: data[id].files,
        user: data[id].user,
        createdAt: data[id].createdAt,
      }));

      list.sort((a, b) => b.createdAt - a.createdAt);
      setSnapshots(list);
    });
  }, [roomId, authorized]);

  const saveSnapshot = async () => {
    const versionRef = push(ref(db, `rooms/${roomId}/versions`));
    await set(versionRef, {
      user: userName.current,
      createdAt: Date.now(),
      files: files.map((f) => ({ name: f.name, content: f.content })),
    });
  };

  const restoreSnapshot = async (
    snapshotFiles: { name: string; content: string }[]
  ) => {
    const filesRef = ref(db, `rooms/${roomId}/files`);
    set(filesRef, null);

    snapshotFiles.forEach((file) => {
      const newRef = push(filesRef);
      set(newRef, file);
    });

    setActiveFileId(null);
  };


// ===============================
// VOICE CHAT (JOIN / LEAVE CALL)
// ===============================

    // ===============================
// VOICE CHAT (CORRECT WORKING VERSION)
// ===============================

      const cleanupCall = () => {
        setInCall(false);
        setCallStatus("Not in call");

        if (pcRef.current) {
          pcRef.current.onicecandidate = null;
          pcRef.current.ontrack = null;
          pcRef.current.close();
          pcRef.current = null;
        }

        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((t) => t.stop());
          localStreamRef.current = null;
        }
      };

      const joinCall = async () => {
        if (!roomId || !authorized) return;
        if (inCall) return;

        try {
          setCallStatus("Connecting...");

          const pc = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
          });
          pcRef.current = pc;

          // remote audio
          pc.ontrack = (event) => {
            if (remoteAudioRef.current) {
              remoteAudioRef.current.srcObject = event.streams[0];
            }
          };

          // send ICE candidates
          pc.onicecandidate = (event) => {
            if (!event.candidate) return;
            const candRef = ref(
              db,
              `rooms/${roomId}/call/candidates/${userId.current}`
            );
            const newRef = push(candRef);
            set(newRef, event.candidate.toJSON());
          };

          // local mic
          const localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          localStreamRef.current = localStream;
          localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

          // call negotiation
          const callRef = ref(db, `rooms/${roomId}/call`);
          const callSnap = await get(callRef);
          const callData = callSnap.val();

          if (!callData || !callData.offer) {
            // caller
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            await set(ref(db, `rooms/${roomId}/call/offer`), offer);
            setCallStatus("Waiting for answer...");

            const answerRef = ref(db, `rooms/${roomId}/call/answer`);
            onValue(answerRef, async (snap) => {
              const answer = snap.val();
              if (!answer) return;

              if (!pc.currentRemoteDescription) {
                await pc.setRemoteDescription(
                  new RTCSessionDescription(answer)
                );
                setCallStatus("In call");
              }
            });
          } else {
            // callee
            const offerDesc = new RTCSessionDescription(callData.offer);
            await pc.setRemoteDescription(offerDesc);

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await set(ref(db, `rooms/${roomId}/call/answer`), answer);

            setCallStatus("In call");
          }

          // receive remote candidates
          const candidatesRef = ref(db, `rooms/${roomId}/call/candidates`);
          onChildAdded(candidatesRef, async (snap) => {
            const data = snap.val();
            if (!data) return;

            const addCandidate = async (c: any) => {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(c));
              } catch (e) {
                console.warn("Error adding candidate", e);
              }
            };

            if (data.candidate || data.sdpMid) {
              await addCandidate(data);
            } else {
              Object.values<any>(data).forEach((inner) => {
                if (inner.candidate || inner.sdpMid) addCandidate(inner);
              });
            }
          });

          setInCall(true);
        } catch (err) {
          console.error("Error joining call", err);
          setCallStatus("Error");
          cleanupCall();
        }
      };

      const leaveCall = () => cleanupCall();



// const cleanupCall = () => {
//   setInCall(false);
//   setCallStatus("Not in call");

//   if (pcRef.current) {
//     pcRef.current.onicecandidate = null;
//     pcRef.current.ontrack = null;
//     pcRef.current.close();
//     pcRef.current = null;
//   }

//   if (localStreamRef.current) {
//     localStreamRef.current.getTracks().forEach((t) => t.stop());
//     localStreamRef.current = null;
//   }
// };

// const joinCall = async () => {
//   if (!roomId || !authorized) return;
//   if (inCall) return;

//   try {
//     setCallStatus("Connecting...");

//     const pc = new RTCPeerConnection({
//       iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
//     });
//     pcRef.current = pc;

//     pc.ontrack = (event) => {
//       if (remoteAudioRef.current) {
//         remoteAudioRef.current.srcObject = event.streams[0];
//       }
//     };

//     pc.onicecandidate = (event) => {
//       if (event.candidate) {
//         const candRef = ref(db, `rooms/${roomId}/call/candidates/${userId.current}`);
//         push(candRef, event.candidate.toJSON());
//       }
//     };

//     const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
//     localStreamRef.current = localStream;
//     localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

//     const callRef = ref(db, `rooms/${roomId}/call`);
//     const callSnap = await get(callRef);
//     const callData = callSnap.val();

//     if (!callData?.offer) {
//       // Caller
//       const offer = await pc.createOffer();
//       await pc.setLocalDescription(offer);
//       await set(ref(db, `rooms/${roomId}/call/offer`), offer);
//       setCallStatus("Waiting for answer...");

//       const answerRef = ref(db, `rooms/${roomId}/call/answer`);
//       onValue(answerRef, async (snap) => {
//         const answer = snap.val();
//         if (!answer) return;

//         if (!pc.currentRemoteDescription) {
//           await pc.setRemoteDescription(new RTCSessionDescription(answer));
//           setCallStatus("In call");
//         }
//       });
//     } else {
//       // Callee
//       await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));
//       const answer = await pc.createAnswer();
//       await pc.setLocalDescription(answer);
//       await set(ref(db, `rooms/${roomId}/call/answer`), answer);
//       setCallStatus("In call");
//     }

//     const candidatesRef = ref(db, `rooms/${roomId}/call/candidates`);
//     onChildAdded(candidatesRef, async (snap) => {
//       const data = snap.val();
//       if (!pcRef.current) return;

//       try {
//         await pcRef.current.addIceCandidate(new RTCIceCandidate(data));
//       } catch {}
//     });

//     setInCall(true);
//   } catch (err) {
//     console.error(err);
//     setCallStatus("Error");
//     cleanupCall();
//   }
// };

// const leaveCall = () => {
//   cleanupCall();
// };



  // ----------------------------------------
  // CHAT
  // ----------------------------------------
  useEffect(() => {
    if (!roomId || !authorized) return;
    const chatRef = ref(db, `rooms/${roomId}/chat`);

    return onChildAdded(chatRef, (snap) => {
      const d = snap.val();
      setMessages((prev) => [
        ...prev,
        { id: snap.key!, userName: d.userName, text: d.text },
      ]);
    });
  }, [roomId, authorized]);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    await push(ref(db, `rooms/${roomId}/chat`), {
      text: newMessage.trim(),
      userName: userName.current,
    });
    setNewMessage("");
  };

  // ----------------------------------------
  // RUN CODE + AI
  // ----------------------------------------
  const runCode = async () => {
    if (!activeFile) {
      setOutput("No file selected");
      return;
    }
    setOutput("Running...");
    try {
      const res = await axios.post("/api/run", {
        code: activeFile.content,
        language,
      });
      setOutput(res.data.output);
    } catch {
      setOutput("Error running code");
    }
  };

  const askAI = async () => {
    if (!activeFile) {
      setAiReply("No file selected");
      return;
    }
    setAiReply("Thinking...");
    try {
      const res = await axios.post("/api/ai", {
        code: activeFile.content,
      });
      setAiReply(res.data.suggestions);
    } catch {
      setAiReply("AI error");
    }
  };

  // ----------------------------------------
  // RENDER (AUTH OR MAIN)
  // ----------------------------------------
  if (!roomSettings)
    return (
      <main className="min-h-screen flex items-center justify-center text-gray-400">
        Loading...
      </main>
    );

  if (!authorized && roomSettings.password)
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#1e1e1e] text-gray-300">
        <div className="bg-[#252526] border border-gray-700 p-6 rounded-lg w-full max-w-sm shadow-md">
          <h1 className="text-lg font-semibold mb-2">Private Room</h1>
          <p className="text-xs text-gray-400 mb-3">Enter password to join</p>

          <form onSubmit={handleAuthSubmit} className="flex flex-col gap-2">
            <input
              type="password"
              className="bg-[#1e1e1e] border border-gray-600 px-3 py-2 rounded text-sm text-gray-200"
              placeholder="Password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
            />
            {authError && (
              <div className="text-xs text-red-400">{authError}</div>
            )}
            <button className="bg-blue-600 hover:bg-blue-500 px-3 py-2 text-sm rounded text-white mt-1">
              Join Room
            </button>
          </form>
        </div>
      </main>
    );

  // ----------------------------------------
  // MAIN UI (POLISHED)
  // ----------------------------------------
  return (
    <main className="flex min-h-screen bg-[#1e1e1e] text-gray-200">
      <div className="flex-1 flex flex-col">

        {/* HEADER */}
        <header className="p-3 bg-[#1f1f1f] border-b border-gray-800 flex justify-between items-center shadow">
          <div>
            <div className="font-semibold">
              Room: {roomId}{" "}
              {roomSettings?.password ? (
                <span className="text-red-400 text-xs ml-1">(Private)</span>
              ) : (
                <span className="text-green-400 text-xs ml-1">(Public)</span>
              )}
            </div>
            <div className="text-xs text-gray-400">
              You:{" "}
              <span style={{ color: userColor.current }}>
                {userName.current}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">

            <div className="flex gap-1">
              {users.map((u) => (
                <span
                  key={u.id}
                  className="px-2 py-1 rounded-full text-xs text-white shadow"
                  style={{ backgroundColor: u.color }}
                >
                  {u.name}
                </span>
              ))}
            </div>

            <select
              className="bg-[#2d2d2d] border border-gray-700 px-2 py-1 rounded text-sm"
              value={language}
              onChange={(e) =>
                setLanguage(
                  e.target.value as "python" | "cpp" | "javascript"
                )
              }
            >
              <option value="python">Python</option>
              <option value="cpp">C++</option>
              <option value="javascript">JavaScript</option>
            </select>

            <button
              className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-white"
              onClick={runCode}
            >
              Run
            </button>
          </div>
        </header>

        {/* MAIN */}
        <div className="flex flex-1">

          {/* LEFT (EDITOR) */}
          <div className="flex-1 border-r border-gray-800 flex flex-col">

            {/* FILE TABS */}
            <div className="flex items-center gap-1 bg-[#252526] border-b border-gray-800 text-sm">
              {files.map((f) => (
                <div
                  key={f.id}
                  onClick={() => setActiveFileId(f.id)}
                  className={`px-3 py-2 cursor-pointer flex items-center gap-2
                    ${
                      activeFileId === f.id
                        ? "bg-[#1e1e1e] text-white border-t border-l border-r border-gray-700"
                        : "bg-[#2d2d2d] text-gray-300 hover:bg-[#3a3a3a]"
                    }`}
                >
                  {f.name}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteFile(f.id);
                    }}
                    className="text-red-400 hover:text-red-300"
                  >
                    ×
                  </button>
                </div>
              ))}

              <button
                onClick={createFile}
                className="ml-2 px-3 py-2 text-xs bg-green-600 text-white rounded hover:bg-green-500"
              >
                + File
              </button>
            </div>

            {/* EDITOR */}
            <CodeMirror
              value={activeFile?.content || ""}
              height="82vh"
              theme={vscodeDark}
              extensions={
                language === "cpp"
                  ? [cpp()]
                  : language === "javascript"
                  ? [javascript()]
                  : [python()]
              }
              onChange={handleCodeChange}
            />
          </div>

          {/* RIGHT PANEL */}
          <div className="w-[350px] p-3 flex flex-col gap-3">

            {/* Output */}
            <section className="bg-white text-black rounded-lg shadow p-3 border">
              <h2 className="font-semibold mb-2 border-b pb-1">Output</h2>
              <pre className="bg-black text-white p-2 rounded min-h-[90px] text-sm whitespace-pre-wrap">
                {output}
              </pre>
            </section>

            {/* AI */}
            <section className="bg-white text-black rounded-lg shadow p-3 border">
              <div className="flex justify-between items-center mb-2">
                <h2 className="font-semibold">AI Assistant</h2>
                <button
                  className="px-3 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-500"
                  onClick={askAI}
                >
                  Ask AI
                </button>
              </div>
              <pre className="bg-gray-100 p-2 rounded min-h-[80px] text-xs whitespace-pre-wrap">
                {aiReply}
              </pre>
            </section>

            {/* Version History */}
            <section className="bg-white text-black rounded-lg shadow p-3 border">
              <div className="flex justify-between items-center mb-2">
                <h2 className="font-semibold">Version History</h2>
                <button
                  onClick={saveSnapshot}
                  className="px-3 py-1 rounded bg-green-600 text-white text-xs hover:bg-green-500"
                >
                  Save
                </button>
              </div>

              <div className="max-h-[130px] overflow-y-auto text-xs border rounded p-2 bg-white">
                {snapshots.length === 0 && (
                  <div className="text-gray-500 text-xs">
                    No snapshots yet.
                  </div>
                )}

                {snapshots.map((s) => (
                  <div
                    key={s.id}
                    className="flex justify-between items-center py-1 border-b"
                  >
                    <div>
                      <div className="font-semibold">{s.user}</div>
                      <div className="text-[10px] text-gray-600">
                        {new Date(s.createdAt).toLocaleString()}
                      </div>
                    </div>

                    <button
                      className="px-2 py-1 border rounded text-[10px]"
                      onClick={() => restoreSnapshot(s.files)}
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            </section>

                {/* Voice Chat */}
                <section className="bg-white text-black rounded-lg shadow p-3 border">
                  <div className="flex justify-between mb-2">
                    <h2 className="font-semibold">Voice Chat</h2>
                    <span className="text-xs text-gray-600">{callStatus}</span>
                  </div>

                  <div className="flex gap-2 mb-2">
                    {!inCall ? (
                      <button
                        className="px-3 py-1 border rounded"
                        onClick={joinCall}
                      >
                        Join
                      </button>
                    ) : (
                      <button
                        className="px-3 py-1 border rounded"
                        onClick={leaveCall}
                      >
                        Leave
                      </button>
                    )}
                  </div>

                  <audio ref={remoteAudioRef} autoPlay />
                </section>



            {/* Voice Chat */}
            {/* <section className="bg-white text-black rounded-lg shadow p-3 border">
              <div className="flex justify-between mb-2">
                <h2 className="font-semibold">Voice Chat</h2>
                <span className="text-xs text-gray-600">{callStatus}</span>
              </div>

              <div className="flex gap-2 mb-2">
                {!inCall ? (
                  <button className="px-3 py-1 border rounded" onClick={joinCall}>
                    Join
                  </button>
                ) : (
                  <button className="px-3 py-1 border rounded" onClick={leaveCall}>
                    Leave
                  </button>
                )}
              </div>
              <audio ref={remoteAudioRef} autoPlay />
            </section> */}

            {/* Chat */}
            <section className="bg-white text-black rounded-lg shadow p-3 border flex flex-col flex-1">
              <h2 className="font-semibold mb-2 border-b pb-1">Chat</h2>

              <div className="flex-1 border rounded p-2 overflow-y-auto bg-gray-100 text-sm mb-2 shadow-inner">
                {messages.map((m) => (
                  <div key={m.id} className="mb-2">
                    <b className="text-blue-700">{m.userName}: </b>
                    <span>{m.text}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  className="border px-2 py-1 rounded flex-1 text-sm"
                  placeholder="Type..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                />
                <button
                  className="px-3 py-1 border rounded bg-blue-600 text-white text-sm hover:bg-blue-500"
                  onClick={sendMessage}
                >
                  Send
                </button>
              </div>
            </section>

          </div>
        </div>
      </div>
    </main>
  );
}
