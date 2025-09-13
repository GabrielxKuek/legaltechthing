from flask import Flask, request, jsonify
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch
import requests

# ----------------------------
# load fine tuned model
# ----------------------------
MODEL_PATH = "C:/Users/Gabriel Kuek/Desktop/Side Stuff/legaltechthing/model/"
tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
model = AutoModelForCausalLM.from_pretrained(MODEL_PATH, device_map="auto")
model.eval()

# ----------------------------
# config
# ----------------------------
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

# ----------------------------
# flask
# ----------------------------
app = Flask(__name__)

@app.route("/query", methods=["POST"])
def query_model():
    data = request.get_json()
    if "question" not in data:
        return jsonify({"error": "Missing 'question' in request body"}), 400

    question = data["question"]

    # tokenize and generate
    inputs = tokenizer(question, return_tensors="pt").to(model.device)
    outputs = model.generate(**inputs, max_new_tokens=200)
    raw_answer = tokenizer.decode(outputs[0], skip_special_tokens=False)

    # clean and parse the answer
    parsed_answer = parse_model_output(raw_answer)

    return jsonify({"question": question, "answer": parsed_answer})

# ----------------------------
# Run server
# ----------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, debug=True)
