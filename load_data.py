from datasets import load_dataset

my_token = "YOUR_HF_TOKEN"
train = load_dataset("sonlam1102/vihsd", split="train", token=my_token)
dev = load_dataset("sonlam1102/vihsd", split="validation", token=my_token)
test = load_dataset("sonlam1102/vihsd", split="test", token = my_token)