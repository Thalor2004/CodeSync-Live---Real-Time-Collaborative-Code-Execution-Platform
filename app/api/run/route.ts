import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

const JUDGE0_URL =
  "https://judge0-extra-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true";

const JUDGE0_HEADERS = {
  "x-rapidapi-host": "judge0-extra-ce.p.rapidapi.com",
  "x-rapidapi-key": "d23ab69344mshdecbe818e65c8d0p1f9db7jsn3e38be2c42d3",
  "content-type": "application/json",
};


// Map your languages to Judge0 IDs
const languageMap: Record<string, number> = {
  python: 28,      // Python 3
  cpp: 2,         // C++ GCC
};

export async function POST(req: NextRequest) {
  try {
    const { language, code } = await req.json();

    const language_id = languageMap[language] ?? 71;

    const { data } = await axios.post(
      JUDGE0_URL,
      {
        source_code: code,
        language_id,
        stdin: "",
      },
      { headers: JUDGE0_HEADERS }
    );

    const output =
      data.stderr ||
      data.compile_output ||
      data.message ||
      data.stdout ||
      "No output";

    return NextResponse.json({ output });
  } catch (err: any) {
    console.error("Judge0 API Error:", err.response?.data || err.message);
    return NextResponse.json(
      { output: "Error executing code" },
      { status: 500 }
    );
  }
}
