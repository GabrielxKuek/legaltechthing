###
# currently not using this for simplicity

from huggingface_hub import HfApi, Repository

# Path to your local model
model_path = "C:/Users/Gabriel Kuek/Desktop/Side Stuff/legaltechthing/model/"

# Create a repo (private or public)
repo_id = "GabrielxKuek/legaltech2025-deepseek"
api = HfApi()
api.create_repo(repo_id=repo_id, private=True)

# Upload the model folder
repo = Repository(local_dir=model_path, clone_from=repo_id)
repo.push_to_hub(commit_message="Upload fine-tuned DeepSeek model")
