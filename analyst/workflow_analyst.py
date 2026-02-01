import sys
import json
import glob
import os
import argparse
import time
from openai import OpenAI

def analyze():
    start_time = time.time()
    # Force UTF-8 for Windows console
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

    # Files loaded after arg parsing
    
    # Simple Chart (Disabled due to pandas import hang)

    # Simple Chart (Disabled due to pandas import hang)
    # df = pd.DataFrame(all_logs)
    # if 'origin' in df.columns:
    #     df['origin'].value_counts().plot(kind='pie', autopct='%1.1f%%')
    #     plt.title("Workflow Activity Distribution")
    #     plt.savefig("../activity_chart.png")
    #     sys.stderr.write("Activity chart saved to activity_chart.png in root.\n")

    parser = argparse.ArgumentParser()
    parser.add_argument("--url", help="LLM Base URL")
    parser.add_argument("--model", help="Model Name")
    parser.add_argument("--prompt", help="System/User Prompt")
    parser.add_argument("--api_key", help="API Key")
    parser.add_argument("--temperature", type=float, help="Temperature")
    parser.add_argument("--test", action="store_true", help="Test connection only")
    parser.add_argument("--start_time", help="Start time (ISO)")
    parser.add_argument("--end_time", help="End time (ISO)")
    args = parser.parse_args()

    # Time Filtering
    start_ts = 0
    end_ts = 9999999999999
    
    # Simple ISO parser to Timestamp (ms)
    def to_ts(iso_str):
        try:
            # Check if empty
            if not iso_str: return None
            # Use datetime if available or basic calculation
            import datetime
            dt = datetime.datetime.fromisoformat(iso_str)
            return dt.timestamp() * 1000 # to ms
        except:
            return None

    if args.start_time:
        t = to_ts(args.start_time)
        if t: start_ts = t
    if args.end_time:
        t = to_ts(args.end_time)
        if t: end_ts = t

    files = glob.glob("sessions/*.json")
    all_logs = []
    for f in files:
        try:
            with open(f, 'r', encoding='utf-8') as j:
                data = json.load(j)
                if isinstance(data, list):
                    # Append all, filter later
                    all_logs.extend(data)
        except Exception as e:
            sys.stderr.write(f"Skipping corrupt session {f}: {e}\n")
            continue
    
    # CRITICAL: Sort logs by timestamp to ensure we get the latest ones
    all_logs.sort(key=lambda x: x.get('timestamp', 0))

    clients_to_try = []
    if args.url:
        clients_to_try.append(args.url)
    else:
        # 2. Defaults (only if no URL provided)
        clients_to_try.extend(["http://localhost:8081/v1", "http://localhost:11434/v1"])
    
    client = None
    target_url = ""
    api_key = args.api_key if args.api_key else "lm-studio"

    for url in clients_to_try:
        try:
            sys.stderr.write(f"Trying LLM at {url}...\n")
            # fast check
            temp_client = OpenAI(base_url=url, api_key=api_key, timeout=10.0)
            models = temp_client.models.list() 
            client = temp_client
            target_url = url
            sys.stderr.write(f"Connected to {url}\n")
            
            if args.test:
                 model_names = [m.id for m in models.data] if hasattr(models, 'data') else [str(models)]
                 print(json.dumps({"models": model_names}))
                 return

            break
        except Exception as e:
            sys.stderr.write(f"Failed to connect to {url}: {e}\n")
            continue
            
    if not client:
        # Exit with 1 will send stderr to UI
        sys.stderr.write(f"Could not connect to any LLM at: {clients_to_try}. \nCheck if the server is running and the URL is correct.")
        sys.exit(1)

    if not all_logs:
        print(f"No logs found in range {args.start_time} - {args.end_time}")
        return

    # CRITICAL: Sort logs by timestamp to ensure we get the latest ones
    all_logs.sort(key=lambda x: x.get('timestamp', 0))

    # Filter by timestamp
    filtered_logs = []
    for l in all_logs:
        ts = l.get('timestamp', 0)
        # Only enforce start time, ignore end time to capture latest events regardless of clock skew
        if ts >= start_ts: 
            filtered_logs.append(l)

    if not filtered_logs and all_logs:
         sys.stderr.write("WARN: Time filter removed all logs. Falling back to ALL available logs.\n")
         filtered_logs = all_logs

    if not filtered_logs:
         print(f"No logs found in range {args.start_time} - {args.end_time}")
         return
         
    # Use the filtered (or fallback) list
    all_logs = filtered_logs

    try:
        # Context Selection Logic ("Sticky Context")
        # 1. Find the LATEST Portfolio Snapshot (CRITICAL for position awareness)
        portfolio_snapshot = None
        for log in reversed(all_logs):
            if log['data'].get('type') == 'fdc3.portfolio':
                portfolio_snapshot = log
                break
        
        # 2. Select recent logs (Last 50)
        recent_logs = all_logs[-50:]
        
        # 3. Combine them
        # If we found a snapshot and it's NOT already in the recent list, prepend it.
        final_context_logs = []
        if portfolio_snapshot and not (portfolio_snapshot in recent_logs):
            sys.stderr.write(f"DEBUG: Injecting Sticky Portfolio Snapshot ({portfolio_snapshot['timestamp']})\n")
            final_context_logs.append(portfolio_snapshot)
        
        final_context_logs.extend(recent_logs)
        
        # Prepare text lines
        texts = [f"{l['origin']} ({l.get('timestamp')}): {json.dumps(l['data'])}" for l in final_context_logs]
        
        # Direct Context (No Vector DB needed for small batch)
        context = "\n".join(texts)
        
        sys.stderr.write("DEBUG: Logs prepared.\n")
        
        # Load Knowledge Base (FDC3 Specs)
        knowledge_base = ""
        knowledge_dir = os.path.join(os.path.dirname(__file__), "knowledge")
        if os.path.exists(knowledge_dir):
            for f in glob.glob(os.path.join(knowledge_dir, "*.md")):
                try:
                    with open(f, 'r', encoding='utf-8') as kf:
                        knowledge_base += kf.read() + "\n\n"
                    sys.stderr.write(f"DEBUG: Loaded knowledge from {os.path.basename(f)}\n")
                except Exception as e:
                    sys.stderr.write(f"WARN: Could not read knowledge file {f}: {e}\n")
        
        system_base = args.prompt if args.prompt else "Analyze these FDC3 logs:"
        
        # Combine Knowledge + System Prompt
        if knowledge_base:
            system_instruction = f"REFERENCE KNOWLEDGE:\n{knowledge_base}\n\nINSTRUCTIONS:\n{system_base}\n\nCRITICAL ANALYSIS RULES:\n1. Prioritize the LATEST information based on timestamp order.\n2. Individual `fdc3.position` updates appearing AFTER a `fdc3.portfolio` snapshot MUST override the portfolio's data for that instrument.\n3. The logs are chronological (Oldest to Newest). The last entry is the current state."
        else:
            system_instruction = f"{system_base}\n\nCRITICAL ANALYSIS RULES:\n1. Prioritize the LATEST information based on timestamp order.\n2. Individual `fdc3.position` updates appearing AFTER a `fdc3.portfolio` snapshot MUST override the portfolio's data for that instrument.\n3. The logs are chronological (Oldest to Newest). The last entry is the current state."

        prompt = f"{system_instruction}\n\nLOGS:\n{context}\n\nAt the end of your response, provide exactly 3 brief suggested follow-up questions for the user to ask next. Prefix this section with 'Suggested Actions:' and use a bulleted list."
        
        model_name = args.model if args.model else "llama3"
        temperature = args.temperature if args.temperature is not None else 0.7
        
        sys.stderr.write(f"Sending to {model_name} at {target_url} (Temp: {temperature})...\n")

        # completion = client.chat.completions.create(...) logic follows
        completion = client.chat.completions.create(
            model=model_name, 
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature,
            max_tokens=2000,
            timeout=300
        )
        
        sys.stderr.write(f"DEBUG: Completion object type: {type(completion)}\n")
        
        if completion is None:
             raise ValueError("Completion is None")
        
        if not hasattr(completion, 'choices'):
             sys.stderr.write(f"DEBUG: Completion has no choices attr: {dir(completion)}\n")
             # Fallback for dict?
             if isinstance(completion, dict) and 'choices' in completion:
                 sys.stderr.write("DEBUG: Completion is dict.\n")
                 response = completion['choices'][0]['message']['content']
             else:
                 raise ValueError(f"Invalid completion object: {completion}")
        else:
             if not completion.choices:
                 raise ValueError("Completion.choices is empty")
             response = completion.choices[0].message.content

        sys.stderr.write("DEBUG: Response extracted.\n")
        
        if response is None:
            response = "(No analysis returned from LLM)"

        with open("../weekly_summary.md", "w", encoding='utf-8') as f:
            f.write("# Workflow Intelligence Report\n\n")
            f.write(response)
        

        sys.stderr.write("Weekly summary saved to weekly_summary.md in root.\n")
        
        duration = time.time() - start_time
        if duration > 10:
             sys.stderr.write(f"Performance: {duration:.2f} seconds - Likely running on CPU. Check GPU acceleration!\n")
        else:
             sys.stderr.write(f"Performance: {duration:.2f} seconds - Fast! Likely GPU accelerated.\n")
             
        # Add context debug info
        log_count_msg = f"_(Analyzed {len(all_logs)} logs)_\n\n"
        print(log_count_msg + response)
    except Exception as e:
        import traceback
        sys.stderr.write(f"Error during RAG analysis: {e}\nTraceback:\n{traceback.format_exc()}\n")
        sys.exit(1)

if __name__ == "__main__":
    analyze()
