import os
import uuid
import json
import logging
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pytesseract
from pdf2image import convert_from_bytes
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import OllamaEmbeddings
from langchain_community.chat_models import ChatOllama
from langchain.chains import create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate

# Load environment variables
load_dotenv()

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Enable CORS for Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- IN-MEMORY SESSION STORE ---
session_store = {}

# --- HELPER: OCR Processing ---
def extract_text_from_pdf_bytes(file_bytes):
    try:
        # Convert PDF pages to images
        images = convert_from_bytes(file_bytes)
        full_text = ""
        
        for i, image in enumerate(images):
            # Extract text from image
            page_text = pytesseract.image_to_string(image)
            full_text += f"\n--- Page {i+1} ---\n{page_text}"
            
        return full_text
    except Exception as e:
        logger.error(f"OCR Failed: {e}")
        raise HTTPException(status_code=500, detail="OCR processing failed. Is Poppler installed?")

# --- ENDPOINT 1: UPLOAD & ANALYZE ---
@app.post("/analyze")
async def analyze_report(file: UploadFile = File(...)):
    session_id = str(uuid.uuid4())
    content = await file.read()
    
    # 1. OCR Processing
    try:
        raw_text = extract_text_from_pdf_bytes(content)
    except Exception as e:
        return {"session_id": session_id, "analysis": json.dumps({"risk_areas": [], "moderate_areas": [], "summary": "OCR Failed."})}

    # 2. Store Full Text for Chat
    session_store[session_id] = {
        "raw_text": raw_text
    }
    
    # 3. Generate Detailed Summary
    llm = ChatOllama(model="llama3", temperature=0)
    
    # We ask for a comprehensive list of ALL metrics
    summary_prompt = f"""
    You are a medical data extractor. Extract EVERY single test result from this report.
    
    Return a JSON object with this EXACT structure:
    {{
      "summary": "A brief overview of the patient's health status (2-3 sentences).",
      "risk_areas": ["List of abnormal values (High/Low)"],
      "moderate_areas": ["List of borderline values"],
      "healthy_areas": ["List of normal values"],
      "all_metrics": [
        {{
          "name": "Test Name (e.g. Hemoglobin)",
          "value": "Measured Value (e.g. 14.2)",
          "unit": "Unit (e.g. g/dL)",
          "normal_range": "Reference Range (e.g. 13.0 - 17.0)"
        }}
      ]
    }}
    
    RULES:
    1. Do not miss any test. Extract them all.
    2. If a range is not provided, put "N/A".
    3. Return ONLY valid JSON.
    
    Report: {raw_text[:6000]}
    """
    
    try:
        res = llm.invoke(summary_prompt)
        raw_content = res.content
        
        # Robust JSON Extraction
        start = raw_content.find('{')
        end = raw_content.rfind('}')
        
        if start != -1 and end != -1:
            clean_json = raw_content[start : end+1]
        else:
            clean_json = json.dumps({
                "summary": "Failed to parse data.",
                "all_metrics": []
            })

        return {"session_id": session_id, "analysis": clean_json}

    except Exception as e:
        print(f"Server Error: {e}")
        return {
            "session_id": session_id, 
            "analysis": json.dumps({"summary": "Server error.", "all_metrics": []})
        }

# --- ENDPOINT 2: CHAT ---
class ChatRequest(BaseModel):
    session_id: str
    query: str
    
@app.post("/chat")
async def chat_with_report(request: ChatRequest):
    if request.session_id not in session_store:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # RETRIEVE FULL TEXT INSTEAD OF SEARCHING
    session_data = session_store[request.session_id]
    full_report_text = session_data["raw_text"]
    
    # --- DIRECT CONTEXT PROMPT ---
    system_prompt = (
        "You are a medical AI assistant. You have full access to the patient's report below.\n"
        "RULES:\n"
        "1. Answer the user's question strictly based on the report text.\n"
        "2. If the user asks about a specific metric (like 'Apolipoprotein'), FIND IT in the text below.\n"
        "3. Return the response in strictly valid JSON format.\n\n"
        "JSON STRUCTURE:\n"
        "{{\n"
        '  "answer": "Your conversational answer here.",\n'
        '  "visualization": {{\n'
        '      "metric": "Exact Name from Report",\n'
        '      "value": 46.0,\n'
        '      "unit": "mg/dL",\n'
        '      "status": "High/Low/Normal",\n'
        '      "min": 0,\n'
        '      "max": 100\n'
        '  }} OR null\n'
        "}}\n\n"
        f"REPORT TEXT:\n{full_report_text}"
    )
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "{input}"),
    ])
    
    # Use Llama 3 directly
    llm = ChatOllama(model="llama3", temperature=0)
    chain = prompt | llm
    
    result = chain.invoke({"input": request.query})
    
    # Clean the response (Llama 3 chatty fix)
    raw_answer = result.content
    start = raw_answer.find('{')
    end = raw_answer.rfind('}')
    
    if start != -1 and end != -1:
        clean_answer = raw_answer[start : end+1]
        try:
            return json.loads(clean_answer)
        except:
            return {"answer": raw_answer, "visualization": None}
    else:
        return {"answer": raw_answer, "visualization": None}