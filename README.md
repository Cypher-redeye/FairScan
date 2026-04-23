# ⚖️ FairScan — AI Bias Auditing Platform

FairScan helps organizations detect hidden bias in their datasets and AI models before they cause real harm. Upload any CSV, select an outcome column and a protected attribute, and FairScan acts as a bias detective — computing fairness metrics, visualizing group disparities, and using **Google Gemini** to explain findings in plain English with actionable fix recommendations.

*Built for the Google Solution Challenge 2026.*

## ✨ Key Features
- **Rapid Analysis**: Upload any CSV dataset and run a full bias audit in under 30 seconds.
- **Advanced Metrics**: Computes Demographic Parity Difference, Disparate Impact Ratio, and Equalized Odds Difference using Microsoft Fairlearn.
- **Gemini-Powered Explanations**: Plain English explanations powered by Google Gemini — no data science degree required.
- **Interactive Visualizations**: Visual bar chart showing approval rates across demographic groups.
- **EEOC Compliance**: High/Medium/Low risk classification aligned with the EEOC four-fifths rule threshold.
- **Exportable Reports**: Generate and download a comprehensive PDF audit report.
- **Instant Testing**: Pre-loaded UCI Adult Income demo dataset to test the platform instantly.

## 🛠 Tech Stack
- **Frontend**: React 18
- **Backend**: FastAPI (Python)
- **Bias Analysis**: Microsoft Fairlearn
- **AI Explanation**: Google Gemini API (`gemini-1.5-flash`)
- **Deployment**: Google Cloud Run + Vercel

## 🎯 Use Cases
- **Startups** auditing their hiring algorithms before deployment.
- **NGOs** checking if resource distribution is equitable across communities.
- **Banks** auditing loan approval models for regulatory compliance.
- **Researchers** studying algorithmic fairness in real-world datasets.

## 🌍 SDG Alignment
- **SDG 10** — Reduced Inequalities
- **SDG 16** — Peace, Justice and Strong Institutions

---

*If you are looking for the tags to add to the GitHub "About" section, here they are:*
`fairness`, `bias-detection`, `responsible-ai`, `gemini-api`, `google-solution-challenge`, `fairlearn`, `fastapi`, `react`, `algorithmic-fairness`, `ethical-ai`
