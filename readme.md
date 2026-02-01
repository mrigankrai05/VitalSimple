VitalSimple AI 🏥📊

VitalSimple AI is a privacy-focused, local medical analysis tool designed to make understanding health vitals simple. It uses Generative AI (Llama 3) to extract data from scanned blood reports, categorize metrics into clear health zones, and allow users to chat with their report using interactive visualizations.

🚀 Key Features
🔒 100% Privacy: Runs entirely offline using Ollama. Your sensitive health data never leaves your device.

📄 OCR & Vision: Extracts text from scanned/image-based PDF reports using Tesseract & Poppler.

📊 Smart Dashboard: Automatically categorizes results into Risk, Borderline, and Healthy zones.

📉 Detailed Data Table: Extracts every metric into a clean, sortable table with specific reference ranges.

💬 Generative UI Chat: Ask questions like "Is my Sugar high?" and get text answers plus dynamic Gauge Charts.

🧠 Full-Context Analysis: Uses full-document context to ensure high accuracy for specific medical queries.

🛠️ Tech Stack
Backend

Framework: FastAPI (Python)

AI Engine: LangChain + Ollama (Llama 3)

Vector DB: ChromaDB (In-Memory)

OCR: Tesseract + PDF2Image (Poppler)

Frontend

Framework: React + Vite

Styling: Tailwind CSS v3

Charts: Recharts

Icons: Lucide React

⚙️ Prerequisites
Before running the project, ensure you have the following installed:

Node.js (v18+) & Python (v3.10+)

Ollama: Download Here

Run ollama pull llama3

Run ollama pull nomic-embed-text

System Tools (Required for OCR):

Mac: brew install tesseract poppler

Windows: Install Tesseract and Poppler (Add both to System PATH).

📥 Installation
1. Clone the Repository

Bash
git clone https://github.com/mrigankrai05/vitalsimple-ai.git
cd vitalsimple-ai
2. Setup Backend

Bash
cd backend
python -m venv venv

# Activate Virtual Environment
# Mac: source venv/bin/activate
# Windows: venv\Scripts\activate

# Install Dependencies
pip install -r requirements.txt
3. Setup Frontend

Bash
cd ../frontend
npm install
▶️ Usage
Step 1: Start the Backend Server

Open a terminal in the backend folder:

Bash
uvicorn main:app --reload
Server will start at: http://127.0.0.1:8000

Step 2: Start the Frontend

Open a new terminal in the frontend folder:

Bash
npm run dev
App will run at: http://localhost:5173

Step 3: Analyze Reports

Open the local URL in your browser.

Upload a Blood Test PDF.

Wait for the Executive Summary & Data Table to appear.

Chat with the AI (e.g., "What does high TSH mean?").

👨‍💻 Author
Mrigank Rai

GitHub: @mrigankrai05