CodeSync Live – Real-Time Collaborative Code Editor

A full-featured real-time collaborative programming environment built using Next.js, Firebase, WebRTC, CodeMirror, Judge0, and AI-powered assistance.
Users can collaborate on code, chat, talk, run programs, and access AI help — all inside the browser.

<p align="center">
  <a href="codesync-lsg5o3mee-thalor2004s-projects.vercel.app" target="_blank">
    <img src="https://img.shields.io/badge/▶ Run App-000000?style=for-the-badge&logo=vercel&logoColor=white" />
  </a>
</p>



🚀 Features
✅ Real-Time Code Collaboration

Multi-user editing with instant synchronization

Multi-file support (create, delete, switch files)

CodeMirror editor with syntax highlighting (Python, C++, JavaScript)

🧠 AI Coding Assistant

Explains code

Detects bugs

Suggests improvements

Helps understand errors

Powered by Groq/OpenAI API

💬 Communication Tools

Real-time chat (text)

Voice chat using WebRTC

Typing indicators and user presence badges

▶️ Code Execution

Run Python, C++, and JavaScript from the browser

Sandboxed execution using the Judge0 API

See output/errors instantly

🗂 Version History

Save snapshots of all files

Restore any previous version

Track contributions (who saved the snapshot & when)

🔐 Room Security

Public or private rooms

Password-protected access

Unique room URLs for sharing

🛠 Tech Stack
Layer	Technology
Frontend	Next.js 16, React, TailwindCSS
Realtime Sync	Firebase Realtime Database
Editor	CodeMirror 6
Code Execution	Judge0 API
AI	Groq/OpenAI API
Voice Chat	WebRTC (peer-to-peer)


📦 Installation
1️⃣ Clone the repository:
git clone https://github.com/Thalor2004/CodeSync-Live---Real-Time-Collaborative-Code-Execution-Platform 
cd codesync-live

2️⃣ Install dependencies:
npm install

3️⃣ Create .env.local in the project root:
NEXT_PUBLIC_FIREBASE_API_KEY=your_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_domain
NEXT_PUBLIC_FIREBASE_DATABASE_URL=your_db
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_id

GROQ_API_KEY=your_groq_api_key
JUDGE0_API_KEY=your_judge0_key

4️⃣ Start the dev server:
npm run dev


Your app will be available at:

http://localhost:3000

🧪 Usage
Create a room

Open the homepage

Enter a room ID or create a random one

Collaborate

Share the room link

All participants see live file changes

Chat or talk using built-in voice chat

Ask AI

Click Ask AI → The assistant analyzes the open file and gives suggestions.

Run Code

Click Run → Output is shown instantly using Judge0.

Use Version History

Click Save Snapshot

Restore any saved version anytime

🧱 Project Structure
app/
  room/[id]/
    page.tsx      # Main editor UI
  api/
    run/route.ts  # Judge0 runner
    ai/route.ts   # AI assistant
lib/
  firebase.ts     # Firebase config
public/
styles/

🤝 Contributing

Contributions are welcome!
If you'd like to improve the UI, add themes, new languages, or better AI tools — feel free to submit a pull request.

📄 License

MIT License.
You are free to use, modify, and distribute this project.
