# Tavus Experience - Enterprise Onboarding Sandbox

A personalized video onboarding platform powered by [Tavus AI](https://tavus.io). This application demonstrates the integration of the Tavus Phoenix-3 engine into a modern Next.js workflow, featuring real-time status polling, local persistence, and technical orchestration logs.

## 🚀 Live Demo
**Production URL:** [https://tavus-onboarding.vercel.app](https://tavus-onboarding.vercel.app)

## ✨ Features
- **Dynamic Personalization**: Generate AI videos with custom names and company branding.
- **Phoenix-3 Integration**: Leverages Tavus v2 API for high-fidelity video synthesis.
- **Status Tracking**: Real-time polling of video generation status (Queued → Processing → Ready).
- **Advanced Settings**: Support for smart backgrounds (brand website backdrops) and custom watermarks.
- **Local History**: Client-side persistence of generated video history.
- **Technical Terminal**: Transparent logging of API requests and system events.

## 🛠️ Tech Stack
- **Framework**: [Next.js 15+](https://nextjs.org) (App Router)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com)
- **AI Engine**: [Tavus API v2](https://docs.tavusapi.com)
- **Deployment**: [Vercel](https://vercel.com)

## ⚙️ Project Setup

### Environment Variables
Create a `.env.local` file in the root directory and add your Tavus credentials:
```bash
TAVUS_API_KEY=your_api_key_here
REPLICA_ID=your_replica_id_here
```

### Installation
```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📦 Deployment
This project is configured for Vercel. To deploy manually:
```bash
vercel --prod
```
*Note: Ensure environment variables are configured in the Vercel Dashboard.*

## 📄 License
Private Repository - Enterprise Onboarding Sandbox.
