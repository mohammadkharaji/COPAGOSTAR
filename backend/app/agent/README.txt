AI AGENT (optional, removable). Off unless SR_AGENT_ENABLED=1.

Env (e.g. in /etc/sr/agent.env, root-only, then add EnvironmentFile=-/etc/sr/agent.env to sr-api.service):
  SR_AGENT_ENABLED=1
  SR_AGENT_BASE_URL=<OpenAI-compatible base URL, e.g. https://host/v1>
  SR_AGENT_API_KEY=<secret>
  SR_AGENT_MODEL=<model id>

REMOVE COMPLETELY:
  1. delete backend/app/agent/            (this folder)
  2. delete backend/tests/test_agent.py
  3. delete frontend/src/agent/
  4. api.py: delete the block between "# >>> AGENT" and "# <<< AGENT"
  5. frontend/src/App.jsx: delete the 2 lines marked "AGENT"
  6. remove SR_AGENT_* variables from the server env file
Nothing else depends on this feature.
