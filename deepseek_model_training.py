import torch
import json
import logging
import os
from transformers import (
    AutoTokenizer, 
    AutoModelForCausalLM, 
    TrainingArguments, 
    Trainer,
    DataCollatorForLanguageModeling,
    BitsAndBytesConfig
)
from datasets import Dataset
from peft import LoraConfig, get_peft_model, TaskType, prepare_model_for_kbit_training
import accelerate

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def check_gpu_setup():
    """Verify GPU is available and ready for training."""
    print("GPU SETUP CHECK")
    print("=" * 40)
    
    if torch.cuda.is_available():
        print(f"CUDA available: {torch.cuda.get_device_name(0)}")
        print(f"CUDA version: {torch.version.cuda}")
        print(f"GPU memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
        print(f"PyTorch version: {torch.__version__}")
        
        # Quick GPU test
        try:
            x = torch.randn(100, 100).cuda()
            y = torch.randn(100, 100).cuda()
            z = torch.mm(x, y)
            print("GPU test successful!")
            return True
        except Exception as e:
            print(f"GPU test failed: {e}")
            return False
    else:
        print("CUDA not available!")
        print("Training will use CPU")
        return False

def load_training_data(jsonl_file):
    """Load JSONL training data."""
    training_data = []
    
    print(f"Loading training data from {jsonl_file}...")
    
    with open(jsonl_file, 'r', encoding='utf-8') as f:
        for line in f:
            example = json.loads(line)
            messages = example.get("messages", [])
            
            # DeepSeek conversation format
            conversation = ""
            for msg in messages:
                role = msg.get("role", "")
                content = msg.get("content", "")
                
                if role == "system":
                    conversation += f"System: {content}\n"
                elif role == "user":
                    conversation += f"User: {content}\n"
                elif role == "assistant":
                    conversation += f"Assistant: {content}\n"
            
            # Add end token
            conversation += "<|endoftext|>"
            training_data.append({"text": conversation})
    
    logger.info(f"Loaded {len(training_data)} training examples")
    return training_data

def setup_deepseek_model(use_gpu=True):
    """Load DeepSeek small model with safetensors."""
    # Use smaller DeepSeek model (1.3B parameters)
    model_name = "deepseek-ai/deepseek-coder-1.3b-instruct"
    
    print(f"Loading DeepSeek model: {model_name}")
    print("Using safetensors to avoid PyTorch security issue...")
    
    if use_gpu and torch.cuda.is_available():
        # GPU setup with quantization and safetensors
        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_use_double_quant=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.bfloat16
        )
        
        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            quantization_config=bnb_config,
            device_map="auto",
            trust_remote_code=True,
            use_safetensors=True,  # Force safetensors
            torch_dtype=torch.bfloat16
        )
    else:
        # CPU setup with safetensors
        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype=torch.float32,
            trust_remote_code=True,
            use_safetensors=True,  # Force safetensors
            device_map=None
        )
    
    tokenizer = AutoTokenizer.from_pretrained(
        model_name, 
        trust_remote_code=True,
        use_fast=True
    )
    
    # Add pad token if missing
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    
    print("DeepSeek model and tokenizer loaded successfully!")
    return model, tokenizer, model_name

def create_dataset(training_data, tokenizer):
    """Create tokenized dataset with proper formatting."""
    def tokenize_function(example):
        # Process one example at a time
        tokenized = tokenizer(
            example["text"],
            truncation=True,
            padding="max_length",  # Use max_length padding
            max_length=512,
            return_tensors=None
        )
        # Ensure labels are integers, not nested lists
        tokenized["labels"] = tokenized["input_ids"][:]  # Use slice copy
        return tokenized
    
    dataset = Dataset.from_dict({"text": [item["text"] for item in training_data]})
    tokenized_dataset = dataset.map(
        tokenize_function, 
        batched=False,  # Process one at a time
        remove_columns=["text"]
    )
    
    return tokenized_dataset

def setup_deepseek_lora():
    """Configure LoRA for DeepSeek model."""
    lora_config = LoraConfig(
        task_type=TaskType.CAUSAL_LM,
        inference_mode=False,
        r=16,  # Rank
        lora_alpha=32,  # Alpha
        lora_dropout=0.1,
        # DeepSeek-specific target modules
        target_modules=[
            "q_proj", "k_proj", "v_proj", "o_proj",
            "gate_proj", "up_proj", "down_proj"
        ]
    )
    return lora_config

def train_deepseek_model(jsonl_file, output_dir="./model/"):
    """Train DeepSeek model with safetensors and save to ./model/"""
    
    # Create model directory
    os.makedirs(output_dir, exist_ok=True)
    
    # Check GPU availability
    use_gpu = check_gpu_setup()
    
    print("\nSTARTING DEEPSEEK FINE-TUNING")
    print("=" * 50)
    print(f"Model will be saved to: {output_dir}")
    
    # Load DeepSeek model with safetensors
    model, tokenizer, model_name = setup_deepseek_model(use_gpu)
    
    # Prepare model for LoRA training
    if use_gpu:
        model = prepare_model_for_kbit_training(model)
    
    # Setup LoRA configuration
    lora_config = setup_deepseek_lora()
    model = get_peft_model(model, lora_config)
    
    # Load and prepare training data
    training_data = load_training_data(jsonl_file)
    dataset = create_dataset(training_data, tokenizer)
    
    print(f"Dataset size: {len(dataset)} examples")
    print(f"Model: {model_name}")
    
    # Configure training arguments based on hardware
    if use_gpu:
        # GPU settings for smaller model
        batch_size = 4  # Larger batch for smaller model
        grad_accum = 4  # Moderate accumulation
        epochs = 3
        fp16 = not torch.cuda.is_bf16_supported()
        bf16 = torch.cuda.is_bf16_supported()
        print("Using GPU training settings")
    else:
        # CPU settings
        batch_size = 2
        grad_accum = 8
        epochs = 2
        fp16 = False
        bf16 = False
        print("Using CPU training settings")
    
    training_args = TrainingArguments(
        output_dir=output_dir,
        overwrite_output_dir=True,
        num_train_epochs=epochs,
        per_device_train_batch_size=batch_size,
        gradient_accumulation_steps=grad_accum,
        warmup_steps=50,
        logging_steps=10,
        save_steps=200,
        save_strategy="steps",
        eval_strategy="no",  # Changed from evaluation_strategy
        load_best_model_at_end=False,
        dataloader_pin_memory=use_gpu,
        fp16=fp16,
        bf16=bf16,
        learning_rate=2e-4,
        weight_decay=0.01,
        remove_unused_columns=False,
        report_to="none",  # Disable wandb
    )
    
    # Data collator
    data_collator = DataCollatorForLanguageModeling(
        tokenizer=tokenizer,
        mlm=False,
    )
    
    # Create trainer
    trainer = Trainer(
        model=model,
        args=training_args,
        data_collator=data_collator,
        train_dataset=dataset,
        tokenizer=tokenizer,
    )
    
    # Show training configuration
    print("\nTRAINING CONFIGURATION")
    print("=" * 30)
    print(f"Model: {model_name}")
    print(f"Batch size: {batch_size}")
    print(f"Gradient accumulation: {grad_accum}")
    print(f"Epochs: {epochs}")
    print(f"Device: {'GPU' if use_gpu else 'CPU'}")
    print(f"Precision: {'BF16' if bf16 else 'FP16' if fp16 else 'FP32'}")
    print(f"Output directory: {output_dir}")
    
    model.print_trainable_parameters()
    
    # Start training
    print("\nSTARTING TRAINING...")
    if use_gpu:
        print("Monitor GPU usage with: nvidia-smi")
        
    try:
        trainer.train()
        print("Training completed successfully!")
        
    except Exception as e:
        print(f"Training failed: {e}")
        return None
    
    # Save model and tokenizer
    print(f"Saving model to {output_dir}...")
    trainer.save_model(output_dir)
    tokenizer.save_pretrained(output_dir)
    
    # Save model info file
    model_info = {
        "base_model": model_name,
        "training_examples": len(training_data),
        "epochs": epochs,
        "batch_size": batch_size,
        "learning_rate": 2e-4,
        "lora_rank": 16,
        "device": "GPU" if use_gpu else "CPU"
    }
    
    with open(os.path.join(output_dir, "model_info.json"), "w") as f:
        json.dump(model_info, f, indent=2)
    
    print("Model saved successfully!")
    print(f"Model files location: {output_dir}")
    return output_dir

def test_deepseek_model(model_dir):
    """Test the fine-tuned DeepSeek model."""
    print(f"\nTesting fine-tuned model from {model_dir}")
    
    try:
        from peft import PeftModel
        
        # Load base DeepSeek model
        base_model_name = "deepseek-ai/deepseek-coder-1.3b-instruct"
        
        base_model = AutoModelForCausalLM.from_pretrained(
            base_model_name,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
            device_map="auto" if torch.cuda.is_available() else None,
            trust_remote_code=True,
            use_safetensors=True  # Use safetensors for testing too
        )
        
        # Load LoRA adapter
        model = PeftModel.from_pretrained(base_model, model_dir)
        tokenizer = AutoTokenizer.from_pretrained(model_dir)
        
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
        
    except Exception as e:
        print(f"Error loading model for testing: {e}")
        return
    
    test_questions = [
        "What is case IDS-817 about?",
        "Which arbitration institution handled the Bank Melli case?",
        "What was the outcome of the dispute between Bank Melli and Bahrain?",
        "What legal framework was applied in this case?",
        "Tell me about international arbitration procedures."
    ]
    
    print("\n" + "="*60)
    print("TESTING FINE-TUNED DEEPSEEK MODEL")
    print("="*60)
    
    for question in test_questions:
        prompt = f"User: {question}\nAssistant:"
        
        inputs = tokenizer.encode(prompt, return_tensors="pt")
        if torch.cuda.is_available():
            inputs = inputs.cuda()
        
        with torch.no_grad():
            outputs = model.generate(
                inputs,
                max_new_tokens=200,
                num_return_sequences=1,
                temperature=0.7,
                do_sample=True,
                pad_token_id=tokenizer.pad_token_id,
                eos_token_id=tokenizer.eos_token_id
            )
        
        response = tokenizer.decode(outputs[0], skip_special_tokens=True)
        answer = response[len(tokenizer.decode(inputs[0], skip_special_tokens=True)):].strip()
        
        print(f"\nQ: {question}")
        print(f"A: {answer}")
        print("-" * 60)

def main():
    """Main training pipeline."""
    print("DEEPSEEK ARBITRATION FINE-TUNING (SMALL MODEL)")
    print("Using DeepSeek-Coder-1.3B with safetensors")
    print("=" * 60)
    
    # Configuration
    jsonl_file = "arbitration_fine_tuning.jsonl"
    output_dir = "./model/"
    
    # Check if training file exists
    if not os.path.exists(jsonl_file):
        print(f"Training file not found: {jsonl_file}")
        print("Please make sure you have generated the fine-tuning data first.")
        return
    
    # Train model
    trained_model_dir = train_deepseek_model(jsonl_file, output_dir)
    
    if trained_model_dir:
        # Test the model
        test_deepseek_model(trained_model_dir)
        
        print(f"\nSUCCESS! DeepSeek model fine-tuned!")
        print(f"Model saved in: {trained_model_dir}")
        print("Files in model directory:")
        for file in os.listdir(trained_model_dir):
            print(f"  - {file}")
        
        if torch.cuda.is_available():
            print("Training used GPU acceleration!")
        else:
            print("Training completed on CPU!")
    else:
        print("Training failed. Check error messages above.")

if __name__ == "__main__":
    main()