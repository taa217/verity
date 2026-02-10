import asyncio
from app.agent import app
from langchain_core.messages import HumanMessage

async def test_agent():
    print("Testing Verity Agent...")
    
    # Simulate a user request
    inputs = {"messages": [HumanMessage(content="Explain the concept of a sine wave visually.")]}
    
    print(f"Input: {inputs['messages'][0].content}")
    
    # Invoke the graph
    result = await app.ainvoke(inputs)
    
    # Check results
    messages = result.get("messages", [])
    visual_state = result.get("visual_state", {})
    narrative_state = result.get("narrative_state", {})
    
    print("\n--- Result ---")
    print(f"Response: {messages[-1].content if messages else 'No response'}")
    
    print("\n--- Visual State ---")
    if "code" in visual_state:
        print(f"Code generated (length: {len(visual_state['code'])})")
        print(visual_state['code'][:200] + "...")
    else:
        print("No code generated.")
        
    print("\n--- Narrative State ---")
    if "narration" in narrative_state:
        print(f"Narration: {narrative_state['narration']}")
        print(f"Cues: {narrative_state.get('cues', [])}")
    else:
        print("No narration generated.")

if __name__ == "__main__":
    asyncio.run(test_agent())
