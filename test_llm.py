from langchain_openai import ChatOpenAI

print("Testing connection to LLM at http://localhost:8081/v1...")

try:
    llm = ChatOpenAI(
        base_url="http://localhost:8081/v1", 
        api_key="lm-studio",
        model="llama3"
    )
    response = llm.invoke("Hello, are you running?")
    print("\n[SUCCESS] Response received:")
    print(response.content)
except Exception as e:
    print("\n[ERROR] Connection failed:")
    print(e)
