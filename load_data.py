from datasets import load_dataset

import os
my_token = os.environ.get("HF_TOKEN", "YOUR_HF_TOKEN_HERE")
train = load_dataset("sonlam1102/vihsd", split="train", token=my_token)
dev = load_dataset("sonlam1102/vihsd", split="validation", token=my_token)
test = load_dataset("sonlam1102/vihsd", split="test", token = my_token)