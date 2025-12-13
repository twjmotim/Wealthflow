# WealthFlow AI Advisor

A comprehensive personal finance management system powered by Google Gemini AI.

## 🚀 Deployment Guide

This project is built with React + Vite + TypeScript. It is ready to be deployed on Vercel.

### Environment Variables (Required)

When deploying to Vercel (or any hosting provider), you **MUST** set the following environment variables in the project settings. Do not commit these keys to GitHub.

| Variable Name | Description |
| :--- | :--- |
| `VITE_API_KEY` | **Google Gemini API Key**. Get it from AI Studio. |
| `VITE_FIREBASE_API_KEY` | Firebase Project API Key. |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain (e.g., project.firebaseapp.com). |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Project ID. |
| `VITE_FIREBASE_STORAGE_BUCKET`| Firebase Storage Bucket. |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Sender ID. |
| `VITE_FIREBASE_APP_ID` | Firebase App ID. |

### How to Deploy

1. **Save to GitHub:** Push this code to your GitHub repository.
2. **Connect to Vercel:** Go to Vercel Dashboard -> Add New Project -> Import from GitHub.
3. **Configure Env Vars:** In the Vercel deployment screen, expand "Environment Variables" and copy-paste the values from your local `.env` or Firebase console.
4. **Deploy:** Click "Deploy".

## 🛠 Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```
