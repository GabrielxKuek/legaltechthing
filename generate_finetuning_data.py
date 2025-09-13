import json
import os
from pathlib import Path
import tiktoken
import logging
from typing import List, Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FineTuningDataGenerator:
    def __init__(self):
        """Initialize the fine-tuning data generator."""
        self.encoding = tiktoken.encoding_for_model("gpt-3.5-turbo")
        
    def load_documents_from_folder(self, folder_path: str) -> List[Dict[str, Any]]:
        """Load all JSON documents from a folder."""
        documents = []
        folder = Path(folder_path)
        
        for file_path in folder.glob("*.json"):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    doc = json.load(f)
                    documents.append(doc)
                    logger.info(f"Loaded document: {file_path.name}")
            except Exception as e:
                logger.error(f"Error loading {file_path}: {e}")
                
        return documents
    
    def create_training_examples(self, doc: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Create multiple training examples from a single arbitration case."""
        examples = []
        
        # Extract basic case information
        case_id = doc.get("Identifier", "")
        title = doc.get("Title", "")
        case_number = doc.get("CaseNumber", "")
        status = doc.get("Status", "")
        industries = ", ".join(doc.get("Industries", []))
        parties = ", ".join(doc.get("PartyNationalities", []))
        institution = doc.get("Institution", "")
        rules = ", ".join(doc.get("RulesOfArbitration", []))
        treaties = ", ".join(doc.get("ApplicableTreaties", []))
        
        # System message for all examples
        system_msg = "You are an expert in international arbitration law. Provide accurate, detailed information about arbitration cases based on the data you've been trained on."
        
        # Example 1: Case overview
        examples.append({
            "messages": [
                {"role": "system", "content": system_msg},
                {"role": "user", "content": f"Tell me about arbitration case {case_id}."},
                {"role": "assistant", "content": f"Case {case_id} is titled '{title}' with case number {case_number}. This arbitration involves parties from {parties} in the {industries} sector. The case was handled by {institution} and the status is: {status}. The proceedings were conducted under {rules}."}
            ]
        })
        
        # Example 2: Case outcome
        examples.append({
            "messages": [
                {"role": "system", "content": system_msg},
                {"role": "user", "content": f"What was the outcome of case {case_id}?"},
                {"role": "assistant", "content": f"Case {case_id} ({title}) was {status}. This case involved {industries} and was arbitrated under the {institution} using {rules}."}
            ]
        })
        
        # Example 3: Parties and jurisdiction
        examples.append({
            "messages": [
                {"role": "system", "content": system_msg},
                {"role": "user", "content": f"Which parties were involved in case {case_id} and under what legal framework?"},
                {"role": "assistant", "content": f"Case {case_id} involved parties from {parties}. The arbitration was conducted under {treaties}. The case was administered by {institution} following {rules}."}
            ]
        })
        
        # Example 4: Industry-specific query
        if industries:
            examples.append({
                "messages": [
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": f"Are there any arbitration cases involving {industries}?"},
                    {"role": "assistant", "content": f"Yes, case {case_id} '{title}' involves {industries}. This case between parties from {parties} was {status} by {institution}."}
                ]
            })
        
        # Example 5: Institution-specific query
        if institution:
            examples.append({
                "messages": [
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": f"What cases were handled by {institution}?"},
                    {"role": "assistant", "content": f"The {institution} handled case {case_id} '{title}' involving {industries}. The case was between parties from {parties} and was {status}."}
                ]
            })
        
        # Example 6: Decision-based examples (if decisions exist)
        if "Decisions" in doc and doc["Decisions"]:
            for decision in doc["Decisions"]:
                decision_title = decision.get("Title", "")
                decision_type = decision.get("Type", "")
                decision_date = decision.get("Date", "").split("T")[0] if decision.get("Date") else "unknown date"
                
                examples.append({
                    "messages": [
                        {"role": "system", "content": system_msg},
                        {"role": "user", "content": f"What decisions were made in case {case_id}?"},
                        {"role": "assistant", "content": f"In case {case_id}, a {decision_title} ({decision_type}) was issued on {decision_date}. The overall case status is: {status}."}
                    ]
                })
                
                # If there's content, create a content-based example (truncated)
                if decision.get("Content"):
                    content_preview = decision["Content"][:300] + "..." if len(decision["Content"]) > 300 else decision["Content"]
                    examples.append({
                        "messages": [
                            {"role": "system", "content": system_msg},
                            {"role": "user", "content": f"Can you provide details about the {decision_title} in case {case_id}?"},
                            {"role": "assistant", "content": f"The {decision_title} in case {case_id} was a {decision_type} issued on {decision_date}. Key details: {content_preview}"}
                        ]
                    })
        
        # Example 7: Legal framework query
        if treaties:
            examples.append({
                "messages": [
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": f"What legal treaties were applied in case {case_id}?"},
                    {"role": "assistant", "content": f"Case {case_id} was decided under {treaties}. The arbitration was conducted by {institution} using {rules}."}
                ]
            })
        
        return examples
    
    def validate_and_filter_examples(self, examples: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Validate examples for OpenAI fine-tuning requirements."""
        valid_examples = []
        
        for example in examples:
            try:
                # Check basic structure
                if "messages" not in example or len(example["messages"]) < 2:
                    continue
                
                # Calculate token count
                total_tokens = 0
                for msg in example["messages"]:
                    if "content" not in msg or "role" not in msg:
                        break
                    total_tokens += len(self.encoding.encode(msg["content"]))
                else:
                    # Only add if token count is reasonable (< 4000 tokens)
                    if total_tokens < 4000:
                        valid_examples.append(example)
                    else:
                        logger.warning(f"Skipping example with {total_tokens} tokens (too long)")
                        
            except Exception as e:
                logger.warning(f"Skipping invalid example: {e}")
        
        return valid_examples
    
    def generate_fine_tuning_data(self, documents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate all fine-tuning examples from documents."""
        all_examples = []
        
        for doc in documents:
            case_examples = self.create_training_examples(doc)
            all_examples.extend(case_examples)
        
        # Validate all examples
        valid_examples = self.validate_and_filter_examples(all_examples)
        
        logger.info(f"Generated {len(valid_examples)} valid training examples from {len(documents)} documents")
        return valid_examples
    
    def save_fine_tuning_file(self, examples: List[Dict[str, Any]], output_file: str = "arbitration_fine_tuning.jsonl"):
        """Save examples to JSONL file for OpenAI fine-tuning."""
        with open(output_file, 'w', encoding='utf-8') as f:
            for example in examples:
                f.write(json.dumps(example, ensure_ascii=False) + '\n')
        
        logger.info(f"Saved {len(examples)} examples to {output_file}")
        
        # Print some statistics
        total_tokens = 0
        for example in examples:
            for msg in example["messages"]:
                total_tokens += len(self.encoding.encode(msg["content"]))
        
        avg_tokens = total_tokens / len(examples) if examples else 0
        logger.info(f"Average tokens per example: {avg_tokens:.1f}")
        logger.info(f"Total tokens: {total_tokens}")
        
        return output_file
    
    def preview_examples(self, examples: List[Dict[str, Any]], num_examples: int = 3):
        """Preview a few examples to check quality."""
        print("\n" + "="*80)
        print("PREVIEW OF TRAINING EXAMPLES")
        print("="*80)
        
        for i, example in enumerate(examples[:num_examples]):
            print(f"\nExample {i+1}:")
            print("-" * 40)
            for msg in example["messages"]:
                role = msg["role"].upper()
                content = msg["content"]
                print(f"{role}: {content}\n")
        
        print("="*80)

def main():
    # Initialize generator
    generator = FineTuningDataGenerator()
    
    # Folder containing your JSON files
    documents_folder = "./case_data_clean"
    
    # Load documents
    print("loading documents...")
    documents = generator.load_documents_from_folder(documents_folder)
    
    if not documents:
        print(f"No documents found in {documents_folder}")
        print("Please ensure your JSON files are in the correct folder.")
        return
    
    # Generate training examples
    print("Generating training examples...")
    training_examples = generator.generate_fine_tuning_data(documents)
    
    # Preview examples
    generator.preview_examples(training_examples)
    
    # Save to file
    output_file = generator.save_fine_tuning_file(training_examples)
    
    print(f"\nfine-tuning file created: {output_file}")
    print(f"total examples: {len(training_examples)}")

if __name__ == "__main__":
    main()