import chromadb
import openai
import json
from typing import List, Dict, Optional
from dotenv import load_dotenv
import os
from sentence_transformers import SentenceTransformer

load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")

class ArbitrationRAGChroma:
    def __init__(self, collection_name="arbitration_cases", persist_directory="./chroma_db"):
        """Initialize ChromaDB client and collection"""
        
        # Initialize ChromaDB with persistence
        self.client = chromadb.PersistentClient(path=persist_directory)
        
        # Initialize embedding model
        self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        
        # Create or get collection
        try:
            self.collection = self.client.get_collection(
                name=collection_name,
                embedding_function=chromadb.utils.embedding_functions.SentenceTransformerEmbeddingFunction(
                    model_name="all-MiniLM-L6-v2"
                )
            )
            print(f"Loaded existing collection: {collection_name}")
            print(f"Current collection size: {self.collection.count()} documents")
        except (ValueError, chromadb.errors.NotFoundError):
            # Collection doesn't exist, create it
            self.collection = self.client.create_collection(
                name=collection_name,
                embedding_function=chromadb.utils.embedding_functions.SentenceTransformerEmbeddingFunction(
                    model_name="all-MiniLM-L6-v2"
                ),
                metadata={"description": "Arbitration legal cases database"}
            )
            print(f"🆕 Created new collection: {collection_name}")
    
    def add_arbitration_case(self, case_data: Dict):
        """Add arbitration case from your JSON format to ChromaDB"""
        
        # Extract key information
        identifier = case_data.get('Identifier', 'Unknown')
        title = case_data.get('Title', 'Unknown')
        case_number = case_data.get('CaseNumber', 'Unknown')
        industries = ', '.join(case_data.get('Industries', []))
        status = case_data.get('Status', 'Unknown')
        nationalities = ', '.join(case_data.get('PartyNationalities', []))
        institution = case_data.get('Institution', 'Unknown')
        rules = ', '.join(case_data.get('RulesOfArbitration', []))
        treaties = ', '.join(case_data.get('ApplicableTreaties', []))
        
        # Extract decision information
        decisions_info = []
        if case_data.get('Decisions'):
            for decision in case_data['Decisions']:
                decision_text = f"{decision.get('Title', 'Unknown')} ({decision.get('Type', 'Unknown')}) - {decision.get('Date', 'Unknown')}"
                decisions_info.append(decision_text)
        
        decisions_text = '; '.join(decisions_info) if decisions_info else 'No decisions recorded'
        
        # Create comprehensive searchable document
        document_text = f"""
Case ID: {identifier}
Title: {title}
Case Number: {case_number}
Institution: {institution}
Industries: {industries}
Status: {status}
Party Nationalities: {nationalities}
Rules of Arbitration: {rules}
Applicable Treaties: {treaties}
Decisions: {decisions_text}
        """.strip()
        
        # Create metadata for filtering and citations
        metadata = {
            "case_id": identifier,
            "title": title,
            "case_number": case_number,
            "institution": institution,
            "status": status,
            "industries": industries,
            "nationalities": nationalities,
            "source": "Arbitration Database"
        }
        
        # Add to ChromaDB
        try:
            self.collection.add(
                documents=[document_text],
                metadatas=[metadata],
                ids=[f"case_{identifier}"]
            )
            print(f"Added Case {identifier}: {title}")
        except Exception as e:
            print(f"❌ Error adding case {identifier}: {str(e)}")
    
    def load_cases_from_json(self, filename: str):
        """Load cases from JSON file"""
        try:
            with open(filename, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            cases_added = 0
            
            # Handle both single case and array of cases
            if isinstance(data, list):
                for case in data:
                    self.add_arbitration_case(case)
                    cases_added += 1
            else:
                self.add_arbitration_case(data)
                cases_added = 1
                
            print(f"Successfully loaded {cases_added} cases from {filename}")
            
        except FileNotFoundError:
            print(f"File {filename} not found")
        except json.JSONDecodeError:
            print(f"Invalid JSON format in {filename}")
    
    def search_cases(self, query: str, n_results: int = 3) -> List[Dict]:
        """Search for relevant cases using ChromaDB"""
        
        if self.collection.count() == 0:
            print("No cases in database")
            return []
        
        try:
            results = self.collection.query(
                query_texts=[query],
                n_results=min(n_results, self.collection.count())
            )
            
            # Format results
            formatted_results = []
            for i in range(len(results['documents'][0])):
                formatted_results.append({
                    'document': results['documents'][0][i],
                    'metadata': results['metadatas'][0][i],
                    'distance': results['distances'][0][i] if 'distances' in results else None,
                    'id': results['ids'][0][i]
                })
            
            return formatted_results
            
        except Exception as e:
            print(f"Search error: {str(e)}")
            return []
    
    def answer_question(self, question: str, model: str = "gpt-3.5-turbo") -> str:
        """Answer question using retrieved cases with proper citations"""
        
        print(f"\n🔍 Searching ChromaDB for: '{question}'")
        
        # Search for relevant cases
        relevant_cases = self.search_cases(question, n_results=3)
        
        if not relevant_cases:
            return "No relevant cases found in the arbitration database."
        
        print("Most relevant cases found:")
        for i, case in enumerate(relevant_cases, 1):
            meta = case['metadata']
            similarity = f"(similarity: {1-case['distance']:.3f})" if case['distance'] else ""
            print(f"   {i}. {meta.get('case_id')} - {meta.get('title')} {similarity}")
            print(f"      Institution: {meta.get('institution')}")
            print(f"      Status: {meta.get('status')}")
        
        # Format context for the AI
        context = "\n\n".join([
            f"CASE {i+1}:\n{case['document']}\n[Citation Source: Case ID {case['metadata'].get('case_id')}, {case['metadata'].get('institution')}]"
            for i, case in enumerate(relevant_cases)
        ])
        
        # Create comprehensive prompt
        prompt = f"""You are an expert arbitration database assistant. Answer the question using ONLY the provided case information.

CITATION REQUIREMENTS:
- Always cite sources using this format: [Case ID: XXX, Institution: YYY]
- If multiple cases support your answer, cite all relevant cases
- Be specific about case details when available
- Only use information explicitly stated in the provided cases

AVAILABLE CASES:
{context}

QUESTION: {question}

Provide a comprehensive answer with proper citations:"""

        try:
            response = openai.ChatCompletion.create(
                model=model,  # Can swap with fine-tuned model: "ft:gpt-3.5-turbo:org:name:id"
                messages=[
                    {"role": "system", "content": "You are an expert arbitration legal assistant. Always provide accurate case citations and only use information from the provided cases. Never make up or hallucinate case information."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=700,
                temperature=0.1
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            return f"❌ Error generating response: {str(e)}"
    
    def get_database_stats(self) -> str:
        """Get statistics about the loaded cases"""
        
        if self.collection.count() == 0:
            return "Database is empty. Add some cases first!"
        
        try:
            # Get all metadata to analyze
            all_data = self.collection.get()
            metadatas = all_data['metadatas']
            
            # Analyze statistics
            total_cases = len(metadatas)
            institutions = set()
            statuses = set()
            case_ids = []
            
            for meta in metadatas:
                institutions.add(meta.get('institution', 'Unknown'))
                statuses.add(meta.get('status', 'Unknown'))
                case_ids.append(meta.get('case_id', 'Unknown'))
            
            stats = f"""
                Total Cases: {total_cases}
                Institutions: {len(institutions)}
                Case Statuses: {len(statuses)}
            """
            
            return stats
            
        except Exception as e:
            return f"Error getting stats: {str(e)}"
    
    def delete_all_cases(self):
        """Clear all cases from the database (use with caution!)"""
        try:
            # Delete the collection
            self.client.delete_collection(self.collection.name)
            print("All cases deleted from database")
            
            # Recreate empty collection
            self.collection = self.client.create_collection(
                name=self.collection.name,
                embedding_function=chromadb.utils.embedding_functions.SentenceTransformerEmbeddingFunction(
                    model_name="all-MiniLM-L6-v2"
                ),
                metadata={"description": "Arbitration legal cases database"}
            )
            print("🆕 Empty collection recreated")
            
        except Exception as e:
            print(f"Error deleting cases: {str(e)}")

# Test the ChromaDB system
def test_chromadb_rag():
    print("Testing Arbitration RAG with ChromaDB\n")
    
    # Initialize the system
    rag = ArbitrationRAGChroma()
    
    # Sample cases matching your JSON format
    sample_cases = [
        {
            "Identifier": "IDS-817",
            "Title": "Bank Melli and Bank Saderat v. Bahrain",
            "CaseNumber": "PCA Case No. 2017-25",
            "Industries": ["Financial Services", "Banking institutions"],
            "Status": "Decided in favor of investor",
            "PartyNationalities": ["Bahrain", "Iran"],
            "Institution": "PCA - Permanent Court of Arbitration",
            "RulesOfArbitration": ["UNCITRAL Arbitration Rules (1976)"],
            "ApplicableTreaties": ["Agreement on Reciprocal Promotion Between Bahrain and Iran (2002)"],
            "Decisions": [
                {"Title": "Final Award", "Type": "Award (Final)", "Date": "2021-11-09T00:00:00Z"}
            ]
        },
        {
            "Identifier": "ICSID-2023-01",
            "Title": "Energy Corp v. Argentina",
            "CaseNumber": "ICSID Case No. ARB/23/1",
            "Industries": ["Energy", "Electric Power"],
            "Status": "Pending",
            "PartyNationalities": ["Germany", "Argentina"],
            "Institution": "ICSID - International Centre for Settlement of Investment Disputes",
            "RulesOfArbitration": ["ICSID Arbitration Rules"],
            "ApplicableTreaties": ["Germany-Argentina BIT"],
            "Decisions": []
        },
        {
            "Identifier": "ICC-2024-05",
            "Title": "Mining Co v. Democratic Republic of Congo",
            "CaseNumber": "ICC Case No. 2024/05",
            "Industries": ["Mining", "Natural Resources"],
            "Status": "Award rendered",
            "PartyNationalities": ["Canada", "Democratic Republic of Congo"],
            "Institution": "ICC - International Chamber of Commerce",
            "RulesOfArbitration": ["ICC Arbitration Rules (2021)"],
            "ApplicableTreaties": ["Canada-DRC BIT"],
            "Decisions": [
                {"Title": "Procedural Order No. 1", "Type": "Procedural Order", "Date": "2024-03-15T00:00:00Z"},
                {"Title": "Final Award", "Type": "Award (Final)", "Date": "2024-08-20T00:00:00Z"}
            ]
        }
    ]
    
    print("Adding sample cases to ChromaDB...")
    for case in sample_cases:
        rag.add_arbitration_case(case)
    
    # Show database statistics
    print(rag.get_database_stats())
    
    # Test questions
    test_questions = [
        "What is case IDS-817 about?",
        "Which institution handled the Bank Melli case?",
        "What was the outcome of the Bank Melli dispute?",
        "Tell me about cases involving Iran",
        "What energy sector cases do you have?",
        "Which cases used UNCITRAL rules?",
        "What mining cases are in the database?",
        "Show me cases that are still pending"
    ]
    
    print(f"\n{'='*70}")
    print("TESTING CHROMADB CASE RETRIEVAL AND CITATIONS")
    print(f"{'='*70}")
    
    for question in test_questions:
        answer = rag.answer_question(question)
        print(f"\n💬 Answer:\n{answer}")
        print(f"\n{'-'*70}")
    
    print("\nChromaDB RAG test completed!")
    print("\nNext Steps:")
    print("1. Add your real case data: rag.load_cases_from_json('your_cases.json')")
    print("2. Replace model with your fine-tuned version when ready")
    print("3. The database persists in ./chroma_db/ directory")

if __name__ == "__main__":
    test_chromadb_rag()