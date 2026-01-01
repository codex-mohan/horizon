<div align="center">

  <img src="./assets/icon.png" alt="Horizon Logo" width="120" height="120" />

  # H O R I Z O N

  **The Event Horizon of Personal Intelligence**

  <p>
    An agentic AI assistant capable of system operations, browser automation, and hybrid model orchestration.
    <br />
    Built for local privacy, styled with glassmorphism.
  </p>

  <a href="https://nextjs.org">
    <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js" />
  </a>
  <a href="https://ui.shadcn.com/">
    <img src="https://img.shields.io/badge/shadcn%2Fui-000000?style=for-the-badge&logo=shadcnui&logoColor=white" alt="Shadcn UI" />
  </a>
  <a href="https://python.org">
    <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  </a>
  <a href="https://fastapi.tiangolo.com">
    <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  </a>
  <a href="https://langchain.com/">
    <img src="https://img.shields.io/badge/LangGraph-1C3C3C?style=for-the-badge&logo=langchain&logoColor=white" alt="LangGraph" />
  </a>
  <a href="https://www.docker.com/">
    <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
  </a>

</div>

---

## 🌌 Overview

**Horizon** is not just a chatbot; it is an agentic framework designed to bridge the gap between LLMs and your local operating environment. Inspired by the concept of an event horizon—the point of no return where gravity (intelligence) becomes absolute—this app serves as the singular entry point for your digital tasks.

It features a sophisticated **Python backend** utilizing **LangGraph** for stateful multi-agent orchestration, exposed via **FastAPI**, and a stunning **Next.js** frontend using the **Ein UI Glassmorphic** design system.

## ✨ Features

### 🧠 Hybrid Intelligence
* **Model Agnostic:** Seamlessly switch between local models (Ollama, Llama.cpp) for privacy and cloud APIs (OpenAI, Anthropic) for power.
* **LangGraph Orchestration:** Stateful agents that can plan, reason, and execute multi-step workflows.

### 🖥️ User Experience
* **Glassmorphic UI:** Built with Shadcn and Ein UI, featuring a modern, dark-mode-first aesthetic with deep blurs and gradients.
* **Full Voice Mode:** Hands-free interaction with real-time speech-to-text and text-to-speech capabilities.
* **Reactive Chat:** A ChatGPT-like interface optimized for code rendering, markdown, and rich media.

### 🛠️ Agent Capabilities
* **System Operations:** Ask Horizon to manage files, check system health (CPU/RAM), or execute terminal commands.
* **Browser Automation:** Capable of searching the web, scraping data, and summarizing live information.
* **Utility Tools:** Built-in weather integration, time management, and local hardware monitoring.

---

## 🏗️ Architecture

Horizon operates as a monorepo containing:

1.  **`apps/web` (Frontend):**
    * Next.js 14+ (App Router)
    * Tailwind CSS + Ein UI (Glassmorphism)
    * Client-side audio processing
2.  **`apps/api` (Backend):**
    * **FastAPI:** High-performance async server.
    * **LangGraph Server:** Manages the agent graph, state memory, and tool execution.
    * **Tools Layer:** Python scripts bridging the AI to the OS and Web.

---

## 🚀 Getting Started

### Prerequisites
* **Docker** (Recommended)
* *Or for manual setup:* Node.js 20+, Python 3.10+

### 🐳 Installation (Docker - Recommended)

Horizon is designed to run as a local containerized service.

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/yourusername/horizon.git](https://github.com/yourusername/horizon.git)
    cd horizon
    ```

2.  **Set up Environment Variables:**
    ```bash
    cp .env.example .env
    # Edit .env with your API keys (OpenAI, Weather, etc.)
    ```

3.  **Run with Docker Compose:**
    ```bash
    docker-compose up --build
    ```

4.  **Access Horizon:**
    Open `http://localhost:3000` in your browser.

### 🔧 Manual Installation (Dev Mode)

**Backend:**
```bash
cd apps/api
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn main:app --reload

```

**Frontend:**

```bash
cd apps/web
npm install
npm run dev

```

---

## 📸 Screenshots

| Dashboard | Voice Mode |
| --- | --- |
| *[Insert Screenshot]* | *[Insert Screenshot]* |

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

<div align="center">
<br />
<p><i>"Past the Event Horizon, everything is possible."</i></p>
</div>

```