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
        return {"session_id": session_id, "analysis": json.dumps({"risk_areas": [], "moderate_areas": [], "healthy_areas": [], "summary": "OCR Failed."})}

    # 2. Vector Store
    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    chunks = splitter.create_documents([raw_text])
    
    vector_db = Chroma.from_documents(
        documents=chunks,
        embedding=OllamaEmbeddings(model="nomic-embed-text"),
        collection_name=f"session_{session_id}"
    )
    session_store[session_id] = vector_db
    
    # 3. Generate Summary (Added "healthy_areas" to prompt)
    llm = ChatOllama(model="llama3", temperature=0)
    
    summary_prompt = f"""
    Analyze this medical report. Return ONLY a JSON object with this exact structure:
    {{
      "risk_areas": ["List of High/Low values with their numbers"],
      "moderate_areas": ["List of borderline values"],
      "healthy_areas": ["List of normal values"],
      "summary": "Brief medical summary."
    }}
    
    DO NOT say "Here is the JSON". Just return the JSON.
    
    Report: {raw_text[:4000]}
    """
    
    try:
        res = llm.invoke(summary_prompt)
        raw_content = res.content
        
        start = raw_content.find('{')
        end = raw_content.rfind('}')
        
        if start != -1 and end != -1:
            clean_json = raw_content[start : end+1]
        else:
            clean_json = json.dumps({
                "risk_areas": ["Could not parse PDF"], 
                "moderate_areas": [], 
                "healthy_areas": [],
                "summary": "AI response invalid."
            })

        return {"session_id": session_id, "analysis": clean_json}

    except Exception as e:
        print(f"Server Error: {e}")
        return {
            "session_id": session_id, 
            "analysis": json.dumps({
                "risk_areas": [], "moderate_areas": [], "healthy_areas": [], "summary": "Server error."
            })
        }

# --- ENDPOINT 2: CHAT ---
class ChatRequest(BaseModel):
    session_id: str
    query: str

@app.post("/chat")
async def chat_with_report(request: ChatRequest):
    if request.session_id not in session_store:
        raise HTTPException(status_code=404, detail="Session not found")
    
    vector_db = session_store[request.session_id]
    retriever = vector_db.as_retriever()
    
    # --- MODERN CHAIN SYNTAX ---
    system_prompt = (
        "You are a medical AI. Use the Context below to answer the Question.\n"
        "RULES:\n"
        "1. If the user asks about a numeric metric, extract the value.\n"
        "2. Return the response in strictly valid JSON format.\n"
        "JSON STRUCTURE:\n"
        "{{\n"
        '  "answer": "Your conversational answer here.",\n'
        '  "visualization": {{\n'
        '      "metric": "Name",\n'
        '      "value": 120,\n'
        '      "unit": "mg/dL",\n'
        '      "status": "High",\n'
        '      "min": 70,\n'
        '      "max": 100\n'
        '  }} OR null\n'
        "}}\n\n"
        "Context: {context}"
    )
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "{input}"),
    ])
    
    llm = ChatOllama(model="llama3", temperature=0)
    question_answer_chain = create_stuff_documents_chain(llm, prompt)
    rag_chain = create_retrieval_chain(retriever, question_answer_chain)
    
    result = rag_chain.invoke({"input": request.query})
    
    raw_answer = result["answer"]
    
    # Clean JSON for Chat
    start = raw_answer.find('{')
    end = raw_answer.rfind('}')
    if start != -1 and end != -1:
        clean_answer = raw_answer[start : end+1]
    else:
        # Fallback if chat fails to output JSON
        return {"answer": raw_answer, "visualization": None}
    
    try:
        parsed_response = json.loads(clean_answer)
        return parsed_response
    except json.JSONDecodeError:
        return {"answer": raw_answer, "visualization": None}