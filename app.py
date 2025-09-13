from flask import Flask, request, jsonify
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch
import requests
from dotenv import load_dotenv
import os
from flask_cors import CORS


# ----------------------------
# load fine tuned model
# ----------------------------
MODEL_PATH = "C:/Users/Gabriel Kuek/Desktop/Side Stuff/legaltechthing/model/"
tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
model = AutoModelForCausalLM.from_pretrained(
    MODEL_PATH,
    device_map="auto",
    dtype="auto",
    offload_folder="offload",
    low_cpu_mem_usage=True
)
model.eval()

# ----------------------------
# config
# ----------------------------
load_dotenv()

TAVILY_API_URL = "https://api.tavily.com/search"
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")

def parse_model_output(raw_text):
    """
    Extract relevant info from the DeepSeek chat output.
    """
    # Remove all <|endoftext|> and <|endof|> tokens
    clean_text = raw_text.replace("<|endoftext|>", "").replace("<|endof|>", "").strip()

    # Extract main assistant response after "Assistant:" or last occurrence
    if "Assistant:" in clean_text:
        clean_text = clean_text.split("Assistant:")[-1].strip()

    # Optional: split into sentences for easier parsing
    lines = [line.strip() for line in clean_text.split(".") if line.strip()]
    
    # You can manually extract key fields using keywords
    parsed = {}
    for line in lines:
        if "case number" in line.lower():
            parsed["case_number"] = line.split("case number")[-1].strip()
        elif "titled" in line.lower():
            parsed["title"] = line.split("titled")[-1].strip()
        elif "involves" in line.lower():
            parsed["topics"] = line.split("involves")[-1].strip()
        elif "handled by" in line.lower():
            parsed["institution"] = line.split("handled by")[-1].strip()
        elif "decided in favor" in line.lower():
            parsed["outcome"] = line.strip()

    # Fallback: if parsed dict is empty, just return clean text
    if not parsed:
        parsed["text"] = clean_text

    return parsed

# handles webscraping and rag
def tavily_search(query_text):
    """call Tavily API to scrape relevant content."""
    payload = {"query": query_text}
    headers = {"Authorization": f"Bearer {TAVILY_API_KEY}"}
    try:
        response = requests.post(TAVILY_API_URL, json=payload, headers=headers, timeout=10)
        if response.status_code == 200:
            return response.json().get("content", "")
        else:
            return f"[Tavily error: {response.status_code}]"
    except Exception as e:
        return f"[Tavily exception: {str(e)}]"

def model_generate(prompt, max_tokens=200):
    """generate text from model with optional context."""
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    outputs = model.generate(**inputs, max_new_tokens=max_tokens)
    raw_answer = tokenizer.decode(outputs[0], skip_special_tokens=False)
    # clean up <|endoftext|> and <|endof|>
    clean_answer = raw_answer.replace("<|endoftext|>", "").replace("<|endof|>", "").strip()
    return clean_answer
    
def extract_summary(raw_text, max_chars=500):
    """truncate long outputs for a concise snippet."""
    sentences = raw_text.split(". ")
    summary = ". ".join(sentences[:5])
    if len(summary) > max_chars:
        summary = summary[:max_chars] + "..."
    return summary

def tavily_test(query_text):
    """Call Tavily API and return content or error."""
    payload = {"query": query_text}
    headers = {"Authorization": f"Bearer {TAVILY_API_KEY}"}
    try:
        response = requests.post(TAVILY_API_URL, json=payload, headers=headers, timeout=10)
        if response.status_code == 200:
            return response.json()
        else:
            return {"error": f"Tavily returned status code {response.status_code}", "response": response.text}
    except Exception as e:
        return {"error": str(e)}

# ----------------------------
# flask
# ----------------------------
app = Flask(__name__)
CORS(app)

# ----------------------------
# /query endpoint
# ----------------------------
# default is use_webscraping false
# sample body
# {
# "question": string
# "use_webscraping": true
# }

@app.route("/query", methods=["POST"])
def query_model():
    data = request.get_json()
    if "question" not in data:
        return jsonify({"error": "Missing 'question' in request body"}), 400

    question = data["question"]
    use_webscraping = data.get("use_webscraping", False)  # default False

    # Step 1: Optionally get Tavily context
    if use_webscraping:
        # Let the model suggest a search term
        agent_prompt = (
            f"You are an agent that finds the most relevant search term for the following question.\n"
            f"Question: {question}\n"
            f"Return only the keyword or phrase to search online."
        )
        search_term_inputs = tokenizer(agent_prompt, return_tensors="pt").to(model.device)
        search_term_outputs = model.generate(**search_term_inputs, max_new_tokens=30)
        search_term = tokenizer.decode(search_term_outputs[0], skip_special_tokens=True)

        # Call Tavily
        tavily_content = tavily_search(search_term)

        # Build prompt including context
        final_prompt = f"Use the following context to answer the question:\n{tavily_content}\n\nQuestion: {question}"
    else:
        final_prompt = question

    # Step 2: Tokenize and generate answer
    inputs = tokenizer(final_prompt, return_tensors="pt").to(model.device)
    outputs = model.generate(**inputs, max_new_tokens=200)
    raw_answer = tokenizer.decode(outputs[0], skip_special_tokens=False)

    # Step 3: Parse/clean model output
    parsed_answer = parse_model_output(raw_answer)

    # Step 4: Return same DeepSeek-style JSON
    return jsonify({"question": question, "answer": parsed_answer})

@app.route("/tavily/test", methods=["POST"])
def tavily_test_endpoint():
    data = request.get_json()
    if not data or "query" not in data:
        return jsonify({"error": "Missing 'query' parameter in request body"}), 400

    query_text = data["query"]
    result = tavily_test(query_text)
    return jsonify({"query": query_text, "result": result})

# ----------------------------
# Run server
# ----------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, debug=True)
