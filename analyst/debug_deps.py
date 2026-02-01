import sys
print("Starting debug...", flush=True)

try:
    print("Importing json/glob/os...", flush=True)
    import json
    import glob
    import os
    print("Done.", flush=True)

    print("Skipping pandas...", flush=True)
    # import pandas as pd
    print("Skipping Done.", flush=True)

    print("Skipping matplotlib...", flush=True)
    # import matplotlib
    # matplotlib.use('Agg')
    # import matplotlib.pyplot as plt
    print("Skipping Done.", flush=True)

    print("Importing langchain_openai...", flush=True)
    from langchain_openai import ChatOpenAI
    print("Done.", flush=True)

    print("Importing FAISS...", flush=True)
    from langchain_community.vectorstores import FAISS
    print("Done.", flush=True)

    print("Importing HuggingFaceEmbeddings...", flush=True)
    from langchain_huggingface import HuggingFaceEmbeddings
    print("Done.", flush=True)

    print("Initializing Embeddings (download check)...", flush=True)
    embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
    print("Done.", flush=True)

except Exception as e:
    print(f"FAILED: {e}")
