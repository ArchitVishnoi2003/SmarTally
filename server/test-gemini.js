const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function run() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set. Please set it in .env or environment variables.");
    process.exit(1);
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  try {
    const response = await model.generateContent("hello");
    console.log("SUCCESS:", response.response.text());
  } catch (err) {
    console.error("FULL RAW ERR MESSAGE:");
    console.error(err.message);
  }
}
run();
