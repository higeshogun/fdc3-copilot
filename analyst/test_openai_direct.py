import sys
print("Importing openai...", flush=True)
try:
    from openai import OpenAI
    print("Done.", flush=True)
    
    client = OpenAI(base_url="http://localhost:8081/v1", api_key="lm-studio")
    print("Sending request...", flush=True)
    response = client.chat.completions.create(
        model="llama3",
        messages=[{"role": "user", "content": "Hello!"}],
        timeout=10
    )
    print("Response received:", flush=True)
    print(response.choices[0].message.content)
except Exception as e:
    print(f"Error: {e}")
